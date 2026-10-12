/* ============================================================================
   carrusel-arco · tarjetas sobre un círculo enorme, con la enfocada derecha en
   la cima. Las vecinas bajan y se inclinan siguiendo la curva, como un abanico.

   EL TRUCO
   Posición e inclinación salen de UNA sola rotación. Todas las tarjetas ocupan
   el mismo lugar (el de la cima) y comparten un transform-origin que cae muy
   por debajo de la escena: el centro del círculo. Cada una está pre-rotada por
   CSS en i · paso grados alrededor de ese centro; y un contenedor con el mismo
   centro gira −pos · paso. Rotar una tarjeta alrededor de un punto lejano ya
   es moverla Y inclinarla a la vez: no hay seno ni coseno por tarjeta, y el JS
   solo escribe un transform por cuadro (el del contenedor).
   El paso entre tarjetas sale de dividir el ancho de la tarjeta por el radio.
   Las puntas ofrecen resistencia elástica: el arco no da la vuelta.

   TÁCTIL (decidido a propósito): el arrastre horizontal mueve el arco; el
   vertical sigue siendo scroll de la página (touch-action: pan-y).
   REDUCIR MOVIMIENTO: sin inercia; cada cambio cae directo en su lugar.

   CÓMO SE USA EN HTML
     <link rel="stylesheet" href="kit/componentes/carrusel-arco/carrusel-arco.css">

     <div class="carrusel-arco" data-carrusel-arco aria-label="Casos">
       <div class="carrusel-arco__escena">
         <div class="carrusel-arco__rueda">
           <figure class="carrusel-arco__tarjeta" data-titulo="Casa Pampa">
             <img src="a.webp" alt="Casa Pampa" draggable="false">
             <figcaption>Casa Pampa</figcaption>
           </figure>
           <!-- … las que quieras -->
         </div>
       </div>
     </div>

     <script type="module">
       import { carruselArco } from "./kit/componentes/carrusel-arco/carrusel-arco.js";
       carruselArco(document.querySelector("[data-carrusel-arco]"));
     </script>

   Opciones (o atributos data-): radio (1.15 · data-radio, el radio del arco como
   múltiplo del ancho de la escena), hueco (0.08 · data-hueco, separación entre
   tarjetas como fracción de su ancho), agarre (1), inicio (0), alCambiar(i).
   La tarjeta enfocada lleva .es-activa. Entradas: arrastre, rueda horizontal
   (o Shift + rueda), flechas ← → (también Inicio / Fin) con el carrusel
   enfocado y los botones de abajo. Devuelve { ir(i), siguiente(), anterior(),
   indice, destruir() }.
   ========================================================================== */

import { bucle, amortiguar, reducido } from "../../motor-scroll.js";

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const numero = (v, porDefecto) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : porDefecto;
};

