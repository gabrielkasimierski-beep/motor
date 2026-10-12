---
name: pelicula-con-scroll
description: Película que avanza con el scroll - un video pasado a cuadros y dibujado en un canvas dentro de un escenario fijo, con capítulos de texto, llamadas ancladas y cargador de progreso real (el efecto de las páginas de producto "tipo Apple"). Usar cuando se pide que algo gire, se acerque, se desarme o se recorra al hacer scroll, "scroll scrubbing", "animación con el scroll", un producto en 360°, o un recorrido por un lugar manejado con la barra.
---

# Película con scroll

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

No es un video. En la web un video no se puede ubicar cuadro por cuadro con precisión, así que el
video se desarma en imágenes y la posición del scroll elige cuál se dibuja. **Es un problema de
cuadros, no de video:** cuando la secuencia existe y está precargada, lo demás es un número de 0 a 1.

Kit: `kit/cuadros.js` + `kit/motor-scroll.js` · Demostración: `banco/pelicula.html`

## Cuándo sí y cuándo no

> Hay dos formas de atar un video al scroll. **Esta** (cuadros en un canvas) es la precisa: capítulos,
> llamadas ancladas a una parte del producto y carga progresiva. `skill-cookie` mueve la cabeza de un
> clip corto que flota sobre la página y re-tiñe la paleta por variante: es más liviana y sirve para
> un producto que se abre o se parte con dos a cuatro sabores o colores. Se elige una, no las dos.

- **Sí:** un solo movimiento continuo que vale la pena manejar con el dedo: un producto que
  gira o se desarma, un acercamiento, un recorrido.
- **No:** si hay cortes de cámara (la persona se va a parar justo en el corte); si el movimiento
  no dice nada del producto; si el negocio necesita que lo llamen en diez segundos y la película
  demora el botón.

## Armado

```html
<section data-escenario style="--largo: 400vh">
  <div data-escena>
    <canvas id="pelicula" style="width:100%;height:100%"></canvas>
    <!-- capítulos, llamadas, cargador: HTML encima del canvas -->
  </div>
</section>
```
```js
import { crearCuadros, conScroll } from "./kit/cuadros.js";
const pelicula = crearCuadros(canvas, {
  fuente: "medios/cuadros/toma-####.webp", total: 120,
  foco: [0.5, 0.45],                       // qué punto no se recorta nunca (el sujeto)
  alCargar: p => barra.style.scale = `${p} 1`,
});
conScroll(pelicula, escenarioEl);
```

## Decisiones, en orden

1. **El recurso** (skill `fabricar-recursos`): un movimiento, lento, sin cortes, en la proporción final.
2. **Cuántos cuadros contra cuánto escenario.** El último cuadro tiene que caer justo cuando el
   escenario suelta. Guía: **30–40 cuadros por cada 100vh** de pista. Con 120 cuadros, 300–400vh.
   Con menos, se ve el escalón; con más, sobra peso. La cantidad no se cambia después sin rehacer
   lo de abajo: se decide acá.
3. **El recorte.** El canvas "cubre" como un `object-fit: cover`. `foco` dice qué punto se
   conserva; en vertical el recorte es fuerte: si el sujeto no entra, se hace una segunda
   secuencia vertical o se usa "contener" con el fondo extendido.
4. **Los capítulos.** Tres a cinco. Cada texto entra, queda quieto para leerse y sale
   (`capitulos()`); alternan de lado para no tapar al sujeto. El texto se oculta hasta que la
   película tiene algo para mostrar.
5. **Las llamadas ancladas.** Una línea fina y una etiqueta mono que señalan una parte del
   producto. Se anclan con `pelicula.punto(x, y)` (coordenadas de 0 a 1 **en la imagen fuente**),
   así quedan sobre el mismo lugar con cualquier recorte y tamaño.
6. **La carga.** Lo primero que se ve es el póster (el cuadro 1 como imagen liviana). Los cuadros
   se piden cuando la sección se acerca; el cargador muestra el progreso **real** (`alCargar`).
   La carga es progresiva: con una de cada ocho ya se puede recorrer.
7. **La salida.** Qué pasa cuando el escenario suelta: el último cuadro puede quedar como fondo
   de la banda siguiente, o el sujeto "pasa" a un elemento del DOM (una foto en una tarjeta con la
   misma pose).

## Variantes

- **Varias tomas en una pista:** dos secuencias que comparten el cuadro de empalme (el último de
  una es el primero de la otra); cada una en su tramo (`conScroll(pelicula, el, { tramo: [0, .5] })`).
- **Video con el scroll** (`videoConScroll` de `kit/video-portada.js`): mover la cabeza de
  reproducción de un clip corto **todo-intra** (`--intra`). Pesa menos que los cuadros, pero es
  menos preciso y en celulares viejos tartamudea. Sirve para tramos de fondo, no para un producto.
- **Mundo que cambia bajo un sujeto fijo:** el sujeto en una secuencia en bucle (corriendo,
  caminando) y por detrás fondos que se funden por capítulo.
- **El título gigante detrás del sujeto:** el texto va debajo del canvas y la secuencia tiene
  transparencia (WebP con alfa), o se usa un recorte del sujeto por encima.

## Errores que ya conocemos

- Cambiar el `src` de una `<img>` en vez de dibujar en canvas: parpadea y pide de nuevo.
- No precargar: el recorrido muestra cuadros en blanco.
- Movimiento rápido en el video: entre cuadros muestreados queda un tartamudeo que no se arregla
  con código. Se regenera más lento.
- Giros "fingidos" deformando una foto: se notan a los costados. El giro real es un video
  (aprendido en Carta Viva).
- Escenario dentro de un ancestro con `overflow: hidden`: no pega.

## Se comprueba

- [ ] El primer cuadro y el último caen en los extremos exactos del escenario
- [ ] Subiendo y bajando rápido no hay cuadros en blanco ni saltos
- [ ] Rueda y trackpad se sienten parecidos
- [ ] En 375 px el sujeto se ve entero y los textos no lo tapan
- [ ] Peso total de cuadros dentro de la ficha; el botón principal responde durante la carga
- [ ] Con "reducir movimiento" sigue respondiendo al scroll, sin inercia
