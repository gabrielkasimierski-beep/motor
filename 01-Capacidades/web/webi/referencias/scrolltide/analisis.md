# Scrolltide — estudio del sitio

- **Sitio:** https://www.scrolltide.co/ · estudiado el 11-oct-2026
- **Qué es:** una biblioteca de pago de "prompts" para armar sitios con movimiento usando un editor
  con IA. No vende código: vende la descripción exacta de cada pieza. Además ofrece trabajos a
  medida ("The Studio") y una academia con 11 lecciones públicas.
- **Qué tomamos:** las **técnicas**, la **forma de clasificar** las piezas y el **método de
  trabajo** que cuentan en público. **Qué no:** sus textos, sus imágenes y videos, su código y sus
  prompts (son su producto y están detrás del pago; no se abrió ninguno ni se inició sesión).

## Cómo está hecho el sitio

| Capa | Qué usa |
|---|---|
| Base | Next.js (App Router, Turbopack) + Tailwind, desplegado en Vercel |
| Medios | Videos de muestra y pósters en un bucket aparte (Cloudflare R2), no en el repo |
| Tipos | Tres voces: una de título (grotesca variable, 800), una de lectura y una mono para etiquetas |
| Color | Fondo casi negro, texto en tres alturas, líneas = blanco al 8% y 14%, un acento frío con su par claro |
| Movimiento | Casi todo CSS: una curva de salida (`cubic-bezier(.22,1,.36,1)`), cintas con `translate(-50%)`, borde de luz con `@property` + `conic-gradient`, grano con `feTurbulence` |
| SEO | JSON-LD (organización y página), Open Graph con imagen propia, sitemap |

Bandas de la portada, en orden: aviso con oferta → nav pegada y translúcida → portada con canvas de
fondo, velo radial y degradé inferior → cinta del stack → biblioteca con filtros en pastillas y
tarjetas con video (póster, `preload="none"`, se reproduce al pasar) → una tarjeta distinta metida
en la grilla que ofrece trabajo a medida → cuatro estanterías más con la misma grilla → tres pasos
unidos por una línea → cifras en una grilla de líneas de 1 px → cierre con boletín → pie con la
marca gigante saliéndose por abajo.

## Las cinco estanterías

| Estantería | Cantidad | Familias |
|---|---|---|
| Plantillas | 117 | portada sola · página completa · sitio 3D · tienda · portfolio |
| Componentes | 46 | botón · tarjeta · texto · cargador · fondo · 3D |
| Shaders | 55 | degradé de malla · aurora · metal · semitono · remolino · celdas · llama (cada una en varias paletas) |
| Secciones | 18 | servicios · precios · contacto · llamado final · pie |
| Pantallas de app | 14 | panel · finanzas · comercio · salud · personas · proyectos · propiedades · medios |

## Lo importante: los mecanismos detrás de las plantillas

Las 117 plantillas se reducen a **ocho mecanismos**. Lo que cambia entre una y otra es el
recurso (el video, la imagen) y la dirección de arte, no la técnica.

| # | Mecanismo | Cómo funciona | Ejemplos de la biblioteca | Skill nuestra |
|---|---|---|---|---|
| 1 | **Película por cuadros con el scroll** | Un video de un solo movimiento continuo, pasado a 60–300 imágenes WebP; el scroll elige qué cuadro se dibuja en un canvas, dentro de un escenario fijo, con capítulos de texto y un cargador de progreso real | la gran mayoría de las páginas nuevas: producto que se desarma, recorrido por un lugar, giro de 360° | `pelicula-con-scroll` |
| 2 | **Video con el scroll** | Igual, pero moviendo la cabeza de reproducción de un video corto, con amortiguación | dos tomas de 10 s reproducidas con la barra | `pelicula-con-scroll` (variante) |
| 3 | **Video de portada que congela** | El clip se reproduce una vez y queda en su último cuadro exacto (no hace bucle); a veces un recorte del sujeto queda por encima del título gigante; o dos clips que comparten un cuadro de empalme; o bumerán | las portadas con animales en vuelo, producto que "aterriza" | `video-de-portada` |
| 4 | **Personaje que sigue al puntero** | Una secuencia de 45–190 cuadros de un personaje mirando alrededor; la posición del puntero elige el cuadro, con fundido, parpadeo entre poses y un paseo propio cuando nadie mueve | mascotas que miran el cursor | `escena-con-puntero` |
| 5 | **Foco que revela** | Dos imágenes idénticas salvo un detalle, una sobre otra; una ventana circular blanda sigue al puntero | retrato con máscara debajo | `escena-con-puntero` |
| 6 | **Profundidad por capas** | 3 a 11 imágenes planas recortadas por distancia, movidas a ritmos distintos; variante "portal" que atraviesa una puerta | paisajes, viajes, esculturas | `profundidad-por-capas` |
| 7 | **Escena 3D** | three.js: un objeto en el centro que el scroll posa, cámara por capítulos, vista explotada procedural, partículas que arman una figura, física, y el objeto que se acopla a un hueco del DOM | producto, espacio, cámaras, partículas | `escena-3d` |
| 8 | **Portada de movimiento simple** | Video o shader de fondo + tipografía cuidada + entradas escalonadas, pensada para un rubro | las ~45 portadas más viejas | `fondos-shader` + `secciones-de-pagina` |

