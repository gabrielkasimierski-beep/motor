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

# Cuando quieras chequear que nadie tocó la copia:
python C:/Claude/Motor/herramientas/repo_guard.py verify ./vendored/repo
```

- `audit` resuelve el **hash exacto** del commit y lo pasa por `scan_repo.py`, que marca hooks de
  instalación, `curl | sh`, `eval`/`child_process`, lectura de secretos, ofuscación, workflows de CI y
  binarios. Es una **lupa, no un veredicto**: lo decidís vos.
- `vendor` copia **sin `.git`** y deja un `PROVENANCE.json` (origen, commit, fecha, hash del contenido).
- `verify` recalcula el hash y avisa si la copia cambió.

Multiplataforma (Windows, Mac, Linux). La salida se fuerza a UTF-8 para que no rompa en la consola de
Windows.
