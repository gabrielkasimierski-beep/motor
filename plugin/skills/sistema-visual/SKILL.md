---
name: sistema-visual
description: Sistema visual de un sitio - color por roles, tres voces tipográficas, escala fluida, espacios, líneas, curvas de movimiento, grano y resplandor - y cómo sacarlo de la marca real de un cliente. Usar al empezar el diseño de cualquier sitio, al adaptar el kit a una marca ("ponele los colores de…"), al elegir tipografías, o cuando una página se ve despareja (muchos grises, muchos tamaños, cada cosa con su curva).
---

# Sistema visual

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

> La **personalidad** del sitio (qué paleta, qué tipografías y por qué, para que no se parezca a otro
> cliente) se decide con `C:/Claude/Motor/01-Capacidades/web/sistema-diseno.md`. Acá está **cómo se
> escribe** esa decisión en las variables del kit.

Un sitio se ve cuidado cuando pocas decisiones se repiten en todos lados. El sistema está en
`kit/tokens.css`: los **roles** son fijos y los usa todo el kit; los **valores** se cambian por
marca pisando solo el primer bloque.

## Color: roles, no colores

| Rol | Variable | Regla |
|---|---|---|
| Fondo | `--tinta`, `--tinta-2`, `--superficie` | Tres alturas del mismo tono, de más hondo a más alto. Nunca negro o blanco puros: llevan un poco del color de la marca |
| Texto | `--hueso`, `--bruma`, `--tenue` | Tres alturas: principal, secundario, etiquetas. No hay un cuarto gris |
| Líneas | `--linea`, `--linea-fuerte` | Son el color del texto al 8% y al 16%. Así sirven sobre cualquier fondo |
| Acento | `--acento`, `--acento-claro`, `--acento-hondo`, `--sobre-acento` | **Uno solo.** El claro para etiquetas y brillos, el hondo para degradés y sombras |
| Aviso | `--alerta` | Bajas y errores. Nunca solo: va con ícono, signo o texto, para no depender del color |

**Sacarlo de una marca:**
1. Pedir el **archivo original del logo** y medir el color ahí (no de una captura ni de una foto).
2. Ese color es `--acento`. Su versión clara y su versión honda salen de subir y bajar la
   luminosidad manteniendo el tono.
3. El fondo es casi negro o casi blanco **teñido** con el tono del acento (2–6% de saturación).
4. Comprobar contraste: texto principal sobre fondo ≥ 7:1, secundario ≥ 4,5:1, texto sobre el
   botón de acento ≥ 4,5:1 (para eso está `--sobre-acento`).
5. Cuando el color **es** la marca (una pizzería roja, una ferretería amarilla), una sola paleta:
   sin tema claro/oscuro alternativo.

Si hay fotos de producto con fondo oscuro que pelean con la identidad, se les saca el fondo y
flotan sobre el color de la marca.

## Tipografía: tres voces

| Voz | Variable | Para qué | Cómo se elige |
|---|---|---|---|
| Título | `--f-titulo` | Titulares, cifras, la marca gigante | Con carácter, peso 700–800, que aguante `letter-spacing` negativo a gran tamaño |
| Lectura | `--f-texto` | Párrafos, botones, formularios | Neutra y muy legible a 16 px |
| Dato | `--f-mono` | Etiquetas en mayúsculas, números, pasos, fechas | Monoespaciada; da el tono "técnico" con muy poco |

El contraste entre voces hace el trabajo: un título enorme y apretado, una etiqueta mono chiquita
y espaciada arriba, un párrafo tranquilo abajo. Un sitio entero en una sola familia y sin un
tamaño realmente grande se ve genérico.

**Escala fluida** (ya está en los tokens): los tamaños grandes usan `clamp()` para crecer con la
pantalla sin saltos. Títulos: interlínea 0.95–1.1 y espaciado −0.015 a −0.03em. Etiquetas:
0.6875rem, mayúsculas, espaciado 0.2em. Párrafos: máximo ~36rem de ancho, `text-wrap: pretty`.

Un recurso que rinde: **una palabra del título en otra voz** (cursiva con serifa, o en el color
del acento) justo en la palabra que hace el trabajo.

## Luz y textura

- **Resplandor** (`.resplandor`): un radial del acento que baja desde arriba. Da aire a una
  portada o a un cierre sin recurso alguno.
- **Grano** (`.grano`): ruido de película al 3–5% encima de cualquier fondo plano o degradé. Es
  lo que hace que un degradé no se vea digital. Va también sobre videos y shaders.
- **Velo:** detrás de un texto que va sobre imagen o video, un radial oscuro blando centrado en
  el texto, y un degradé hacia `--tinta` en el borde inferior para que la banda siguiente empalme.
- **Vidrio:** superficie al 60% + `backdrop-filter: blur()` + línea. Solo sobre fondos con algo
  que desenfocar.
- **Borde de luz:** un `conic-gradient` que orbita por una propiedad registrada, con máscara
  para dejar solo el borde. Reservado para lo que se quiere que toquen.

## Movimiento: tres curvas, tres duraciones

| Uso | Curva | Duración |
|---|---|---|
| Entra o responde algo | `--curva-salida` (llega rápido, frena largo) | `--d-media` / `--d-larga` |
| Va y vuelve, cambia de lugar | `--curva-ida-vuelta` | `--d-media` |
| Algo que "salta" a su lugar (pastillas, figuritas) | `--curva-rebote` | `--d-corta` / `--d-media` |

Viajes cortos (10–16 px) y escalonado entre hermanos (60–80 ms). Si cada elemento de la página
entra con el mismo desvanecido, también se ve genérico: la entrada de la portada se diseña a
mano (qué primero, qué después); el resto usa `data-aparecer`.

## Antes de dar por cerrado el sistema

- [ ] Un solo acento; ningún color fuera de los tokens
- [ ] Tres voces, cada una en su rol
- [ ] Contrastes medidos
- [ ] La marca gigante, un título y un párrafo probados juntos a 375 y a 1280 px
- [ ] Se ve bien con el tema que corresponde (y con el otro, si el sitio lo ofrece)
