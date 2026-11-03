#!/usr/bin/env python3
"""
repo_guard.py — Agente para sumar repos de terceros de forma segura.

Flujo en 3 pasos (auditar → fijar hash → vendorizar):

    1) AUDITAR    repo_guard.py audit  <url> [--ref main]
       Clona el repo a una zona de CUARENTENA aislada, resuelve el hash
       exacto del commit, lo escanea con scan_repo.py y te muestra el
       reporte + el hash. NO toca tu proyecto.

    2) (revisás el reporte a ojo)

    3) VENDORIZAR repo_guard.py vendor <url> --commit <hash> --into <ruta>
       Vuelve a clonar, hace checkout del hash EXACTO que vos pasaste,
       copia los archivos (sin .git) a tu proyecto y deja un archivo
       PROVENANCE.json con origen, hash y fecha.

    Extra:
       repo_guard.py verify <ruta-vendorizada>
       Recalcula y compara contra el hash registrado, para detectar si
       algo cambió después.

No ejecuta NADA del repo. git clone por sí solo no corre los hooks del
repo, y acá además se clona con --no-recurse-submodules para que no entre
contenido de submódulos sin que lo decidas.

Requiere: git, Python 3.8+, y scan_repo.py en la misma carpeta (opcional
pero recomendado para la auditoría).
"""

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def _force_rmtree(path):
    """Borra una carpeta aunque tenga archivos de solo-lectura (los .git en
    Windows lo son, y shutil.rmtree falla con 'Acceso denegado' sin esto)."""
    def _onerror(func, p, exc):
        try:
            os.chmod(p, stat.S_IWRITE)
            func(p)
        except Exception:
            pass
    shutil.rmtree(path, onerror=_onerror)

# La salida usa flechas y tildes; en la consola de Windows (cp1252) eso
# rompe. Forzamos UTF-8 para que corra igual en Windows, Mac y Linux.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

QUARANTINE = Path.home() / ".repo_guard_quarantine"
SCANNER = Path(__file__).resolve().parent / "scan_repo.py"
SKIP_COPY = {".git", ".github/workflows"}  # lo que no copiamos al vendorizar


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def run(cmd, cwd=None):
    """Corre un comando git y devuelve stdout. Aborta si falla."""
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"✗ Falló: {' '.join(cmd)}\n{res.stderr.strip()}")
    return res.stdout.strip()


def clone_quarantine(url, ref=None):
    """Clona a cuarentena (aislado) sin submódulos. Devuelve (ruta, hash)."""
    QUARANTINE.mkdir(exist_ok=True)
    # nombre único por url para no pisar clones
    name = hashlib.sha1(url.encode()).hexdigest()[:12]
    dest = QUARANTINE / name
    if dest.exists():
        _force_rmtree(dest)

    cmd = ["git", "clone", "--no-recurse-submodules", "--quiet"]
    if ref:
        cmd += ["--branch", ref]
    cmd += [url, str(dest)]
    run(cmd)

    commit = run(["git", "rev-parse", "HEAD"], cwd=dest)
    return dest, commit


def checkout_commit(repo_dir, commit):
    """Hace checkout de un hash exacto. Falla si el hash no existe."""
    run(["git", "checkout", "--quiet", commit], cwd=repo_dir)


# ------------------------------------------------------------------ #
# Comandos
# ------------------------------------------------------------------ #

def cmd_audit(args):
    print(f"→ Clonando a cuarentena (aislado): {args.url}")
    repo_dir, commit = clone_quarantine(args.url, args.ref)
    print(f"✓ Clonado. Commit actual: {commit}\n")

    if SCANNER.exists():
        print("→ Ejecutando scan_repo.py...\n" + "-" * 60)
        subprocess.run([sys.executable, str(SCANNER), str(repo_dir)])
    else:
        print(f"⚠ No encontré scan_repo.py junto a este script ({SCANNER}).")
        print("  Audita a mano o poné scan_repo.py al lado y reintentá.")

    print("\n" + "=" * 60)
    print("SIGUIENTE PASO — si tras revisar el reporte el repo te cierra:")
    print(f'\n  python {Path(__file__).name} vendor {args.url} \\')
    print(f"      --commit {commit} \\")
    print(f"      --into ./vendored/<nombre>\n")
    print("Fijate que el hash de arriba sea el que revisaste. Nada se copia")
    print("a tu proyecto hasta que corras el comando vendor a mano.")


