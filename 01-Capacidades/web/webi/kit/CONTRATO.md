# Kit webi — contrato

> Vive en `C:/Claude/Motor/01-Capacidades/web/webi/`. Las rutas de este archivo (`kit/`, `banco/`,
> `herramientas/`) son relativas a esa carpeta.

El kit es el código base que usan las skills. Cada skill dice **qué** pieza usar y **cómo decidir**;
el kit es la pieza ya probada. Este archivo es la fuente de verdad de nombres, firmas y reglas: si
el código y el contrato no coinciden, se corrige el que esté mal y se actualiza el otro.

## Reglas para todo el kit

1. **Sin dependencias ni paso de compilación.** Módulos ES (`export`), se cargan con
   `<script type="module">`. La única excepción es `escena3d.js`, que trae three.js por `importmap`
   desde CDN y solo cuando la escena está por entrar en pantalla.
2. **Nombres y comentarios en español.** Comentarios cortos que dicen el porqué, no el qué.
3. **Cada pieza se limpia sola:** toda función que engancha algo devuelve un objeto con
   `destruir()` (saca listeners, observers y bucles).
4. **Nada trabaja fuera de pantalla.** Lo que anima se pausa con `IntersectionObserver` y con
   `document.hidden`.
5. **"Reducir movimiento" se respeta siempre:** la pieza muestra su estado final quieto (un cuadro,
   una imagen, el texto ya puesto). Nunca queda rota ni vacía.
6. **Sin puntero también anda.** Lo que sigue al cursor define qué hace en táctil (queda en reposo,
   se mueve solo o responde al arrastre). Es una decisión, no un accidente.
7. **El color y la tipografía salen de `tokens.css`.** Ninguna pieza trae un color fijo propio; si
   necesita uno, lo recibe como opción o lo lee de una variable CSS.
8. **El `devicePixelRatio` se limita** (`dprMax`, por defecto 2; en shaders 1.5).
9. **Estados con clases** `es-…` / `se-…` (`es-activa`, `se-ve`, `esta-lista`), datos con `data-…`.

## Mapa

```
kit/
  tokens.css            sistema visual (roles fijos, valores por marca) + base mínima
  motor-scroll.js       progreso de scroll, escenario fijo, aparecer, bucle, amortiguar
  cuadros.js            película por cuadros sobre canvas (con scroll o con puntero)
  video-portada.js      video de portada: una vez y congela, bucle, bumerán, con scroll
  capas.js              profundidad por capas: paralaje, portal, deriva con el puntero
  puntero.js            puntero suavizado + foco que revela una segunda imagen
  fondo-shader.js       fondos en GPU: 7 familias, paleta por opción
  escena3d.js           three.js dormido: escena, cámara por capítulos, partículas, acople al DOM
  graficos.js           gráficos en SVG para pantallas de app
  pantalla.css          maqueta de una pantalla de app (riel, cabecera, mosaicos, tabla, estados)
  secciones.css / .js   las bandas de una página y lo mínimo que piden
  componentes/          piezas sueltas (una carpeta por pieza: .js y/o .css)
banco/                  banco de pruebas: una página por pieza, es la demostración y el ejemplo de uso
herramientas/           video-a-cuadros, servidor local, vista previa de un archivo
```

## `motor-scroll.js`

