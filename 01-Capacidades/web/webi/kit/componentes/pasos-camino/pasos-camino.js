/* pasos-camino.js — pasos de un proceso unidos por una línea punteada que se dibuja con el scroll.

   QUÉ ES: una línea punteada (SVG) que salta de punto en punto y se dibuja al entrar en pantalla.
   Cada paso aparece cuando la línea llega a su punto.

   EL TRUCO: (1) El recorrido sale de MEDIR dónde cayeron los puntos de verdad (offsetLeft/Top,
   que no se alteran con las animaciones de escala) y se une cada par con una curva cúbica que
   hace un saltito hacia "arriba o a la derecha" (la normal del tramo que mira para ese lado).
   Se recalcula con un ResizeObserver: en fila (escritorio) la línea salta por arriba; en columna
   (celu) baja en vertical y salta hacia la derecha. (2) Lo punteado y lo animado: el trazo
   punteado se ve a través de una <mask> cuyo contenido es la misma ruta SÓLIDA; lo que se anima
   es el stroke-dashoffset de esa ruta sólida (de largo total a 0). Si se animara el dashoffset del
   punteado mismo, los puntos correrían en vez de aparecer. (3) El largo hasta cada punto se mide
   tramo por tramo con getTotalLength(), y un paso se enciende cuando la línea llega a su borde.
   (4) El progreso sale de alScroll(): se reconstruye dónde está el borde superior del contenedor
   y se mapea a "0 cuando arranca a asomar, 1 cuando el borde inferior llega a la mitad".

   SIN JS: los pasos se ven todos, sin línea. SIN PUNTERO: no usa el puntero.
   REDUCIR MOVIMIENTO: línea entera dibujada y todos los pasos encendidos, sin animar.
   FUERA DE PANTALLA: alScroll() no mide cuando el contenedor está lejos.

   USO: ver pasos-camino.css para el HTML.
     import { pasosCamino } from "…/pasos-camino.js";
     const c = pasosCamino(document.querySelector("[data-pasos-camino]"), { salto: 40 });
     c.destruir();

   Opciones: inicio (0.85: la línea empieza a dibujarse cuando el borde superior pasa por ese alto
   de la pantalla, en fracción) · fin (0.55: termina cuando el borde inferior llega a ese alto) ·
   salto (px de altura máxima de cada saltito) · suavizar (inercia del progreso). */
import { alScroll, reducido, limitar } from "../../motor-scroll.js";

const NS = "http://www.w3.org/2000/svg";
let contador = 0;

function svgEl(nombre, atributos = {}) {
  const el = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

// Centro de un elemento relativo a la raíz, sin que lo afecten las transformaciones (escalas)
function centroDe(el, raiz) {
  let x = 0;
  let y = 0;
  let n = el;
  while (n && n !== raiz) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  if (n !== raiz) {
    // La raíz no está en la cadena de offsetParent (no es "position"): se mide con rectángulos
    const a = el.getBoundingClientRect();
    const b = raiz.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  }
  return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 };
}

// Curva cúbica de A a B que se abulta h px hacia el lado "arriba / derecha"
function saltito(a, b, h) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy) || 1;
  const ux = dx / largo;
  const uy = dy / largo;
  let nx = uy;
  let ny = -ux;
  if (nx - ny < 0) { nx = -nx; ny = -ny; } // la normal que mira hacia arriba o a la derecha
  const k = (h * 4) / 3; // con este desvío, la panza de la cúbica llega justo a h
  const c1 = { x: a.x + ux * largo * 0.25 + nx * k, y: a.y + uy * largo * 0.25 + ny * k };
  const c2 = { x: b.x - ux * largo * 0.25 + nx * k, y: b.y - uy * largo * 0.25 + ny * k };
  const f = (n) => n.toFixed(1);
  return `C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(b.x)} ${f(b.y)}`;
}

