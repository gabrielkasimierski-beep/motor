---
name: escena-con-puntero
description: Escenas que responden al puntero - un personaje o producto que gira para mirar el cursor (secuencia de cuadros manejada con el puntero) y un foco que revela una segunda imagen debajo de la primera. Usar cuando se pide una mascota que siga el mouse, "que la cabeza siga al cursor", un producto que se gire al mover el puntero, un efecto de linterna, rayos X, antes y después con el cursor, o "hover reveal".
---

# Escena con puntero

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

Son las piezas que la gente le manda a un amigo: la página **mira** a quien la mira. Hay dos y
comparten una regla: el efecto es simple; lo difícil es el recurso.

Kit: `kit/cuadros.js` (`conPuntero`), `kit/puntero.js` (`foco`) ·
Demostración: `banco/personaje.html`, `banco/foco.html`

## A. El personaje que mira

Una secuencia de cuadros de un personaje (o un producto) moviéndose de un lado al otro. La
posición del puntero elige el cuadro. No hay 3D ni huesos: es la misma película por cuadros de
`pelicula-con-scroll`, con el puntero en lugar del scroll.

```js
import { crearCuadros, conPuntero } from "./kit/cuadros.js";
const mirada = crearCuadros(canvas, { fuente: "medios/cuadros/mira-####.webp", total: 91, encaje: "contener" });
conPuntero(mirada, document.body, { eje: "x", reposo: { tras: 6000, modo: "barrido" } });
```

**Niveles, de menos a más recurso:**

| Nivel | Recurso | Cómo se siente |
|---|---|---|
| Dos poses + parpadeo | ~45 cuadros: mira a un lado, parpadea, mira al otro | Simpático; el parpadeo tapa el cambio. El parpadeo se reproduce a su propio ritmo, no al del puntero |
| Un eje | 50–100 cuadros de izquierda a derecha | Sigue al puntero en horizontal (o en vertical: la altura del cursor) |
| Todas las direcciones | ~190 cuadros de un "mirar alrededor" | Para cada posición del puntero se busca el cuadro cuya pose más se le parece, y se viaja hasta él por el camino corto |

**Lo que lo hace creíble:**
- **Amortiguado** (`suavizar` 0.12–0.18): la cabeza llega un instante después que el cursor.
- **Fundido entre cuadros** (`mezclar`), para que no se vea el escalón con pocos cuadros.
- **Reposo:** si nadie mueve durante unos segundos, mira alrededor por su cuenta. Un personaje
  clavado mirando a un costado parece roto.
- **Toda la página es la zona**, no solo el recuadro del personaje.
- El personaje sobre **fondo liso o transparente**, con la cámara fija: solo se mueve él.

**En táctil** no hay cursor. Se decide a propósito: hace su paseo solo, o sigue el arrastre del
dedo. Nunca queda mirando a la nada.

## B. El foco que revela

Parece un problema de shaders y no lo es: son **dos imágenes apiladas** y una ventana circular de
borde blando recortada en la de arriba, en la posición del puntero.

```html
<div class="foco">
  <img src="medios/abajo.webp" alt="…">            <!-- lo revelado -->
  <img src="medios/arriba.webp" alt="" id="arriba"> <!-- lo que se ve normalmente -->
</div>
```
```js
import { foco } from "./kit/puntero.js";
foco(document.querySelector("#arriba"), { radio: 260, nucleo: 0.4 });
```

**Todo depende de que las dos imágenes sean idénticas salvo lo que se revela.** Pose, luz y
encuadre calzados al píxel. Si algo se corre, el foco muestra una cara que salta, y eso no tiene
arreglo en CSS: se regenera la imagen (skill `fabricar-recursos`, "par para el foco").

**Afinar el foco** (con el panel de deslizadores, a ojo, un número por vez):
- Punto de partida para un sujeto del tamaño de una cara: **radio 260 px, núcleo sólido hasta el
  40% y de ahí desvanece**.
- El primer intento suele salir demasiado grande (muestra todo el truco de una vez y mata el
  misterio) y la corrección, demasiado chica. Equivocarse dos veces es el camino normal.
- **El borde blando importa más que el radio:** un círculo duro se lee como un recorte; uno
  blando, como luz.
- El radio se dimensiona contra el sujeto, no contra la pantalla.

**Usos para un negocio:** el mueble terminado y su plano; el plato y sus ingredientes; la fachada
de día y de noche; el antes y el después de una obra; la prenda y su tela de cerca.

**En táctil:** el foco sigue al dedo mientras arrastra y, sin interacción, pasea solo y lento por
la zona interesante. Con "reducir movimiento": la ventana queda quieta en el punto que más dice.

## Se comprueba

- [ ] Con el puntero quieto no se ve temblor ni salto
- [ ] El reposo arranca y se corta apenas se mueve el puntero
- [ ] Las dos imágenes del foco, superpuestas al 100%, no se corren
- [ ] En el celular la pieza hace algo que se entiende sin instrucciones
- [ ] Con "reducir movimiento" queda un estado quieto y digno
