/* ============================================================================
   carrusel-anillo · anillo 3D de verdad: las tarjetas sentadas alrededor de un
   cilindro, con transformaciones CSS (sin canvas).

   EL TRUCO
   Cada tarjeta se coloca UNA vez con CSS: rotateY(i · paso) translateZ(radio).
   El anillo entero (transform-style: preserve-3d) gira con un solo
   rotateY por cuadro; el JS no mueve tarjetas, mueve el anillo. Lo que sí se
   calcula por cuadro es la PROFUNDIDAD de cada tarjeta: con el coseno de su
   ángulo respecto del frente se le da el z-index (para que el orden de pintado
   sea el correcto aunque el navegador no ordene bien el 3D) y una variable
   --prof (1 al frente, 0 atrás) con la que el CSS atenúa y desenfoca las
   lejanas. El radio lleva una holgura: entre las tarjetas del frente quedan
   huecos por donde se ve, borroso, el lado lejano del anillo.
   Arrastre con inercia: al soltar se proyecta hacia dónde iría y se encastra
   en la tarjeta más cercana (amortiguar de motor-scroll.js).

   TÁCTIL (decidido a propósito): el arrastre horizontal gira el anillo; el
   vertical sigue siendo scroll de la página (touch-action: pan-y). Un toque
   sobre una tarjeta de costado la trae al frente.
   REDUCIR MOVIMIENTO: sin inercia ni deslizamiento; cada cambio es directo.

   CÓMO SE USA EN HTML
     <link rel="stylesheet" href="kit/componentes/carrusel-anillo/carrusel-anillo.css">

     <div class="carrusel-anillo" data-carrusel-anillo aria-label="Trabajos">
       <div class="carrusel-anillo__escena">
         <div class="carrusel-anillo__anillo">
           <figure class="carrusel-anillo__tarjeta" data-titulo="Casa Pampa">
             <img src="a.webp" alt="Casa Pampa" draggable="false">
             <figcaption>Casa Pampa</figcaption>
           </figure>
           <!-- … entre 5 y 14 tarjetas -->
         </div>
       </div>
     </div>

     <script type="module">
       import { carruselAnillo } from "./kit/componentes/carrusel-anillo/carrusel-anillo.js";
       carruselAnillo(document.querySelector("[data-carrusel-anillo]"));
     </script>

   Opciones (o atributos data-): holgura (1.35 · data-holgura), agarre (1 · cuántas
   veces sigue al dedo), inicio (0, índice de la tarjeta al frente), alCambiar(i).
   Devuelve { ir(i), siguiente(), anterior(), indice, destruir() }.
   Teclado: ← → (también Inicio / Fin) con el carrusel enfocado. Botones
   anterior / siguiente y contador debajo, creados por el JS.
   ========================================================================== */

import { bucle, amortiguar, reducido } from "../../motor-scroll.js";

const aRad = Math.PI / 180;
const mod = (a, n) => ((a % n) + n) % n;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const numero = (v, porDefecto) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : porDefecto;
};