const FLECHA = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function carruselArco(el, opciones = {}) {
  const escena = el && el.querySelector(".carrusel-arco__escena");
  const rueda = el && el.querySelector(".carrusel-arco__rueda");
  const tarjetas = rueda ? [...rueda.querySelectorAll(":scope > .carrusel-arco__tarjeta")] : [];
  if (!escena || !rueda || !tarjetas.length) return { destruir() {} };

  const n = tarjetas.length;
  const ultimo = n - 1;
  const radioRel = numero(el.dataset.radio, opciones.radio ?? 1.15);
  const hueco = numero(el.dataset.hueco, opciones.hueco ?? 0.08);
  const agarre = numero(el.dataset.agarre, opciones.agarre ?? 1);
  const { alCambiar } = opciones;

  // ---- Accesibilidad ----
  const creados = [];
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

  // ---- Controles ----
  const controles = document.createElement("div");
  controles.className = "carrusel-arco__controles";
  const bAnt = document.createElement("button");
  const bSig = document.createElement("button");
  const cuenta = document.createElement("span");
  bAnt.type = bSig.type = "button";
  bAnt.className = bSig.className = "carrusel-arco__boton";
  bAnt.setAttribute("aria-label", "Anterior");
  bSig.setAttribute("aria-label", "Siguiente");
  bAnt.innerHTML = FLECHA("M15 5l-7 7 7 7");
  bSig.innerHTML = FLECHA("M9 5l7 7-7 7");
  cuenta.className = "carrusel-arco__cuenta";
  cuenta.setAttribute("aria-hidden", "true");
  controles.append(bAnt, cuenta, bSig);
  el.append(controles);
  creados.push(controles);

  // ---- Geometría ----
  let paso = 10; // grados entre tarjetas
  let pitch = 1; // px entre centros de tarjetas vecinas, a lo largo del arco
  function medir() {
    const ancho = rueda.offsetWidth || 1;
    pitch = ancho * (1 + hueco);
    // radio: proporcional a la escena, pero nunca tan cerrado que las tarjetas se encimen
    const radio = Math.max(escena.clientWidth * radioRel, pitch * 2.2);
    paso = (pitch / radio) * (180 / Math.PI); // arco = radio · ángulo
    el.style.setProperty("--radio", `${radio.toFixed(1)}px`);
    el.style.setProperty("--paso", `${paso.toFixed(3)}deg`);
  }

  // ---- Estado ----
  let pos = limitar(numero(opciones.inicio, 0), 0, ultimo); // en tarjetas
  let objetivo = Math.round(pos);
  let arrastrando = false;
  let libre = false; // la rueda está moviendo (sin encastre hasta que pare)
  let visible = true;
  let sucio = true;
  let indice = -1;
  let anunciado = -1;

  function dibujar() {
    rueda.style.transform = `rotate(${-pos * paso}deg)`; // la única escritura por cuadro
    const nuevo = limitar(Math.round(pos), 0, ultimo);
    if (nuevo !== indice) {
      if (indice >= 0) {
        tarjetas[indice].classList.remove("es-activa");
        tarjetas[indice].removeAttribute("aria-current");
      }
      indice = nuevo;
      tarjetas[indice].classList.add("es-activa");
      tarjetas[indice].setAttribute("aria-current", "true");
      cuenta.textContent = `${String(indice + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
      bAnt.setAttribute("aria-disabled", String(indice === 0));
      bSig.setAttribute("aria-disabled", String(indice === ultimo));
    }
  }

  function confirmar() {
    if (indice === anunciado) return;
    anunciado = indice;
    const titulo = tarjetas[indice].dataset.titulo;
    vivo.textContent = `${titulo ? titulo + ", " : ""}${indice + 1} de ${n}`;
    if (alCambiar) alCambiar(indice);
  }

  // Elástico en las puntas: pasado el borde, el arco rinde solo un tercio
  const elastico = (delta) => {
    const sigue = pos + delta;
    return (delta < 0 && sigue < 0) || (delta > 0 && sigue > ultimo) ? pos + delta * 0.33 : sigue;
  };

  const lazo = bucle((t, dt) => {
    if (!visible) return;
    if (!arrastrando && !libre && pos !== objetivo) {
      pos = reducido() ? objetivo : amortiguar(pos, objetivo, 0.12, dt);
      if (Math.abs(objetivo - pos) < 0.0008) pos = objetivo;
      sucio = true;
    }
    if (sucio) {
      sucio = false;
      dibujar();
      if (!arrastrando && !libre && pos === objetivo) confirmar();
    }
  });

  // ---- Navegación ----
  const ir = (i) => {
    objetivo = limitar(Math.round(i), 0, ultimo);
    sucio = true;
  };
  const mover = (k) => ir(Math.round(objetivo) + k);

  // ---- Arrastre con inercia ----
  let x0 = 0;
  let pos0 = 0;
  let movio = false;
  let suprimir = false;
  let capturado = null;
  let muestras = [];

  function alBajar(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
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
    const crudo = pos0 - (dx / pitch) * agarre;
    // elástico: lo que pasa del borde se amortigua
    pos = crudo < 0 ? crudo * 0.33 : crudo > ultimo ? ultimo + (crudo - ultimo) * 0.33 : crudo;
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
      suprimir = true;
      setTimeout(() => (suprimir = false), 0);
      const ahora = performance.now();
      const a = muestras[0];
      const b = muestras[muestras.length - 1];
      const vel = ahora - b.t > 90 || b.t === a.t ? 0 : ((b.p - a.p) / (b.t - a.t)) * 1000; // tarjetas/s
      objetivo = pos + limitar(vel * 0.28, -3, 3);
    }
    ir(objetivo);
  }

  // ---- Rueda horizontal ----
  let finRueda = 0;
  function alRueda(e) {
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (!horizontal) return; // la rueda vertical sigue siendo scroll de la página
    e.preventDefault();
    const bruto = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = bruto * (e.deltaMode === 1 ? 16 : 1);
    libre = true;
    pos = elastico((px / pitch) * agarre);
    objetivo = pos;
    sucio = true;
    clearTimeout(finRueda);
    finRueda = setTimeout(() => {
      libre = false;
      ir(pos); // cuando para, encastra en la más cercana
    }, 140);
  }

  function alClic(e) {
    if (suprimir) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const t = e.target.closest(".carrusel-arco__tarjeta");
    if (!t) return;
    const i = tarjetas.indexOf(t);
    if (i !== Math.round(objetivo)) {
      e.preventDefault(); // la primera vez trae la tarjeta a la cima; el enlace se abre en la segunda
      ir(i);
    }
  }

  function alTeclear(e) {
    if (e.target.closest("input, textarea, select")) return;
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) mover(k);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(ultimo);
    else return;
    e.preventDefault();
  }

  function alEnfocar(e) {
    const t = e.target.closest && e.target.closest(".carrusel-arco__tarjeta");
    if (t) ir(tarjetas.indexOf(t));
  }

  const ac = new AbortController();
  const opc = { signal: ac.signal };
  escena.addEventListener("pointerdown", alBajar, opc);
  escena.addEventListener("pointermove", alMover, opc);
  escena.addEventListener("pointerup", alSoltar, opc);
  escena.addEventListener("pointercancel", alSoltar, opc);
  escena.addEventListener("dragstart", (e) => e.preventDefault(), opc);
  escena.addEventListener("wheel", alRueda, { signal: ac.signal, passive: false });
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
  ro.observe(rueda);

  medir();
  dibujar();
  anunciado = indice; // el estado inicial no se anuncia ni dispara alCambiar
  el.classList.add("esta-lista");

  return {
    ir,
    siguiente: () => mover(1),
    anterior: () => mover(-1),
    get indice() {
      return limitar(Math.round(objetivo), 0, ultimo);
    },
    destruir() {
      lazo.destruir();
      clearTimeout(finRueda);
      io.disconnect();
      ro.disconnect();
      ac.abort();
      creados.forEach((c) => c.remove());
      el.classList.remove("esta-lista", "se-arrastra");
      rueda.style.transform = "";
      tarjetas.forEach((t) => {
        t.style.removeProperty("--i");
        t.classList.remove("es-activa");
        t.removeAttribute("aria-current");
      });
    },
  };
}
