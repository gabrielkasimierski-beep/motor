---
name: componentes-vivos
description: Piezas sueltas con movimiento para sumar a una página que ya existe - carruseles 2D y 3D, tarjetas que se transforman, efectos de texto, fondos que reaccionan al puntero, botones de vidrio, cargadores de entrada, cintas infinitas. Usar cuando no hace falta una página entera sino un detalle ("un carrusel distinto", "un botón que reaccione", "que el título haga algo", "un loader", "una galería"), o al elegir cómo mostrar trabajos, productos, testimonios o pasos.
---

# Componentes vivos

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

No toda página necesita una escena. A veces falta **una** pieza: el botón que reacciona bien, el
carrusel que se puede arrojar. El detalle que se nota cuando está y no se ve cuando falta.

Kit: `kit/componentes/` · Demostración: `banco/carruseles.html`, `banco/detalles.html` ·
Recetas de todo el catálogo: [catalogo.md](catalogo.md)

## Cómo se elige

Se parte de **qué hay que mostrar**, no del efecto:

| Hay que mostrar | Pieza | Por qué |
|---|---|---|
| 4–8 trabajos con imagen o video | `tarjeta-video` en grilla | Cada tarjeta es su propia muestra: póster quieto, video al pasar |
| Muchas imágenes, sin jerarquía | `carrusel-anillo` | Se arroja y se explora; el lado lejano visible le da volumen |
| Productos con uno destacado | `carrusel-arco` | El enfocado queda derecho en la cima; los demás lo acompañan |
| 4–6 opciones con foto y epígrafe | `tarjetas-expandibles` | Todas a la vista, una abierta |
| Clientes, materiales, oficios | `marquesina` | Ocupa poco y llena de vida un borde entre bandas |
| Un proceso en pasos | `pasos-camino` | La línea que se dibuja lleva el ojo de paso en paso |
| Una frase que es el mensaje | `texto-foco` | Obliga a leer palabra por palabra |
| Una acción principal sobre una imagen | `boton-vidrio` | Se despega del fondo sin taparlo |
| Una marca con actitud | `estela-imagenes` | Juego puro; solo en escritorio |
| Un sitio con una escena pesada | `cargador-intro` | Convierte la espera en presentación, con progreso real |

## Reglas

1. **Una pieza llamativa por pantalla.** Dos compiten y ninguna gana.
2. **El contenido tiene que poder leerse sin la pieza:** el texto es texto real, las imágenes
   tienen `alt`, lo que se abre al pasar el puntero se abre también con foco y con toque.
3. **Un carrusel se maneja con todo:** arrastre con inercia, rueda horizontal, flechas del
   teclado, botones. Y arrastrarlo no traba el scroll vertical (`touch-action: pan-y`).
4. **El truco suele ser uno solo** y está en el comentario de cabecera de cada pieza. Antes de
   cambiar algo, leerlo: casi siempre lo que se quiere tocar es justo lo que la sostiene.
5. **Prefiera CSS a JavaScript y JavaScript a WebGL.** Propiedades registradas (`@property`) y
   transiciones resuelven muchísimo sin un bucle por cuadro.
6. **El cargador de entrada se muestra una vez por sesión** y nunca retiene a la persona más de
   lo que tarda la carga real.

## Los trucos que se repiten

- **Una sola rotación:** un arco o un abanico no calcula posición por tarjeta. Las tarjetas van
  en un contenedor que rota alrededor de un centro lejano; posición e inclinación salen solas.
- **Medir dos maquetas y viajar entre ellas:** la pastilla que se vuelve tarjeta es una sola
  superficie entre dos estados medidos (no una tarjeta que aparece detrás).
- **Maquetar al ancho final:** lo que se ensancha lleva el texto en un contenedor de ancho fijo;
  así no se reacomoda a mitad de camino.
- **Ordenar la profundidad a mano:** en un anillo 3D con CSS, el navegador no resuelve bien las
  tarjetas que se cruzan; el `z-index` se calcula por cuadro según el ángulo.
- **Espaciar por distancia, no por tiempo:** una estela deja una figura cada tantos píxeles
  recorridos, así queda pareja a cualquier velocidad del puntero.
- **Recorrido como función del tiempo:** si cada partícula está donde dice una fórmula de `t`,
  ir hacia atrás es exacto y gratis.
- **Volver a recortar en vez de escalar:** la foto que se abre se re-encuadra dentro de su
  marco; no se estira.
- **Dejar ver el lado de atrás:** en anillos y hélices, lo lejano se ve por los huecos,
  esmerilado; es lo que hace que se lea como un cilindro y no como una fila.

## Sumar una pieza al kit

1. Buscar en [catalogo.md](catalogo.md) la receta (mecanismo y truco).
2. Encargo cerrado a Sonnet: carpeta `kit/componentes/<pieza>/` con `.js` y `.css`, comentario
   de cabecera (qué es, el truco, cómo se usa), `destruir()`, táctil y "reducir movimiento".
3. Su banda en una página del banco y su fila en la tabla de arriba.

## Se comprueba

- [ ] Con teclado solo se puede usar entera, con el foco a la vista
- [ ] En táctil hace lo decidido y no traba el scroll
- [ ] Con "reducir movimiento" queda el estado final y se lee todo
- [ ] Con el doble de contenido y con la mitad sigue viéndose bien
- [ ] Al sacar la pieza de la página, lo demás no se rompe (`destruir()` limpia)
