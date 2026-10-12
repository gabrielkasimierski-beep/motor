/* ============================================================================
   tarjetas-expandibles · riel de astillas altas. Pasar el puntero, enfocar o
   tocar una la ensancha y corre a las vecinas.

   EL TRUCO
   El riel es un flex con todas las tarjetas en flex-basis 0; la abierta solo
   cambia su flex-grow (1 → 5) y el navegador anima el reparto: las vecinas se
   achican solas, sin calcular posiciones. Para que el contenido no se
   reacomode a mitad de la apertura, el epígrafe y la imagen se maquetan UNA
   vez al ancho de tarjeta abierta (--ancho-abierto, que el JS calcula con
   la cuenta del reparto) dentro de un contenedor de ancho fijo: la tarjeta
   funciona como una ventana que se abre y revela el contenido, que nunca se
   mueve ni vuelve a cortar líneas. Las cerradas muestran un rótulo vertical.

   TÁCTIL (decidido a propósito): un toque abre la tarjeta y se queda abierta
   (no hay "salir"); si la tarjeta tiene un enlace, el primer toque la abre y
   el segundo lo sigue. Con mouse, al salir del riel vuelve a la inicial.
   REDUCIR MOVIMIENTO: la apertura es directa, sin transición.

   CÓMO SE USA EN HTML
     <link rel="stylesheet" href="kit/componentes/tarjetas-expandibles/tarjetas-expandibles.css">

     <div class="tarjetas-expandibles" data-crece="5" aria-label="Casos">
       <article class="tarjeta-expandible">
         <img class="tarjeta-expandible__imagen" src="a.webp" alt="" loading="lazy">
         <span class="tarjeta-expandible__rotulo"><span>Casa Pampa</span></span>
         <div class="tarjeta-expandible__contenido">
           <span class="tarjeta-expandible__tipo">Identidad</span>
           <h3 class="tarjeta-expandible__titulo">Casa Pampa</h3>
           <p class="tarjeta-expandible__texto">Una bodega que se cuenta sola.</p>
           <a class="tarjeta-expandible__ver" href="#">Ver el caso →</a>
         </div>
       </article>
       <!-- … más tarjetas -->
     </div>

     <script type="module">
       import { tarjetasExpandibles } from "./kit/componentes/tarjetas-expandibles/tarjetas-expandibles.js";
       tarjetasExpandibles(document.querySelector(".tarjetas-expandibles"));
     </script>

   Atributos / opciones: data-crece (5: cuántas veces más ancha es la abierta
   que una cerrada), data-inicial (0: cuál arranca abierta; -1 = ninguna).
   La abierta lleva .es-activa. Teclado: Tab llega a cada tarjeta (y la abre);
   ← → Inicio Fin saltan entre tarjetas.
   Devuelve { abrir(i), actual, destruir() }.
   ========================================================================== */

const numero = (v, porDefecto) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : porDefecto;
};
const ENFOCABLES = "a[href], button, input, select, textarea";