const FLECHA = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function carruselAnillo(el, opciones = {}) {
  const escena = el && el.querySelector(".carrusel-anillo__escena");
  const anillo = el && el.querySelector(".carrusel-anillo__anillo");
  const tarjetas = anillo ? [...anillo.querySelectorAll(":scope > .carrusel-anillo__tarjeta")] : [];
  if (!escena || !anillo || !tarjetas.length) return { destruir() {} };

  const n = tarjetas.length;
  const holgura = numero(el.dataset.holgura, opciones.holgura ?? 1.35);
  const agarre = numero(el.dataset.agarre, opciones.agarre ?? 1);
  const { alCambiar } = opciones;
  const paso = 360 / n; // grados entre tarjetas

  // ---- Accesibilidad ----
  const creados = []; // lo que agrego, para sacarlo al destruir
  if (!el.hasAttribute("role")) el.setAttribute("role", "group");
  el.setAttribute("aria-roledescription", "carrusel");
  if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Carrusel de tarjetas");
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  tarjetas.forEach((t, i) => {
    t.style.setProperty("--i", i);
    t.setAttribute("role", "group");
    t.setAttribute("aria-roledescription", "diapositiva");
    if (!t.hasAttribute("aria-label")) t.setAttribute("aria-label", `${i + 1} de ${n}`);
  });

  const vivo = document.createElement("span");
  vivo.className = "solo-lectores";
  vivo.setAttribute("aria-live", "polite");
  el.append(vivo);
  creados.push(vivo);

  // ---- Controles: anterior, contador, siguiente ----
  const controles = document.createElement("div");
  controles.className = "carrusel-anillo__controles";
  const bAnt = document.createElement("button");
  const bSig = document.createElement("button");
  const cuenta = document.createElement("span");
  bAnt.type = bSig.type = "button";
  bAnt.className = bSig.className = "carrusel-anillo__boton";
  bAnt.setAttribute("aria-label", "Anterior");
  bSig.setAttribute("aria-label", "Siguiente");
  bAnt.innerHTML = FLECHA("M15 5l-7 7 7 7");
  bSig.innerHTML = FLECHA("M9 5l7 7-7 7");
  cuenta.className = "carrusel-anillo__cuenta";
  cuenta.setAttribute("aria-hidden", "true");
  controles.append(bAnt, cuenta, bSig);
  el.append(controles);
  creados.push(controles);

  // ---- Geometría ----
  let radio = 0;
  let pitch = 1; // px del frente que equivalen a pasar de una tarjeta a la vecina
  function medir() {
    const ancho = anillo.offsetWidth || 1;
    // radio del polígono regular de n lados con lado = ancho; la holgura abre huecos entre tarjetas
    radio = ((ancho / 2) / Math.tan(Math.PI / Math.max(n, 3))) * holgura;
    pitch = Math.max(1, radio * paso * aRad);
    el.style.setProperty("--radio", `${radio.toFixed(1)}px`);
    el.style.setProperty("--paso", `${paso}deg`);
    el.style.setProperty("--perspectiva", `${Math.max(900, radio * 3).toFixed(0)}px`);
  }

  // ---- Estado ----
  let pos = numero(opciones.inicio, 0); // en tarjetas (0 = la primera al frente); crece hacia la siguiente
  let objetivo = Math.round(pos);
  let arrastrando = false;
  let visible = true;
  let sucio = true;
  let indice = -1; // la que está al frente
  let anunciado = -1;

  function dibujar() {
    anillo.style.transform = `translateZ(${-radio}px) rotateY(${-pos * paso}deg)`;
    for (let i = 0; i < n; i++) {
      const c = Math.cos((i - pos) * paso * aRad); // 1 al frente, −1 atrás
      const prof = Math.pow((c + 1) / 2, 1.3);
      const t = tarjetas[i];
      t.style.setProperty("--prof", prof.toFixed(3));
      t.style.zIndex = String(Math.round((c + 1) * 50));
    }
    const nuevo = mod(Math.round(pos), n);
    if (nuevo !== indice) {
      if (indice >= 0) {
        tarjetas[indice].classList.remove("es-activa");
        tarjetas[indice].removeAttribute("aria-current");
      }
      indice = nuevo;
      tarjetas[indice].classList.add("es-activa");
      tarjetas[indice].setAttribute("aria-current", "true");
      cuenta.textContent = `${String(indice + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
    }
  }

  // Cuando se asienta, se avisa una sola vez (lector de pantalla y callback)
  function confirmar() {
    if (indice === anunciado) return;
    anunciado = indice;
    const titulo = tarjetas[indice].dataset.titulo;
    vivo.textContent = `${titulo ? titulo + ", " : ""}${indice + 1} de ${n}`;
    if (alCambiar) alCambiar(indice);
  }

  const lazo = bucle((t, dt) => {
    if (!visible) return;
    if (!arrastrando && pos !== objetivo) {
      pos = reducido() ? objetivo : amortiguar(pos, objetivo, 0.12, dt);
      if (Math.abs(objetivo - pos) < 0.0008) pos = objetivo;
      sucio = true;
    }
    if (sucio) {
      sucio = false;
      dibujar();
      if (!arrastrando && pos === objetivo) confirmar();
    }
  });

  // ---- Navegación ----
  function ir(i) {
    const base = Math.round(objetivo);
    let d = mod(i - mod(base, n), n);
    if (d > n / 2) d -= n; // por el camino corto
    objetivo = base + d;
    sucio = true;
  }
  const mover = (k) => {
    objetivo = Math.round(objetivo) + k;
    sucio = true;
  };

  // ---- Arrastre con inercia ----
  let x0 = 0;
  let pos0 = 0;
  let movio = false;
  let suprimir = false;
  let capturado = null;
  let muestras = [];

  function alBajar(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest(".carrusel-anillo__controles")) return;
    arrastrando = true;
    movio = false;
    x0 = e.clientX;
    pos0 = pos;
    muestras = [{ t: performance.now(), p: pos }];
  }

  function alMover(e) {
    if (!arrastrando) return;
    const dx = e.clientX - x0;
    if (!movio && Math.abs(dx) > 6) {
      movio = true;
      // Recién al pasar el umbral se captura el puntero: un toque simple sigue siendo un clic normal
      try {
        escena.setPointerCapture(e.pointerId);
        capturado = e.pointerId;
      } catch (err) {}
      el.classList.add("se-arrastra");
    }
    if (!movio) return;
    pos = pos0 - (dx / pitch) * agarre;
    objetivo = pos;
    sucio = true;
    const ahora = performance.now();
    muestras.push({ t: ahora, p: pos });
    while (muestras.length > 2 && ahora - muestras[0].t > 110) muestras.shift();
  }

  function alSoltar() {
    if (!arrastrando) return;
    arrastrando = false;
    el.classList.remove("se-arrastra");
    if (capturado !== null) {
      try {
        escena.releasePointerCapture(capturado);
      } catch (err) {}
      capturado = null;
    }
    if (movio) {
      suprimir = true; // el clic que sigue al arrastre no debe activar nada
      setTimeout(() => (suprimir = false), 0);
      const ahora = performance.now();
      const a = muestras[0];
      const b = muestras[muestras.length - 1];
      // velocidad en tarjetas por segundo; si hubo una pausa antes de soltar, es 0
      const vel = ahora - b.t > 90 || b.t === a.t ? 0 : ((b.p - a.p) / (b.t - a.t)) * 1000;
      objetivo = Math.round(pos + limitar(vel * 0.28, -3, 3)); // hacia dónde iría + encastre
    }
    objetivo = Math.round(objetivo);
    sucio = true;
  }

  // Un clic sobre una tarjeta de costado la trae al frente (en vez de abrir su enlace)
  function alClic(e) {
    if (suprimir) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const t = e.target.closest(".carrusel-anillo__tarjeta");
    if (!t) return;
    const i = tarjetas.indexOf(t);
    if (i !== mod(Math.round(objetivo), n)) {
      e.preventDefault();
      ir(i);
    }
  }

  function alTeclear(e) {
    if (e.target.closest("input, textarea, select")) return;
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) mover(k);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(n - 1);
    else return;
    e.preventDefault();
  }

  // Enfocar algo dentro de una tarjeta (con Tab) la trae al frente
  function alEnfocar(e) {
    const t = e.target.closest && e.target.closest(".carrusel-anillo__tarjeta");
    if (t) ir(tarjetas.indexOf(t));
  }

  const ac = new AbortController();
  const opc = { signal: ac.signal };
  escena.addEventListener("pointerdown", alBajar, opc);
  escena.addEventListener("pointermove", alMover, opc);
  escena.addEventListener("pointerup", alSoltar, opc);
  escena.addEventListener("pointercancel", alSoltar, opc);
  escena.addEventListener("dragstart", (e) => e.preventDefault(), opc);
  el.addEventListener("click", alClic, { signal: ac.signal, capture: true });
  el.addEventListener("keydown", alTeclear, opc);
  el.addEventListener("focusin", alEnfocar, opc);
  bAnt.addEventListener("click", () => mover(-1), opc);
  bSig.addEventListener("click", () => mover(1), opc);

  // ---- Pausa fuera de pantalla y tamaño ----
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) sucio = true;
    },
    { rootMargin: "120px" }
  );
  io.observe(el);

  const ro = new ResizeObserver(() => {
    medir();
    sucio = true;
  });
  ro.observe(el);
  ro.observe(anillo);

  medir();
  dibujar();
  anunciado = indice; // el estado inicial no se anuncia ni dispara alCambiar
  el.classList.add("esta-lista");

  return {
    ir,
    siguiente: () => mover(1),
    anterior: () => mover(-1),
    get indice() {
      return mod(Math.round(objetivo), n);
    },
    destruir() {
      lazo.destruir();
      io.disconnect();
      ro.disconnect();
      ac.abort();
      creados.forEach((c) => c.remove());
      el.classList.remove("esta-lista", "se-arrastra");
      anillo.style.transform = "";
      tarjetas.forEach((t) => {
        t.style.removeProperty("--i");
        t.style.removeProperty("--prof");
        t.style.zIndex = "";
        t.classList.remove("es-activa");
        t.removeAttribute("aria-current");
      });
    },
  };
}
