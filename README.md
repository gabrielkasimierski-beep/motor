# Motor Cliente nuevo

El sistema de trabajo de Gaby y Juanma para **resolverle el problema digital a cualquier negocio**: una web, una
app, 3D y animación, o diseño gráfico. Son las skills, el método, los precios y la plantilla de cliente, para que
cada cliente nuevo arranque ordenado y **sin mezclarse con ningún otro**. El cerebro está en
[`MOTOR.md`](MOTOR.md) y la guía de uso en [`GUIA-DE-USO.md`](GUIA-DE-USO.md).

> Repo **privado**. No tiene datos de clientes ni claves, y no tiene que tenerlos nunca.

## Instalarlo en tu máquina (Windows)

Necesitás: **Windows 10/11**, **Git**, **Node.js 20 o más** (para las herramientas) y **Claude Code** (la app o el CLI).

1. Cloná el repo **exactamente en `C:\Claude\Motor`** (las skills usan esa ruta):
   ```powershell
   git clone https://github.com/gabrielkasimierski-beep/motor.git C:\Claude\Motor
   ```
2. Registrá el Motor en Claude Code (una sola vez):
   ```powershell
   claude plugin marketplace add C:\Claude\Motor
   ```
3. Creá la carpeta de tus clientes: `C:\Claude\Clientes`.
4. Opcional, **solo si tenés carpetas privadas** que los clientes no deben ver: copiá
   `02-Plantilla-cliente\bloqueos-locales.ejemplo.txt` como `bloqueos-locales.txt` y listalas.
5. Opcional: copiá `04-Accesos\inventario.ejemplo.md` como `inventario.md` para anotar tus cuentas (queda fuera de git).
6. Creá tu primer cliente (ver abajo). Al abrirlo en Claude Code, escribí `/` y fijate que aparezcan las skills `motor:`.

Para **recibir las novedades** del Motor: `git -C C:\Claude\Motor pull` (con `main` en esa carpeta).

## Arrancar un cliente nuevo

```powershell
powershell -ExecutionPolicy Bypass -File C:\Claude\Motor\02-Plantilla-cliente\nuevo-cliente.ps1 -Nombre "Casa Rossi" -Rubro "Gastronomía"
```

Crea `C:\Claude\Clientes\casa-rossi\` con su identidad vacía, conecta solo el plugin del Motor a ese cliente y le
bloquea el acceso a los demás. Después se abre Claude Code **en esa carpeta** y se dice *"tengo un cliente nuevo"*.
Si el script avisa que no pudo conectar el plugin: `claude plugin install motor@motor-estudio --scope project`,
parado en la carpeta del cliente.

## Qué hay acá

| Carpeta | Para qué |
|---|---|
| `GUIA-DE-USO.md` | **Cómo se usa todo**: instalar, trabajar un cliente, arrancar uno nuevo, qué hacer si algo no anda |
| `MOTOR.md` | El cerebro: norte, reglas, niveles. Cada cliente lo importa |
| `CONTRIBUTING.md` | **Cómo cambiamos el Motor entre los dos** (ramas, PR) |
| `plugin/` | **El plugin `motor`:** las skills y el agente "Motor Cliente nuevo". Se conecta a cada cliente |
| `00-Motor/` | El método: embudo, cómo decidir el tipo de trabajo, control de calidad, historial |
| `01-Capacidades/` | **El menú** de lo que ofrecemos (web, apps, 3D/animación, diseño gráfico) y lo aprendido. Crece |
| `01-Capacidades/web/webi/` | **Kit webi:** sitios con movimiento (código base, banco de pruebas y sitios estudiados) |
| `01-Capacidades/redes/` | **Publicador de redes:** conexión local con Instagram, herramientas por comando y guía para continuar la puesta en marcha |
| `02-Plantilla-cliente/` | El andamiaje de un cliente + el script que lo crea |
| `03-Comercial/` | La grilla de precios, los datos del estudio y las condiciones |
| `04-Accesos/` | Cómo se manejan los tokens y conectores (nombres y ubicaciones, nunca valores) |

## Cambiar el Motor

Cada cambio entra por una rama y un Pull Request que el otro mira: las reglas están en
[`CONTRIBUTING.md`](CONTRIBUTING.md). Una skill nueva va en `plugin/skills/<nombre>/SKILL.md`; un agente, en
`plugin/agents/<nombre>.md`. Lo que es **de un solo cliente** va en la carpeta de ese cliente, no acá.