export function tarjetasExpandibles(riel, opciones = {}) {
  const tarjetas = riel ? [...riel.querySelectorAll(":scope > .tarjeta-expandible")] : [];
  if (!tarjetas.length) return { destruir() {} };

  const n = tarjetas.length;
  const crece = Math.max(1, numero(riel.dataset.crece, opciones.crece ?? 5));
  const inicial = Math.min(n - 1, Math.floor(numero(riel.dataset.inicial, opciones.inicial ?? 0)));

  // ---- Accesibilidad ----
  const rolOriginal = riel.getAttribute("role");
  if (!rolOriginal) riel.setAttribute("role", "group");
  riel.setAttribute("aria-roledescription", "carrusel");
  if (!riel.hasAttribute("aria-label")) riel.setAttribute("aria-label", "Tarjetas");
  riel.style.setProperty("--crece", crece);
  tarjetas.forEach((t, i) => {
    const titulo = t.querySelector(".tarjeta-expandible__titulo");
    t.setAttribute("tabindex", "0");
    t.setAttribute("role", "group");
    t.setAttribute("aria-roledescription", "diapositiva");
    if (!t.hasAttribute("aria-label")) {
      t.setAttribute("aria-label", `${titulo ? titulo.textContent.trim() + ", " : ""}${i + 1} de ${n}`);
    }
  });

  // ---- Ancho de la tarjeta abierta ----
  // Con flex-basis 0, la abierta recibe crece / (n − 1 + crece) del espacio libre
  function medir() {
    const hueco = parseFloat(getComputedStyle(riel).columnGap) || 0;
    const libre = riel.clientWidth - hueco * (n - 1);
    const abierto = (libre * crece) / (n - 1 + crece);
    riel.style.setProperty("--ancho-abierto", `${Math.round(abierto)}px`);
  }

  // ---- Estado ----
  let actual = -2; // −2 = todavía no se aplicó ningún estado (−1 significa "ninguna abierta")
  function abrir(i) {
    if (i === actual) return;
    actual = i;
    tarjetas.forEach((t, k) => {
      const abierta = k === i;
      t.classList.toggle("es-activa", abierta);
      if (abierta) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
      // lo que está en una tarjeta cerrada no se alcanza con Tab hasta que se abre
      t.querySelectorAll(ENFOCABLES).forEach((x) => x.setAttribute("tabindex", abierta ? "0" : "-1"));
    });
  }

  const ac = new AbortController();
  const opc = { signal: ac.signal };

  tarjetas.forEach((t, i) => {
    t.addEventListener(
      "pointerenter",
      (e) => {
        if (e.pointerType !== "touch") abrir(i); // el dedo abre con el toque (click)
      },
      opc
    );
    t.addEventListener("focusin", () => abrir(i), opc);
  });

  // Con mouse, al salir del riel vuelve a la inicial (o a la que tiene el foco de teclado)
  riel.addEventListener(
    "pointerleave",
    (e) => {
      if (e.pointerType === "touch") return;
      const f = document.activeElement;
      const conFoco = f && f.matches && f.matches(":focus-visible") ? tarjetas.findIndex((t) => t.contains(f)) : -1;
      abrir(conFoco >= 0 ? conFoco : inicial);
    },
    opc
  );

  // Toque / clic: abre. Si la tarjeta estaba cerrada y se tocó un enlace, el primer toque solo la abre.
  // Se anota cuál estaba abierta ANTES del toque: en el celu el foco la abre antes de que llegue el clic.
  let antes = null;
  riel.addEventListener("pointerdown", () => (antes = actual), { signal: ac.signal, capture: true });
  riel.addEventListener(
    "click",
    (e) => {
      const estaba = antes !== null ? antes : actual;
      antes = null;
      const t = e.target.closest(".tarjeta-expandible");
      if (!t) return;
      const i = tarjetas.indexOf(t);
      if (i !== estaba && e.target.closest("a[href]")) e.preventDefault();
      abrir(i);
    },
    { signal: ac.signal, capture: true }
  );

  riel.addEventListener(
    "keydown",
    (e) => {
      const i = tarjetas.indexOf(e.target);
      if (i < 0) return; // solo cuando el foco está en la tarjeta misma
      let destino = -1;
      if (e.key === "ArrowRight") destino = (i + 1) % n;
      else if (e.key === "ArrowLeft") destino = (i - 1 + n) % n;
      else if (e.key === "Home") destino = 0;
      else if (e.key === "End") destino = n - 1;
      if (destino < 0) return;
      e.preventDefault();
      tarjetas[destino].focus();
    },
    opc
  );

  const ro = new ResizeObserver(medir);
  ro.observe(riel);

  medir();
  abrir(inicial); // sin transición: .esta-lista (que la habilita) se suma un cuadro después
  const raf = requestAnimationFrame(() => riel.classList.add("esta-lista"));

  return {
    abrir,
    get actual() {
      return actual;
    },
    destruir() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ac.abort();
      riel.classList.remove("esta-lista");
      riel.style.removeProperty("--ancho-abierto");
      riel.style.removeProperty("--crece");
      if (!rolOriginal) riel.removeAttribute("role");
      tarjetas.forEach((t) => {
        t.classList.remove("es-activa");
        t.removeAttribute("aria-current");
        t.querySelectorAll(ENFOCABLES).forEach((x) => x.removeAttribute("tabindex"));
      });
    },
  };
}