```js
export const curvas            // { salida, idaVuelta, rebote } como funciones t→t (0..1)
export function limitar(v, min = 0, max = 1)
export function mapear(v, a, b, c, d, conLimite = true)      // v de [a,b] a [c,d]
export function amortiguar(actual, objetivo, lambda, dt)     // suavizado que no depende de los fps.
                                                             // lambda = fracción por cuadro a 60 fps (0.1 = 10%); ≤0 o ≥1 va directo.
                                                             // Es la misma escala que las opciones `suavizar` de todo el kit.
export function reducido()                                   // true si pide reducir movimiento (se lee en vivo)

// Un solo requestAnimationFrame para toda la página. cb(t, dt) en segundos. Se frena con la pestaña oculta.
export function bucle(cb)                                    // → { destruir() }

// Progreso 0..1 de un elemento cruzando la pantalla. Solo calcula mientras está cerca del viewport.
//   tramo: "cruza" (entra por abajo → sale por arriba) | "entra" (asoma → queda arriba) | "dentro" (para escenarios fijos)
//   suavizar: 0 = directo; 0.08–0.15 = con inercia
export function alScroll(el, cb /* (p, { velocidad, direccion }) */, { tramo = "cruza", suavizar = 0 } = {})  // → { destruir() }

// Escenario fijo: una pista alta con un hijo pegado (position: sticky). No usa "pin" por JS.
//   <section data-escenario style="--largo: 400vh"><div data-escena>…</div></section>
// Devuelve el progreso 0..1 de la pista (y lo deja en --progreso sobre [data-escena], para usarlo desde CSS).
// capitulos reparte ese progreso en tramos.
export function escenario(el, cb /* (p, info) */, { suavizar = 0.1 } = {})                                    // → { destruir() }
export function capitulos(p, cortes /* [0, .25, .6, 1] */)  // → { indice, local }  (local = 0..1 dentro del capítulo)

// Aparecer al entrar: suma .se-ve a los [data-aparecer]; escalona a los hermanos con --demora
// (respeta una --demora escrita a mano; el escalonado se corta a los 12 pasos).
export function aparecer(raiz = document, { escalon = 70, margen = "0px 0px -10% 0px", unaVez = true } = {}) // → { destruir() }

// Scroll suave opcional (inercia propia, sin librería). Solo con rueda/trackpad; en táctil no se toca.
export function scrollSuave({ fuerza = 0.1 } = {})                                                           // → { destruir() }
```

CSS que acompaña (lo inyecta el módulo una sola vez):
`[data-escenario]{position:relative;height:var(--largo,300vh)}`
`[data-escena]{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}`

## `cuadros.js`

```js
// Película por cuadros. fuente: patrón con # ("medios/cuadros/toma-####.webp", empieza en 1)
//   o una hoja: { hoja: "toma.webp", columnas, filas }.
export function crearCuadros(canvas, {
  fuente, total,
  encaje = "cubrir",          // "cubrir" | "contener"
  foco = [0.5, 0.5],          // qué punto de la imagen no se recorta nunca al cubrir
  mezclar = true,             // funde el cuadro con su vecino cuando el índice cae entre dos
  dprMax = 2,
  alCargar,                   // (0..1) progreso REAL de carga, para el cargador
}) // → { lista: Promise, ir(p), irA(indice), punto(x, y), total, destruir() }
//   ir(p): p de 0..1.  irA(indice): desde 0, puede ser fraccionario.
//   punto(x, y): x,y de 0..1 en la imagen FUENTE → {x, y} en px dentro del canvas
//   (para anclar llamadas a un punto del cuadro aunque cambie el recorte).
//   lista resuelve con { cargados, fallidos, total }; se rechaza solo si no llegó ningún cuadro.

// Carga progresiva: primero el cuadro 1, después 1 de cada 8, de cada 4, de cada 2, todos.
// Mientras falta un cuadro se dibuja el cargado más cercano: se puede usar antes de terminar.

export function conScroll(pelicula, elEscenario, { tramo = [0, 1], suavizar = 0.12 } = {})   // → { destruir() }
export function conPuntero(pelicula, zona, {
  eje = "x",                  // "x" | "y"
  suavizar = 0.14,
  reposo = { tras: 6000, modo: "barrido" },   // qué hace si nadie mueve el puntero: "barrido" | "quieto"
} = {})                                                                                     // → { destruir() }
```

## `video-portada.js`

