/* estela-imagenes.js — figuritas sobre el recorrido del puntero.

   QUÉ ES: un envoltorio que deja imágenes chicas detrás del puntero. Aparecen con un salto
   corto, se quedan un momento y se desvanecen. El contenido de adentro no se toca.

   EL TRUCO: se espacian por DISTANCIA recorrida, no por tiempo. En cada pointermove se toma el
   tramo recto desde la posición anterior y se reparten figuritas a pasos exactos de `distancia`
   px sobre él, arrastrando el resto al tramo siguiente. Así la estela es pareja a cualquier
   velocidad (si el mouse salta 400 px de golpe caen 4 figuritas en fila, escalonadas apenas en
   el tiempo para que se lean como un trazo). Las figuritas salen de un pozo fijo de <img>
   (maxVivas): cuando se acaba, se recicla la más vieja. La animación es la Web Animations API
   (sin bucle por cuadro) y las curvas se leen de las variables de tokens.css.

   TÁCTIL: no hace nada (se ignoran los eventos táctiles). REDUCIR MOVIMIENTO: tampoco.
   Las figuritas y la capa tienen pointer-events: none, así los links y botones de abajo andan.

   USO:
     <section class="estela-imagenes" data-estela data-imagenes="a.webp b.webp c.webp"> … </section>
     import { estelaImagenes } from "…/estela-imagenes.js";
     const e = estelaImagenes(document.querySelector("[data-estela]"), {
       imagenes: ["a.webp", "b.webp"],    // o data-imagenes en el HTML
       distancia: 90,                     // px entre figuritas
       tamano: 176,                       // px de ancho
       vida: 1100,                        // ms desde que aparece hasta que desaparece
       maxVivas: 12, giro: 9, deriva: 14, detras: false,
     });
     e.destruir();
*/
import { reducido } from "../../motor-scroll.js";

const MAX_POR_MOVIMIENTO = 8; // tope por si el puntero reaparece lejos de golpe
const ESCALON = 40; // ms entre figuritas de un mismo salto de puntero

