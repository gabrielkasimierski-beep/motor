# Herramientas del Motor

Utilitarios del estudio que no son skills. Sin dependencias: solo Python 3.8+ y git.

## Guardián de código (`repo_guard.py` + `scan_repo.py`)

Para sumar código de terceros (una skill, un repo, un kit) **sin riesgo** y sin quedar atado a lo que
el autor cambie después. Lo maneja el agente **`motor-guardian`**; estos son los comandos que corre.

**Nunca ejecuta el código del repo:** solo clona (sin submódulos) a una cuarentena aislada
(`~/.repo_guard_quarantine`, fuera de todo proyecto) y lo lee.

```bash
# 1) AUDITAR — clona a cuarentena y escanea. No toca tu proyecto.
python C:/Claude/Motor/herramientas/repo_guard.py audit https://github.com/autor/repo

# 2) (revisás el reporte y el hash a ojo)

# 3) VENDORIZAR — recién acá copia a tu proyecto, con el hash que revisaste.
python C:/Claude/Motor/herramientas/repo_guard.py vendor https://github.com/autor/repo \
    --commit <hash-completo> --into ./vendored/repo

# 3b) VENDORIZAR SOLO UNA SUBCARPETA del commit (ej. una skill dentro de un repo más grande).
#     Su contenido queda en la raíz de --into.
python C:/Claude/Motor/herramientas/repo_guard.py vendor https://github.com/autor/repo \
    --commit <hash-completo> --subpath .agents/skills/<nombre> --into ./vendored/<nombre>

# Cuando quieras chequear que nadie tocó la copia:
python C:/Claude/Motor/herramientas/repo_guard.py verify ./vendored/repo
```

- `audit` resuelve el **hash exacto** del commit y lo pasa por `scan_repo.py`, que marca hooks de
  instalación, `curl | sh`, `eval`/`child_process`, lectura de secretos, ofuscación, workflows de CI y
  binarios. Es una **lupa, no un veredicto**: lo decidís vos.
- `vendor` copia **sin `.git`** y deja un `PROVENANCE.json` (origen, commit, fecha, hash del contenido).
- `vendor --subpath <ruta>` copia **solo esa subcarpeta** del commit fijado (ruta relativa dentro del
  repo; rechaza `..`, rutas absolutas y `.git`). El `PROVENANCE.json` registra `subpath` y el hash de
  lo copiado; sin la opción, `subpath` queda en `null` (repo entero).
- `vendor` aborta sin copiar nada si lo que iba a copiar tiene **enlaces simbólicos** (podrían traer
  archivos de fuera del repo).
- `verify` recalcula el hash y avisa si la copia cambió (sale con código 1 si cambió). Funciona igual
  con copias de repo entero o de una subcarpeta, y muestra la subcarpeta registrada.

Multiplataforma (Windows, Mac, Linux). La salida se fuerza a UTF-8 para que no rompa en la consola de
Windows.