```js
// modo: "una-vez" (reproduce y congela en su último cuadro) | "bucle" | "bumeran" (va y vuelve, sin corte)
//   final: <img> con el último cuadro exacto del video; se muestra al terminar para que el empalme no se vea.
//   recorte: <img> PNG/WebP con alfa del sujeto del último cuadro, que queda ENCIMA del título.
export function videoPortada(video, { modo = "una-vez", final = null, recorte = null, alTerminar } = {})  // → { reproducir(), destruir() }

// El scroll mueve la cabeza de reproducción (para clips cortos codificados todo-intra, -g 1).
export function videoConScroll(video, elEscenario, { suavizar = 0.12 } = {})                              // → { destruir() }
```

## `capas.js`

```js
// Profundidad sin 3D: capas planas que se mueven a ritmos distintos.
//   capas: [{ el, profundidad /* 0 = fondo lejano, 1 = primer plano */, escala: [de, a], y: [de, a] en % }]
//   La más cercana se mueve más. puntero suma una deriva chica encima.
export function capas(elEscenario, { capas, puntero = { fuerza: 10 }, suavizar = 0.1 } = {})  // → { cambiar(opciones), destruir() }

// Portal: la capa "puerta" crece hasta pasar por encima del que mira.
export function portal(elEscenario, { puerta, fondo, frente = [], escalaFinal = 9, origen = [0.5, 0.5], suavizar = 0.1 } = {}) // → { cambiar(opciones), destruir() }
```

`cambiar(opciones)` existe en todo lo que se afina a ojo (`capas`, `portal`, `foco`, `videoConScroll`,
`fondoShader`): es lo que usa el panel de deslizadores del banco.

```js
```

## `puntero.js`

```js
export function puntero(zona, { suavizar = 0.15 } = {})   // → { x, y (0..1 suavizados), dentro, tipo ("mouse"|"pen"|"touch"), alMover(cb), destruir() }

// Foco que revela: dos imágenes idénticas salvo lo que se revela, una encima de la otra.
// Abre una ventana circular de borde blando en la de arriba. En táctil sigue al dedo; sin interacción pasea sola.
export function foco(elArriba, { radio = 260, nucleo = 0.4, suavizar = 0.18 } = {})           // → { destruir() }
```

## `fondo-shader.js`

```js
// familia: "malla" | "aurora" | "metal" | "semitono" | "remolino" | "celdas" | "llama"
export function fondoShader(canvas, {
  familia = "malla", paleta = null /* hasta 5 colores; por defecto lee los tokens */,
  velocidad = 1, escala = 1, grano = 0.04, semilla = 0, puntero = false, dprMax = 1.5,
} = {}) // → { pausar(), reanudar(), cambiar(opciones), foto() /* Promise<Blob PNG> */, grabar(segundos) /* Promise<Blob webm> */, destruir() }
```

El canvas lleva su estado en `data-fondo`: `activo` | `pausado` (fuera de pantalla o pestaña oculta) |
`quieto` (reducir movimiento) | `respaldo` (sin WebGL: degradé CSS de la paleta), y la clase
`esta-lista` cuando dibujó su primer cuadro.

## `secciones.js` (acompaña a `secciones.css`)

```js
export function navQueSeAsienta(nav)            // gana fondo y línea al bajar; maneja el menú móvil ([data-menu])
export function filtrar(raiz)                   // pastillas [data-filtro] que muestran/ocultan tarjetas [data-categoria]
export function contar(raiz)                    // [data-contar="1250"] cuenta desde 0 al entrar, con miles es-AR
export function cuentaRegresiva(el, fechaISO)
export function alternarPrecios(raiz)           // interruptor que cambia importes con data-mensual / data-anual
export function mensajeWhatsApp(form, { numero }) // arma el mensaje con los campos y abre wa.me; no manda nada a un servidor
```
Todas devuelven `{ destruir() }`. El color de error de formulario es `--color-error` (si la marca no lo
define, usa `--hueso`, con ícono y texto: nunca solo color).

## `escena3d.js`

