/* boton-vidrio.js — la parte de JS del botón de vidrio (el look vive en boton-vidrio.css).

   QUÉ HACE: le pasa al CSS dónde está el puntero. Nada más. Escribe cuatro variables
   (--luz-x, --luz-y, --inclina-x, --inclina-y) en pointermove y el CSS, que las tiene
   registradas con @property, las interpola con transiciones. No hay bucle por cuadro:
   si el puntero no se mueve, el JS no corre.

   TÁCTIL (decidido a propósito): sin hover no hay nada que perseguir, así que no hay inclinación.
   Al apoyar el dedo la luz salta al punto de contacto y el botón se hunde; al soltar, vuelve
   al reposo. Mouse y lápiz sí inclinan.

   REDUCIR MOVIMIENTO: la luz queda en reposo y no hay inclinación; solo queda el hundido al apretar.

   USO:
     <link rel="stylesheet" href="…/boton-vidrio.css">
     <button class="boton-vidrio">Reservar</button>
     <script type="module">
       import { botonVidrio } from "…/boton-vidrio.js";
       const b = botonVidrio();                          // todos los .boton-vidrio
       // botonVidrio(unElemento, { inclinacion: 8 })    // uno solo, o una lista, o un selector
       // b.destruir();
     </script>
*/
import { reducido } from "../../motor-scroll.js";

function listar(objetivo, selector) {
  if (!objetivo) return [...document.querySelectorAll(selector)];
  if (typeof objetivo === "string") return [...document.querySelectorAll(objetivo)];
  if (objetivo instanceof Element) {
    // Si me pasan un contenedor, busco adentro; si me pasan el botón, es él
    return objetivo.matches(selector) ? [objetivo] : [...objetivo.querySelectorAll(selector)];
  }
  return [...objetivo];
}

// objetivo: nada (todos los .boton-vidrio) | selector | elemento | lista de elementos
// inclinacion: grados máximos hacia cada lado (0 = sin inclinar)
export function botonVidrio(objetivo = null, { inclinacion = 5, selector = ".boton-vidrio" } = {}) {
  const limpiezas = [];

  for (const el of listar(objetivo, selector)) {
    const escribir = (e) => {
      if (reducido()) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.min(1.1, Math.max(-0.1, (e.clientX - r.left) / r.width));
      const y = Math.min(1.1, Math.max(-0.1, (e.clientY - r.top) / r.height));
      el.style.setProperty("--luz-x", (x * 100).toFixed(1) + "%");
      el.style.setProperty("--luz-y", (y * 100).toFixed(1) + "%");
      // El tacto no se inclina: el dedo tapa el botón y el giro no se ve
      if (inclinacion && e.pointerType !== "touch") {
        el.style.setProperty("--inclina-x", ((x - 0.5) * 2 * inclinacion).toFixed(2) + "deg");
        el.style.setProperty("--inclina-y", ((0.5 - y) * 2 * inclinacion).toFixed(2) + "deg");
      }
    };

    const soltarLuz = () => {
      for (const v of ["--luz-x", "--luz-y", "--inclina-x", "--inclina-y"]) el.style.removeProperty(v);
    };

    const alEntrar = (e) => {
      if (e.pointerType !== "touch") el.classList.add("es-encima");
    };
    const alMover = (e) => {
      if (e.pointerType === "touch" && !el.classList.contains("es-apretado")) return;
      escribir(e);
    };
    const alApretar = (e) => {
      el.classList.add("es-apretado");
      escribir(e);
    };
    const alSoltar = () => el.classList.remove("es-apretado");
    const alSalir = () => {
      el.classList.remove("es-encima", "es-apretado");
      soltarLuz();
    };
    // Teclado: Enter y Espacio también hunden el botón (los links no hunden con Espacio)
    const alTecla = (e) => {
      if (e.key === "Enter" || (e.key === " " && el.tagName === "BUTTON")) el.classList.add("es-apretado");
    };
    const alSoltarTecla = () => el.classList.remove("es-apretado");

    el.addEventListener("pointerenter", alEntrar);
    el.addEventListener("pointermove", alMover);
    el.addEventListener("pointerdown", alApretar);
    el.addEventListener("pointerup", alSoltar);
    el.addEventListener("pointercancel", alSalir);
    el.addEventListener("pointerleave", alSalir);
    el.addEventListener("keydown", alTecla);
    el.addEventListener("keyup", alSoltarTecla);
    el.addEventListener("blur", alSoltarTecla);

    limpiezas.push(() => {
      el.removeEventListener("pointerenter", alEntrar);
      el.removeEventListener("pointermove", alMover);
      el.removeEventListener("pointerdown", alApretar);
      el.removeEventListener("pointerup", alSoltar);
      el.removeEventListener("pointercancel", alSalir);
      el.removeEventListener("pointerleave", alSalir);
      el.removeEventListener("keydown", alTecla);
      el.removeEventListener("keyup", alSoltarTecla);
      el.removeEventListener("blur", alSoltarTecla);
      el.classList.remove("es-encima", "es-apretado");
      soltarLuz();
    });
  }

  return { destruir() { limpiezas.splice(0).forEach((f) => f()); } };
}