export function pasosCamino(contenedor, {
  inicio = 0.85,
  fin = 0.55,
  salto = 40,
  suavizar = 0.1,
  paso = ".pasos-camino__paso",
  punto = ".pasos-camino__punto",
} = {}) {
  const nada = { destruir() {} };
  if (!contenedor) return nada;
  const pasos = [...contenedor.querySelectorAll(paso)];
  const puntos = pasos.map((p) => p.querySelector(punto));
  if (pasos.length < 2 || puntos.some((p) => !p)) {
    console.warn("pasosCamino(): hacen falta al menos dos pasos con su punto", contenedor);
    return nada;
  }
  if (getComputedStyle(contenedor).position === "static") contenedor.style.position = "relative";

  // ---- SVG: ruta base (guía tenue), ruta punteada enmascarada y la máscara sólida ----
  const idMascara = "pasos-camino-mascara-" + ++contador;
  const svg = svgEl("svg", { class: "pasos-camino__svg", "aria-hidden": "true", focusable: "false" });
  const mascara = svgEl("mask", { id: idMascara, maskUnits: "userSpaceOnUse" });
  mascara.style.maskType = "alpha"; // solo importa el alfa; si no se soporta, cuenta la luminancia del trazo
  const rutaMascara = svgEl("path", { class: "pasos-camino__mascara" });
  mascara.append(rutaMascara);
  const defs = svgEl("defs");
  defs.append(mascara);
  const rutaBase = svgEl("path", { class: "pasos-camino__base" });
  const rutaTrazo = svgEl("path", { class: "pasos-camino__trazo", mask: `url(#${idMascara})` });
  const cabeza = svgEl("circle", { class: "pasos-camino__cabeza", r: 5 });
  svg.append(defs, rutaBase, rutaTrazo, cabeza);
  contenedor.prepend(svg);

  // ---- Medición: puntos → ruta → largo acumulado hasta cada punto ----
  let acum = []; // largo de la línea hasta el centro de cada punto
  let radios = [];
  let total = 0;
  let largoPunteado = 0;
  let alto = 0; // alto del contenedor, para mapear el scroll
  let fraccion = 0; // cuánto de la línea está dibujada (0..1)
  let ultimoP = 0;
  const quieto = reducido();

  function medir() {
    const ancho = contenedor.clientWidth;
    alto = contenedor.clientHeight;
    if (!ancho || !alto) return; // oculto: no hay nada que medir
    const c = puntos.map((p) => centroDe(p, contenedor));
    radios = puntos.map((p) => p.offsetWidth / 2);

    // En columna el saltito no puede pisar el texto: se limita al ancho del punto
    const xs = c.map((q) => q.x);
    const ys = c.map((q) => q.y);
    const vertical = Math.max(...xs) - Math.min(...xs) < (Math.max(...ys) - Math.min(...ys)) * 0.5;
    const tope = vertical ? Math.max(8, radios[0] * 1.2) : salto;

    svg.setAttribute("width", ancho);
    svg.setAttribute("height", alto);
    svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
    mascara.setAttribute("x", -40);
    mascara.setAttribute("y", -80);
    mascara.setAttribute("width", ancho + 80);
    mascara.setAttribute("height", alto + 160);

    // El largo hasta cada punto: se mide la ruta parcial con getTotalLength()
    let d = `M ${c[0].x.toFixed(1)} ${c[0].y.toFixed(1)}`;
    acum = [0];
    for (let i = 1; i < c.length; i++) {
      const h = Math.min(tope, Math.max(12, Math.hypot(c[i].x - c[i - 1].x, c[i].y - c[i - 1].y) * 0.22));
      d += " " + saltito(c[i - 1], c[i], h);
      rutaBase.setAttribute("d", d);
      acum.push(rutaBase.getTotalLength());
    }
    total = acum[acum.length - 1];
    rutaTrazo.setAttribute("d", d);
    rutaMascara.setAttribute("d", d);
    largoPunteado = total + 2; // un pelín de más para que el último punto no quede cortado
    rutaMascara.style.strokeDasharray = `${largoPunteado} ${largoPunteado}`;
    dibujar(quieto ? 1 : fraccion);
  }

  // ---- Dibujo: el dashoffset de la máscara y los pasos que ya llegaron ----
  function dibujar(f) {
    fraccion = f;
    if (!total) return;
    const hasta = f * total;
    rutaMascara.style.strokeDashoffset = String(largoPunteado * (1 - f));
    for (let i = 0; i < pasos.length; i++) {
      // el paso se enciende cuando la línea toca el borde de su punto, no su centro
      const llego = f > 0 && hasta >= acum[i] - radios[i] - 0.5;
      pasos[i].classList.toggle("es-activo", llego);
    }
    if (f > 0.002 && f < 0.998) {
      const q = rutaBase.getPointAtLength(hasta);
      cabeza.setAttribute("cx", q.x.toFixed(1));
      cabeza.setAttribute("cy", q.y.toFixed(1));
      cabeza.style.opacity = "1";
    } else {
      cabeza.style.opacity = "0";
    }
  }

  // ---- Del progreso de alScroll ("cruza") a la fracción de línea dibujada ----
  function desdeScroll(p) {
    ultimoP = p;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const arriba = vh - p * (vh + alto); // dónde está el borde superior del contenedor
    const arranca = vh * inicio; // con el borde superior acá, la línea empieza
    const termina = vh * fin - alto; // con el borde superior acá, el inferior está en `fin` y la línea termina
    dibujar(limitar((arranca - arriba) / Math.max(1, arranca - termina)));
  }

  medir();
  contenedor.classList.add("esta-lista");

  let enganche = null;
  if (!quieto) enganche = alScroll(contenedor, desdeScroll, { tramo: "cruza", suavizar });

  // ---- Volver a medir al cambiar el ancho (o cuando llega la tipografía) ----
  let pendiente = 0;
  const remedir = () => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      medir();
      if (!quieto) desdeScroll(ultimoP);
    });
  };
  const ro = new ResizeObserver(remedir);
  ro.observe(contenedor);
  document.fonts?.ready.then(remedir);

  return {
    destruir() {
      enganche?.destruir();
      ro.disconnect();
      cancelAnimationFrame(pendiente);
      svg.remove();
      contenedor.classList.remove("esta-lista");
      pasos.forEach((p) => p.classList.remove("es-activo"));
    },
  };
}