```js
// Carga three.js recién cuando el contenedor está por entrar en pantalla.
export function escena3d(contenedor, armar /* async ({ THREE, escena, camara, render, contenedor }) => ({ cuadro(t, dt, p), alRedimensionar?(w, h), destruir?() }) */,
  { fondo = null, dprMax = 2, suavizar = 0.1, fov } = {})                  // → { lista: Promise, suavizar(v), redibujar(), destruir() }
//   `render` es el THREE.WebGLRenderer. El contenedor recibe `esta-lista` al dibujar y `sin-3d` si no hay WebGL.
export function camaraPorCapitulos(camara, poses /* [{ pos:[x,y,z], mira:[x,y,z] }] */)  // → (p) => void
export function particulasAFigura(THREE, { puntos /* Float32Array destino */, cantidad, color, tamano, dispersion, aditivo, semilla })  // → { malla, avanzar(p, t?) }
export function acoplar(objeto3d, camara, elDom, { ajuste } = {})  // → { posicion: Vector3, escala } para que el objeto caiga sobre un hueco del DOM
export async function puntosDeTexto(texto, { fuente, cantidad })   // → Float32Array (espera a que cargue la fuente)
export function luzDeEstudio(THREE, escena)      // principal + relleno + contraluz del color del acento
export function entornoDeEstudio(THREE, render)  // reflejos de estudio para vidrio y metal
export function colorToken(nombre, el)           // lee un color de tokens.css como THREE.Color
```

## `graficos.js`

```js
// Todos devuelven un <svg> (con su destruir() colgado) que toma los colores de las variables CSS.
// datos: [{ etiqueta, valor }] · barras admite valor2, nombres, escalaDoble y formato2 · dona admite centro
// · matriz recibe number[][] · además se exportan formatos (es-AR: "120 mil", "1,5 M") y escalaLinda.
export function barras(datos, opciones)   export function area(datos, opciones)   export function chispa(valores, opciones)
export function dona(datos, opciones)     export function dial(valor, opciones)   export function matriz(valores, opciones)
```

## `componentes/`

Una carpeta por pieza, con `<pieza>.js` y `<pieza>.css` (el `.js` no inyecta estilos: la página
linkea el `.css`). El comentario de cabecera de cada una dice qué es, el truco que la sostiene y el
HTML que espera. Todas devuelven `{ destruir() }`.

| Pieza | Exporta | Además devuelve |
|---|---|---|
| `marquesina` | `marquesina(el)`, `marquesinas(raiz)` | — (`data-sentido`, `data-eje`, `data-velocidad` = segundos por vuelta) |
| `tarjeta-video` | `tarjetaVideo(el)`, `tarjetasVideo(raiz)` | — |
| `carrusel-anillo` | `carruselAnillo(el)` | `ir(i)`, `siguiente()`, `anterior()`, `indice` |
| `carrusel-arco` | `carruselArco(el)` | `ir(i)`, `siguiente()`, `anterior()`, `indice` |
| `tarjetas-expandibles` | `tarjetasExpandibles(el)` | `abrir(i)`, `actual` |
| `boton-vidrio` | `botonVidrio(el)` | — (sin JS igual se ve bien; no desenfoca dentro de un ancestro con `opacity`, `filter` o `mask`) |
| `cargador-intro` | `cargadorIntro({ lema, logo, alTerminar, alAbrir, siempre, recordar, conProgreso, maxEspera })` | `progreso(p)`, `saltar()` |
| `texto-foco` | `textoFoco(el, { con: "tiempo" \| "scroll" })`, `textosFoco(raiz)` | — |
| `estela-imagenes` | `estelaImagenes(el, { imagenes })` | — (en táctil no hace nada) |
| `pasos-camino` | `pasosCamino(el)` | — |

Antes de usar una pieza, leer su cabecera: las opciones exactas están ahí.

## Banco de pruebas

Cada página de `banco/` carga `../kit/tokens.css`, usa la pieza con datos de muestra y deja a la
vista los parámetros que se afinan a ojo (un panel chico con deslizadores). `banco/index.html` es el
índice. Los medios de muestra están en `banco/medios/` (`muestra.mp4`, `muestra-poster.jpg`,
`muestra-final.jpg`, `cuadros/muestra-0001.webp` … `muestra-0120.webp`, 960×540).
