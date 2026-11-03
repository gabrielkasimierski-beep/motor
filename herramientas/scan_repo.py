#!/usr/bin/env python3
"""
scan_repo.py -- Escaner ESTATICO de un repo (no ejecuta nada).

Lee los archivos de una carpeta y marca patrones que valen una segunda
mirada antes de meter codigo de terceros en el estudio: hooks de
instalacion, descargas que se canalizan a un interprete, ejecucion
dinamica, lectura de secretos, ofuscacion, binarios y workflows de CI.

NO decide por vos. Es una lupa: baja el ruido y te deja los puntos a
revisar con archivo:linea. La decision (y el hash a fijar) la tomas vos.

Uso:
    python scan_repo.py <carpeta-del-repo>

Sin dependencias. Python 3.8+. Salida en ASCII para que entre en
cualquier consola (incluida la de Windows).

Codigo de salida: 0 si no hay hallazgos; 1 si hay al menos uno (util
para encadenarlo, pero igual lo mira una persona).
"""

import json
import re
import sys
from pathlib import Path

# Archivos de texto que leemos (el resto se trata como binario y solo se lista)
TEXT_EXT = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".sh", ".bash",
    ".zsh", ".ps1", ".psm1", ".rb", ".php", ".pl", ".go", ".rs", ".java",
    ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".md", ".txt",
    ".html", ".htm", ".css", ".xml", ".env", ".lock", ".config",
}
# No miramos adentro de estas carpetas (ruido, no codigo del autor)
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "vendor",
             "__pycache__", ".venv", "venv", ".cache", "coverage"}
# Binarios que conviene nombrar explicitamente
BIN_EXT = {".exe", ".dll", ".so", ".dylib", ".bin", ".node", ".wasm",
           ".pyc", ".jar", ".class", ".o", ".a"}
BIG_FILE = 3 * 1024 * 1024  # 3 MB: binarios/blobs grandes a mirar

# Severidad: ALTA (frena y revisa), MEDIA (entende por que esta), BAJA (dato)
PATTERNS = [
    # categoria, severidad, regex
    ("descarga-a-interprete", "ALTA",
     r"(?:curl|wget|iwr|invoke-webrequest)\b[^\n|]*\|\s*(?:sh|bash|zsh|python|node|iex|invoke-expression)\b"),
    ("ejecucion-dinamica", "ALTA",
     r"\b(?:eval|exec)\s*\(|new\s+Function\s*\(|\bos\.system\s*\(|child_process|execSync|spawnSync|\bpopen\b|subprocess\.(?:call|run|Popen)|pickle\.loads|marshal\.loads|Runtime\.getRuntime"),
    ("lee-secretos", "ALTA",
     r"\.ssh/|\.aws/credentials|id_rsa|\.npmrc|\.git-credentials|AWS_SECRET|PRIVATE_KEY|(?:process\.env|os\.environ)\b"),
    ("ofuscacion", "ALTA",
     r"\batob\s*\(|Buffer\.from\s*\([^)]*base64|base64\.b64decode|fromCharCode|\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}"),
    ("red", "MEDIA",
     r"\bfetch\s*\(|XMLHttpRequest|\baxios\b|\brequests\.(?:get|post)|urllib|http\.client|net\.(?:connect|Socket)|new\s+WebSocket|dgram|\bsocket\.(?:socket|connect)"),
    ("escritura-fs", "MEDIA",
     r"writeFileSync|fs\.write|shutil\.(?:copy|move|rmtree)|os\.remove|unlink\(|rimraf"),
    ("cripto-mineria", "MEDIA",
     r"coinhive|cryptonight|stratum\+tcp|xmrig|minerd"),
]

# Blob largo de base64/hex en una sola linea (posible payload escondido)
BLOB = re.compile(r"[A-Za-z0-9+/]{220,}={0,2}")

findings = []  # (sev, categoria, ruta, linea, texto)


def rel(root, p):
    try:
        return str(p.relative_to(root))
    except ValueError:
        return str(p)


