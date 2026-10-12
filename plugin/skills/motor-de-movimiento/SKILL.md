---
name: motor-de-movimiento
description: La base de movimiento de un sitio - progreso de scroll, escenarios fijos por capítulos, entradas al aparecer, scroll suave, amortiguación y reglas de rendimiento, con kit/motor-scroll.js. Usar al atar cualquier cosa al scroll, armar una sección que se queda fija mientras pasa algo, sumar entradas a una página, decidir si hace falta GSAP, Lenis o React, o cuando el scroll se siente trabado o brusco.
---

# Motor de movimiento

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

Casi todo lo que se ve "de agencia" son cuatro ideas: **un progreso de 0 a 1**, **un escenario que
se queda fijo**, **capítulos** que reparten ese progreso, y **amortiguación** para que nada sea
brusco. Están en `kit/motor-scroll.js` (firmas en `kit/CONTRATO.md`).

## Qué stack

| Situación | Se usa |
|---|---|
| Sitio de un negocio, landing, portfolio | HTML + CSS + el kit. Sin compilación: se publica la carpeta |
| Líneas de tiempo largas con muchas piezas coordinadas | Sumar GSAP por CDN **solo** para esa escena |
| Tienda o app con muchas pantallas y estado | Next.js; el kit se importa igual (son módulos ES) |
| 3D | three.js, dormido hasta que haga falta (`escena-3d`) |

No se suma una librería para algo que el kit ya hace. Cada dependencia es peso y una cosa más que
puede romperse.

## Las cuatro ideas

### 1. Progreso
`alScroll(el, cb, { tramo })` da un número de 0 a 1 según por dónde va el elemento:
`"cruza"` (de que asoma por abajo a que se va por arriba), `"entra"` (de que asoma a que llega
arriba) y `"dentro"` (mientras la pantalla recorre un elemento más alto que ella). Todo efecto de
scroll es ese número pasado por `mapear()` hacia una propiedad.

### 2. Escenario fijo
```html
<section data-escenario style="--largo: 400vh">
  <div data-escena> … lo que queda quieto … </div>
</section>
```
Una pista alta y un hijo con `position: sticky`. **No se "pinea" con JavaScript:** el navegador
lo hace mejor y sin saltos. `escenario(el, cb)` da el progreso de la pista.

Cuánto mide: **~100vh por cada cosa que pasa**. Tres capítulos → 300–400vh. Más corto se siente
apurado; más largo, que la página no avanza.

### 3. Capítulos
`capitulos(p, [0, .25, .6, 1])` devuelve en qué tramo se está y el progreso local dentro de él.
Cada capítulo tiene una entrada, un tiempo quieto para leer y una salida: el texto no puede
moverse mientras se lo lee. Los textos de capítulos alternan de lado para no tapar al sujeto.

### 4. Amortiguación
`amortiguar(actual, objetivo, lambda, dt)` acerca un valor a otro de forma pareja a cualquier
cantidad de cuadros por segundo. Se usa en todo lo que sigue algo: scroll, puntero, cámara.
`suavizar` entre 0.08 y 0.15 para scroll; 0.14–0.2 para puntero. Con "reducir movimiento" va en 0.

## Entradas

`data-aparecer` en el elemento + `aparecer()` una vez. Los hermanos que entran juntos se
escalonan solos. Es para el cuerpo de la página; la entrada de la portada se compone a mano.

## Scroll suave

`scrollSuave()` da inercia a la rueda y al trackpad. Se enciende **solo** si hay escenas atadas
al scroll que lo agradecen; en una página de lectura molesta. Nunca toca el scroll táctil.

## Reglas de rendimiento

1. **Un solo bucle** (`bucle()`), no un `requestAnimationFrame` por pieza.
2. **Se mide una vez por cuadro**, no en cada evento de scroll. Nada de leer y escribir el DOM
   intercalado.
3. **Solo `transform` y `opacity`** en lo que se mueve con el scroll. Nada de `top`, `width`,
   `filter` animado ni sombras que cambian.
4. **Nada trabaja fuera de pantalla:** `IntersectionObserver` enciende y apaga.
5. `will-change` solo mientras la pieza está activa.
6. Imágenes y videos con ancho y alto declarados, para que la página no salte al cargar.
7. Con `overflow: hidden` en un ancestro, `sticky` deja de pegar: usar `overflow-x: clip`.
8. En celular `100vh` incluye la barra del navegador: los escenarios usan `100svh`.

## Probar

`banco/pelicula.html` muestra las cuatro ideas juntas (escenario, capítulos, progreso, carga).
Al tocar el motor: correr todas las páginas del banco, porque todas dependen de él.
