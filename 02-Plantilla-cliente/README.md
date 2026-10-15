# Plantilla de cliente

Lo que se copia cuando entra un cliente nuevo. Cada cliente es **su propio proyecto**, con su
identidad, su memoria y sus tokens, y usa el Motor sin mezclarse con ningún otro.

## Crear un cliente

```powershell
powershell -ExecutionPolicy Bypass -File C:\Claude\Motor\02-Plantilla-cliente\nuevo-cliente.ps1 -Nombre "Casa Rossi" -Rubro "Gastronomía"
```

Opcional: `-DesdeProspecto "C:\Claude\Estudio\04-Prospectos\<empresa>"` trae el diagnóstico que ya se hizo.
La skill `cliente-nuevo` también puede correrlo por vos.

Deja `C:\Claude\Clientes\<cliente>\` con lo siguiente, **conecta solo el plugin del Motor** a ese
proyecto (`claude plugin install motor@motor-estudio --scope project`) y regenera el aislamiento de todos:

| Archivo | Para qué |
|---|---|
| `CLAUDE.md` | La identidad del cliente. Importa el `MOTOR.md` y los cuatro archivos de `identidad/` |
| `00-ARRANQUE.md` | **El pedido de arranque**, ya con el nombre y el rubro: se completa con lo que se sepa (o se pega el WhatsApp tal cual) y se le dice a Claude *"Leé 00-ARRANQUE.md y arrancá"* |
| `identidad/` | `marca.md` · `voz.md` · `visual.md` · `reglas-del-negocio.md`: lo propio de este cliente |
| `.claude/settings.json` | Activa el plugin del Motor y **bloquea** el acceso a los demás clientes y a tus carpetas privadas (las de `bloqueos-locales.txt`) |
| `.env.example` | Los tokens de ESTE cliente van en un `.env` (fuera de git), nunca en un `.md` |
| `.gitignore` | Deja afuera `.env`, claves y `settings.local.json` |

Después se abre Claude Code **en esa carpeta** y se dice *"tengo un cliente nuevo"*.

## Cómo no se mezclan los clientes

1. **Un proyecto, un cliente:** la memoria de Claude Code es por carpeta, así que cada uno tiene la suya.
2. **Permisos:** `permissions.deny` bloquea leer y escribir en los otros clientes. Lo regenera el script
   cada vez que entra uno nuevo (`-SoloAislamiento` lo vuelve a correr). No lo edites a mano; los permisos
   propios van en `.claude/settings.local.json`.
3. **Tokens:** los de cada cliente, en su `.env`. Los del estudio, en variables de entorno de Windows
   (ver `../04-Accesos/`).
4. **Aprendizajes:** lo que sirve a otros clientes sube al Motor **sin datos del cliente**.

> El bloqueo de permisos frena a las herramientas de lectura y edición de Claude; no es una caja
> fuerte contra un comando de shell deliberado. Es una barrera contra errores, no contra mala fe.