def cmd_vendor(args):
    into = Path(args.into).expanduser().resolve()
    if into.exists() and any(into.iterdir()):
        sys.exit(f"✗ El destino ya existe y no está vacío: {into}")

    print(f"→ Clonando y fijando commit {args.commit}")
    repo_dir, _ = clone_quarantine(args.url)
    checkout_commit(repo_dir, args.commit)

    # verificamos que quedó EXACTO en ese hash
    now_at = run(["git", "rev-parse", "HEAD"], cwd=repo_dir)
    if now_at != args.commit:
        sys.exit(f"✗ El hash no coincide. Esperado {args.commit}, quedó {now_at}")

    print(f"→ Copiando a {into} (sin .git)")
    into.mkdir(parents=True, exist_ok=True)
    for item in repo_dir.iterdir():
        if item.name in SKIP_COPY:
            continue
        target = into / item.name
        if item.is_dir():
            shutil.copytree(item, target,
                            ignore=shutil.ignore_patterns(".git"))
        else:
            shutil.copy2(item, target)

    # hash del contenido vendorizado, para poder verificar después
    content_hash = _dir_hash(into)
    provenance = {
        "source_url": args.url,
        "pinned_commit": args.commit,
        "vendored_at": datetime.now(timezone.utc).isoformat(),
        "content_sha256": content_hash,
        "note": "Copia congelada. No se actualiza salvo que repitas el flujo.",
    }
    (into / "PROVENANCE.json").write_text(
        json.dumps(provenance, indent=2), encoding="utf-8")

    print("✓ Vendorizado.")
    print(f"  Origen:  {args.url}")
    print(f"  Commit:  {args.commit}")
    print(f"  Destino: {into}")
    print(f"  Registro: {into / 'PROVENANCE.json'}")


def cmd_verify(args):
    into = Path(args.path).expanduser().resolve()
    prov_file = into / "PROVENANCE.json"
    if not prov_file.exists():
        sys.exit(f"✗ No hay PROVENANCE.json en {into}. ¿Seguro lo vendorizaste con este agente?")

    prov = json.loads(prov_file.read_text(encoding="utf-8"))
    current = _dir_hash(into)
    if current == prov["content_sha256"]:
        print(f"✓ Intacto. Coincide con lo vendorizado el {prov['vendored_at']}.")
        print(f"  Commit fijado: {prov['pinned_commit']}")
    else:
        print("⚠ ¡CAMBIÓ! El contenido no coincide con el hash registrado.")
        print(f"  Registrado: {prov['content_sha256']}")
        print(f"  Ahora:      {current}")
        print("  Alguien (o algo) modificó los archivos después de vendorizar.")


def _dir_hash(root: Path):
    """Hash sha256 determinista del contenido (ignora PROVENANCE.json)."""
    h = hashlib.sha256()
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.name != "PROVENANCE.json":
            h.update(str(p.relative_to(root)).encode())
            h.update(p.read_bytes())
    return h.hexdigest()


# ------------------------------------------------------------------ #
# CLI
# ------------------------------------------------------------------ #

def main():
    ap = argparse.ArgumentParser(
        description="Agente para sumar repos de terceros sin quedar atado a cambios del autor.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("audit", help="Clonar a cuarentena y escanear")
    a.add_argument("url")
    a.add_argument("--ref", help="Rama o tag a traer (default: rama por defecto)")
    a.set_defaults(func=cmd_audit)

    v = sub.add_parser("vendor", help="Fijar un hash y copiar a tu proyecto")
    v.add_argument("url")
    v.add_argument("--commit", required=True, help="Hash COMPLETO del commit revisado")
    v.add_argument("--into", required=True, help="Carpeta destino en tu proyecto")
    v.set_defaults(func=cmd_vendor)

    ve = sub.add_parser("verify", help="Verificar que una copia no cambió")
    ve.add_argument("path", help="Carpeta vendorizada a verificar")
    ve.set_defaults(func=cmd_verify)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