Y un recurso que cruza todo: las **transiciones en WebGL** (una escena se disuelve en puntos de
semitono y se vuelve a pintar; un cargador de tela que se rasga). Quedan como receta avanzada
dentro de `escena-3d` y `fondos-shader`.

## Componentes: los trucos que valen la pena

- **Carruseles:** un anillo 3D con CSS (el lado lejano se ve por los huecos; el orden de
  profundidad se calcula a mano), un arco que es una sola rotación con el centro muy abajo, un
  abanico de naipes, hélices, un coverflow que pone las tarjetas de canto, astillas que se
  ensanchan sin que el texto se reacomode.
- **Tarjetas:** una pastilla que se convierte en tarjeta (una sola superficie entre dos maquetas
  medidas), carpeta con pestaña, pasos unidos por una línea que se dibuja, mazo que se arroja.
- **Texto:** foco de cámara que viaja palabra a palabra, palabra que se deshace y se rearma (el
  recorrido es función del tiempo, por eso el retroceso es exacto), letras cortadas por una grilla.
- **Fondos con puntero:** estela de imágenes espaciadas por distancia, lente de tramado, grilla
  que se hunde, vidrio acanalado.
- **Botones:** vidrio con bisel que persigue al puntero usando propiedades CSS registradas, sin
  bucle de JavaScript.
- **Cargador:** lema palabra por palabra → logo → la pantalla se abre → se saca solo.

## El método que cuentan (academia)

1. **La referencia primero.** Se elige un resultado ya visto, no se describe uno deseado. Una
   referencia por sección.
2. **Un pedido de una línea devuelve el promedio.** La ficha de una pieza nombra zonas, escala de
   tipos, colores, tiempos de animación, comportamiento del scroll, adaptación y dependencias.
3. **El recurso se fabrica antes que la página y en orden:** imagen → sujeto aislado → video →
   recorte del tramo → cuadros → alojamiento → recién ahí la página.
4. **La proporción se fija antes de animar**, nunca después.
5. **Un sujeto por imagen, sobre transparencia.** Una escena compuesta no se puede separar en capas.
6. **Bucle perfecto:** al generar el video, el cuadro final es el mismo archivo que el inicial.
7. **El movimiento del video, lento y sin cortes:** la persona maneja la cabeza de reproducción y
   se va a quedar parada justo en el corte.
8. **La cantidad de cuadros se elige contra el largo del escenario**, no contra la duración del clip.
9. **WebP para los cuadros; precargar; dibujar en canvas** (no cambiar el `src` de una imagen).
10. **Una sección por vez, quieta antes que en movimiento.** En 3D: geometría → materiales → scroll.
11. **Se corrige con una captura y una diferencia nombrada**, no con adjetivos. Un cambio por vez.
12. **Los parámetros que se afinan a ojo van a un panel con deslizadores**, no a otra vuelta de pedido.
13. **El fondo no es un detalle:** un objeto 3D sobre gris plano parece un prototipo.
14. **"Se ve bien de nuevo" no es "se arregló":** si el arreglo fue demasiado fácil, preguntar la causa.
15. **El 10% es lograr algo impresionante; el 90% es que parezca terminado.**

## Cómo quedó repartido en el Motor webi

| Lo que vimos | Dónde vive |
|---|---|
| Método de trabajo | `dirigir-sitio`, `fabricar-recursos`, `revisar-sitio` |
| Tokens, tipos, curvas, grano | `sistema-visual` → `kit/tokens.css` |
| Scroll, escenario fijo, aparecer | `motor-de-movimiento` → `kit/motor-scroll.js` |
| Mecanismos 1–7 | `pelicula-con-scroll`, `video-de-portada`, `escena-con-puntero`, `profundidad-por-capas`, `escena-3d` |
| Shaders | `fondos-shader` → `kit/fondo-shader.js` |
| Componentes | `componentes-vivos` → `kit/componentes/` |
| Secciones | `secciones-de-pagina` → `kit/secciones.css` |
| Pantallas de app | `pantallas-de-app` → `kit/graficos.js`, `kit/pantalla.css` |
| El propio estudio de un sitio | `estudiar-sitio` |

## Ideas de negocio que deja ver

- Venden **el resultado visto** (video de muestra de cada pieza) antes que la explicación: cada
  tarjeta es un video corto con póster. Sirve tal cual para mostrar nuestros trabajos.
- Dentro de la grilla meten una tarjeta que ofrece **trabajo a medida**. El catálogo es el anzuelo.
- Cada shader se entrega de tres formas (en vivo, video y foto): la misma pieza sirve para la
  portada, para un video de redes y para la imagen que se ve al compartir el link.