export function estelaImagenes(contenedor, {
  imagenes = null,
  distancia = 90,
  tamano = null,
  vida = 1100,
  maxVivas = 12,
  giro = 9,
  deriva = 14,
  detras = false,
} = {}) {
  const nada = { destruir() {} };
  if (!contenedor) return nada;
  const lista = (imagenes || (contenedor.dataset.imagenes || "").split(/[\s,]+/)).filter(Boolean);
  if (!lista.length) { console.warn("estelaImagenes(): faltan imágenes", contenedor); return nada; }

  contenedor.classList.add("estela-imagenes");
  if (detras) contenedor.classList.add("estela-imagenes--detras");
  if (tamano) contenedor.style.setProperty("--estela-tamano", tamano + "px");

  const capa = document.createElement("div");
  capa.className = "estela-imagenes__capa";
  capa.setAttribute("aria-hidden", "true");
  contenedor.append(capa);

  // Las imágenes se bajan ya, para que la primera figurita no aparezca con retraso
  for (const url of lista) {
    const pre = new Image();
    pre.src = url;
    pre.decode?.().catch(() => {});
  }

  // Curvas desde los tokens (si faltan, una palabra clave: nunca un número copiado)
  const estilo = getComputedStyle(contenedor);
  const curva = (variable, resguardo) => estilo.getPropertyValue(variable).trim() || resguardo;
  const C = {
    rebote: curva("--curva-rebote", "ease-out"),
    salida: curva("--curva-salida", "ease-out"),
    vuelta: curva("--curva-ida-vuelta", "ease-in-out"),
  };

  // ---- Pozo de figuritas ----
  const fichas = [];
  let turno = 0;
  let siguiente = Math.floor(Math.random() * lista.length);

  function crear() {
    const img = document.createElement("img");
    img.className = "estela-imagenes__figura";
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    return { img, ultima: null, activa: false, nacio: 0 };
  }
  function tomar() {
    let ficha = fichas.find((f) => !f.activa);
    if (!ficha && fichas.length < maxVivas) {
      ficha = crear();
      fichas.push(ficha);
    }
    if (!ficha) ficha = fichas.reduce((a, b) => (a.nacio <= b.nacio ? a : b)); // la más vieja
    ficha.ultima?.cancel();
    ficha.nacio = ++turno;
    capa.append(ficha.img); // lo último en el DOM queda arriba
    return ficha;
  }

  function soltar(x, y, ux, uy, orden) {
    const ficha = tomar();
    const lado = (Math.random() - 0.5) * 2 * deriva; // desvío chico, perpendicular al recorrido
    ficha.img.style.left = (x - uy * lado).toFixed(1) + "px";
    ficha.img.style.top = (y + ux * lado).toFixed(1) + "px";
    ficha.img.src = lista[siguiente];
    siguiente = (siguiente + 1) % lista.length;

    const g = ((Math.random() - 0.5) * 2 * giro).toFixed(2);
    // Misma lista de funciones en todos los cuadros: así interpola cada una por separado
    const pose = (dx, dy, escala) => `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${g}deg) scale(${escala})`;
    const anim = ficha.img.animate(
      [
        { opacity: 0, transform: pose(0, 14, 0.5), offset: 0, easing: C.rebote }, // el salto: sube pasándose un poco
        { opacity: 1, transform: pose(0, 0, 1), offset: 0.2, easing: C.salida },
        { opacity: 1, transform: pose(ux * 10, uy * 10, 1), offset: 0.62, easing: C.vuelta },
        { opacity: 0, transform: pose(ux * 22, uy * 22 - 8, 0.9), offset: 1 },
      ],
      { duration: vida, delay: orden * ESCALON, fill: "both" }
    );
    ficha.ultima = anim;
    ficha.activa = true;
    anim.onfinish = () => { if (ficha.ultima === anim) ficha.activa = false; };
  }

  // ---- Recorrido del puntero ----
  let previo = null; // dónde estuvo el puntero la última vez (coordenadas del contenedor)
  let resto = 0; // distancia ya recorrida desde la última figurita

  function alMover(e) {
    if (e.pointerType === "touch" || reducido()) { previo = null; return; }
    const r = contenedor.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!previo) { previo = { x, y }; resto = 0; return; }
    const dx = x - previo.x;
    const dy = y - previo.y;
    const largo = Math.hypot(dx, dy);
    if (!largo) return;
    const ux = dx / largo;
    const uy = dy / largo;
    let d = distancia - resto; // cuánto falta, sobre este tramo, para la próxima figurita
    let puestas = 0;
    while (d <= largo && puestas < MAX_POR_MOVIMIENTO) {
      soltar(previo.x + ux * d, previo.y + uy * d, ux, uy, puestas);
      d += distancia;
      puestas++;
    }
    resto = puestas === MAX_POR_MOVIMIENTO ? 0 : largo - (d - distancia);
    previo = { x, y };
  }
  const olvidar = () => { previo = null; resto = 0; };

  contenedor.addEventListener("pointermove", alMover, { passive: true });
  contenedor.addEventListener("pointerenter", olvidar);
  contenedor.addEventListener("pointerleave", olvidar);
  contenedor.addEventListener("pointercancel", olvidar);

  return {
    destruir() {
      contenedor.removeEventListener("pointermove", alMover);
      contenedor.removeEventListener("pointerenter", olvidar);
      contenedor.removeEventListener("pointerleave", olvidar);
      contenedor.removeEventListener("pointercancel", olvidar);
      fichas.forEach((f) => f.ultima?.cancel());
      capa.remove();
      contenedor.classList.remove("estela-imagenes", "estela-imagenes--detras");
      contenedor.style.removeProperty("--estela-tamano");
    },
  };
}