def scan_text(root, path):
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        for cat, sev, rx in PATTERNS:
            if re.search(rx, line, re.IGNORECASE):
                findings.append((sev, cat, rel(root, path), i, line.strip()[:160]))
        if BLOB.search(line):
            findings.append(("ALTA", "blob-ofuscado", rel(root, path), i,
                             "linea con bloque base64/hex largo (%d chars)" % len(line)))


def scan_package_json(root, path):
    """Hooks de ciclo de vida de npm: lo mas comun para colar codigo."""
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return
    scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
    riesgo = {"preinstall", "install", "postinstall", "prepare",
              "prepublish", "prepublishOnly", "preuninstall", "postuninstall"}
    for name, cmd in (scripts or {}).items():
        if name in riesgo:
            findings.append(("ALTA", "hook-de-instalacion", rel(root, path), 0,
                             "%s: %s" % (name, str(cmd)[:140])))


def main():
    if len(sys.argv) != 2:
        sys.exit("uso: python scan_repo.py <carpeta-del-repo>")
    root = Path(sys.argv[1]).expanduser().resolve()
    if not root.is_dir():
        sys.exit("No es una carpeta: %s" % root)

    workflows = []
    binarios = []
    grandes = []
    n_text = 0

    for p in sorted(root.rglob("*")):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if not p.is_file():
            continue
        r = rel(root, p)
        # CI que corre en GitHub con permisos del repo
        if "/.github/workflows/" in ("/" + r.replace("\\", "/")):
            workflows.append(r)
        try:
            size = p.stat().st_size
        except OSError:
            size = 0
        ext = p.suffix.lower()
        if ext in BIN_EXT:
            binarios.append(r)
            continue
        if size > BIG_FILE:
            grandes.append("%s (%.1f MB)" % (r, size / 1024 / 1024))
        if p.name == "package.json":
            scan_package_json(root, p)
        if ext in TEXT_EXT or p.name.startswith(".env"):
            n_text += 1
            scan_text(root, p)

    # ------- reporte (ASCII) -------
    print("Repo:   %s" % root)
    print("Archivos de texto leidos: %d" % n_text)
    print("=" * 60)

    orden = {"ALTA": 0, "MEDIA": 1, "BAJA": 2}
    findings.sort(key=lambda f: (orden.get(f[0], 9), f[1], f[2], f[3]))

    altas = sum(1 for f in findings if f[0] == "ALTA")
    medias = sum(1 for f in findings if f[0] == "MEDIA")

    if workflows:
        print("\n[CI] Workflows de GitHub (corren con permisos del repo, revisalos):")
        for w in workflows:
            print("   - %s" % w)
    if binarios:
        print("\n[BIN] Binarios (no se leen; no se vendorizan sin que lo decidas):")
        for b in binarios[:40]:
            print("   - %s" % b)
        if len(binarios) > 40:
            print("   ... y %d mas" % (len(binarios) - 40))
    if grandes:
        print("\n[GRANDE] Archivos > 3 MB (posibles blobs):")
        for g in grandes[:40]:
            print("   - %s" % g)

    if findings:
        print("\nHallazgos por patron (archivo:linea):")
        cat_actual = None
        por_cat = {}
        for sev, cat, ruta, ln, txt in findings:
            por_cat.setdefault((sev, cat), []).append((ruta, ln, txt))
        for (sev, cat), items in sorted(por_cat.items(), key=lambda kv: (orden.get(kv[0][0], 9), kv[0][1])):
            print("\n  [%s] %s  (%d)" % (sev, cat, len(items)))
            for ruta, ln, txt in items[:12]:
                loc = "%s:%d" % (ruta, ln) if ln else ruta
                print("     %s" % loc)
                if txt:
                    print("        %s" % txt)
            if len(items) > 12:
                print("     ... y %d mas" % (len(items) - 12))
    else:
        print("\nSin patrones de riesgo en el escaneo automatico.")

    print("\n" + "=" * 60)
    print("Resumen: %d ALTA, %d MEDIA, %d workflows, %d binarios." %
          (altas, medias, len(workflows), len(binarios)))
    print("Esto es una lupa, NO un veredicto. Revisa a ojo los puntos de arriba")
    print("antes de vendorizar. Nada entra al proyecto hasta que fijes el hash.")

    sys.exit(1 if findings or workflows or binarios else 0)


if __name__ == "__main__":
    main()
