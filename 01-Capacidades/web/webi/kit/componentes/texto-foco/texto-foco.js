/* texto-foco.js — palabras desenfocadas que un marco de cámara va poniendo nítidas.

   QUÉ ES: un texto en el que cada palabra está desenfocada hasta que un marco viaja hasta ella,
   se estira hacia su caja y la deja nítida. Avanza solo, en bucle (con: "tiempo"), o atado al
   scroll (con: "scroll"): a medida que se baja, el marco va leyendo; al subir, desenfoca de nuevo.

   EL TRUCO: (1) cada palabra se envuelve en un span y se mide su caja real (getBoundingClientRect
   relativo al texto), así sirve con cualquier tipografía, tamaño o salto de línea, y se vuelve a
   medir con un ResizeObserver y cuando carga la fuente. (2) El marco es UN elemento cuyos cuatro
   bordes (izq, der, arriba, abajo) persiguen la caja de la palabra con amortiguar(). El borde que
   va adelante usa un suavizado más rápido que el que queda atrás: durante el viaje el marco se
   estira en la dirección del movimiento y, al llegar, se cierra sobre la palabra. (3) La nitidez
   es una clase (.es-nitida) con transición CSS: el JS no toca el filtro cuadro a cuadro.

   ACCESIBILIDAD: el texto sigue siendo texto. Se agrega una copia en .solo-lectores y las palabras
   visibles quedan con aria-hidden. destruir() devuelve el HTML original.
   SIN PUNTERO: no depende del puntero; en táctil es igual que en escritorio.
   REDUCIR MOVIMIENTO: no toca nada; el texto queda quieto y nítido (el CSS cubre el cambio en vivo).
   FUERA DE PANTALLA no corre nada: el bucle se frena con un IntersectionObserver.

   USO:
     <link rel="stylesheet" href="…/texto-foco.css">
     <h2 class="titulo-l" data-texto-foco data-con="scroll">Cada pantalla tiene una idea.</h2>
     <script type="module">
       import { textoFoco, textosFoco } from "…/texto-foco.js";
       textosFoco();                                         // todos los [data-texto-foco]
       // textoFoco(el, { con: "tiempo", ritmo: 800 });      // uno solo, con opciones
     </script>

   Opciones: con "tiempo"|"scroll" · ritmo (ms base por palabra) · pausaFinal (ms con todo nítido
   antes de repetir) · desenfoque (px) · marco (false = sin marco) · aire (em de holgura del marco)
   · tramo/rango/suavizar (solo con "scroll": rango = [p0, p1], el tramo del progreso —de 0 a 1 mientras el
   texto cruza la pantalla— en el que se van aclarando todas las palabras). */
import { bucle, alScroll, amortiguar, reducido, limitar } from "../../motor-scroll.js";

// Fracción del camino por cuadro (a 60 fps): el borde que va adelante es más ágil que el que queda atrás
const SUAVIZADO = { adelante: 0.24, atras: 0.1 };

export function textoFoco(el, {
  con = "tiempo",
  ritmo = 900,
  pausaFinal = 1800,
  desenfoque = null,
  marco = true,
  aire = 0.22,
  tramo = "cruza",
  rango = [0.2, 0.55],
  suavizar = 0.12,
} = {}) {
  const nada = { destruir() {} };
  if (!el || reducido() || el.classList.contains("texto-foco")) return nada;

  const original = el.innerHTML;
  const textoPlano = el.textContent.replace(/\s+/g, " ").trim();

  // ---- Partir en palabras (conserva los elementos internos: <em>, <strong>…) ----
  const nodos = [];
  const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (recorrido.nextNode()) nodos.push(recorrido.currentNode);
  const palabras = [];
  for (const nodo of nodos) {
    if (!nodo.nodeValue.trim()) continue;
    const trozo = document.createDocumentFragment();
    for (const parte of nodo.nodeValue.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) { trozo.append(parte); continue; }
      const span = document.createElement("span");
      span.className = "texto-foco__palabra";
      span.textContent = parte;
      trozo.append(span);
      palabras.push(span);
    }
    nodo.replaceWith(trozo);
  }
  const n = palabras.length;
  if (!n) { el.innerHTML = original; return nada; }

  // ---- Estructura: copia para lectores + texto visible (aria-hidden) + marco ----
  const lectores = document.createElement("span");
  lectores.className = "solo-lectores";
  lectores.textContent = textoPlano;
  const visible = document.createElement("span");
  visible.className = "texto-foco__visible";
  visible.setAttribute("aria-hidden", "true");
  while (el.firstChild) visible.append(el.firstChild);
  el.append(lectores, visible);
  let elMarco = null;
  if (marco) {
    elMarco = document.createElement("span");
    elMarco.className = "texto-foco__marco";
    elMarco.setAttribute("aria-hidden", "true");
    el.append(elMarco);
  }
  el.classList.add("texto-foco");
  if (desenfoque != null) el.style.setProperty("--tf-desenfoque", desenfoque + "px");

  // ---- Medición: la caja de cada palabra, relativa al texto ----
  let cajas = [];
  let aireX = 0;
  let aireY = 0;
  function medir() {
    const base = el.getBoundingClientRect();
    const ox = base.left + el.clientLeft;
    const oy = base.top + el.clientTop;
    cajas = palabras.map((p) => {
      const r = p.getBoundingClientRect();
      return { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height };
    });
    const cuerpo = parseFloat(getComputedStyle(el).fontSize) || 16;
    aireX = cuerpo * aire;
    aireY = aireX * 0.55;
    // Si el ancho cambió con el marco a la vista, se reapunta a la palabra de ahora
    if (marcoActivo >= 0) apuntar(marcoActivo);
  }

  // ---- Marco: cuatro bordes con inercia ----
  const m = { l: 0, r: 0, t: 0, b: 0 }; // dónde está
  const o = { l: 0, r: 0, t: 0, b: 0 }; // dónde va
  const lam = { l: SUAVIZADO.atras, r: SUAVIZADO.atras, t: SUAVIZADO.atras, b: SUAVIZADO.atras };
  let quieto = true;
  let marcoActivo = -1;

  function escribirMarco() {
    if (!elMarco) return;
    elMarco.style.transform = `translate3d(${m.l.toFixed(1)}px, ${m.t.toFixed(1)}px, 0)`;
    elMarco.style.width = Math.max(0, m.r - m.l).toFixed(1) + "px";
    elMarco.style.height = Math.max(0, m.b - m.t).toFixed(1) + "px";
  }
  // El marco arranca abarcando todo el texto y se cierra sobre la primera palabra
  function abrirMarco() {
    m.l = 0; m.t = 0; m.r = el.clientWidth; m.b = el.clientHeight;
    escribirMarco();
  }
  function apuntar(i) {
    const c = cajas[i];
    if (!c) return;
    marcoActivo = i;
    o.l = c.x - aireX; o.r = c.x + c.w + aireX;
    o.t = c.y - aireY; o.b = c.y + c.h + aireY;
    // Hacia dónde viaja decide qué borde va adelante
    const haciaDerecha = (o.l + o.r) / 2 >= (m.l + m.r) / 2;
    const haciaAbajo = (o.t + o.b) / 2 >= (m.t + m.b) / 2;
    lam.r = haciaDerecha ? SUAVIZADO.adelante : SUAVIZADO.atras;
    lam.l = haciaDerecha ? SUAVIZADO.atras : SUAVIZADO.adelante;
    lam.b = haciaAbajo ? SUAVIZADO.adelante : SUAVIZADO.atras;
    lam.t = haciaAbajo ? SUAVIZADO.atras : SUAVIZADO.adelante;
    // Las esquinas se achican con palabras chicas para no taparlas
    const brazo = Math.max(5, Math.min(16, Math.min(c.w, c.h) * 0.32));
    elMarco?.style.setProperty("--tf-brazo", brazo.toFixed(1) + "px");
    quieto = false;
  }
  function mostrarMarco(si) {
    if (!elMarco) return;
    elMarco.classList.toggle("se-ve", si);
    if (!si) marcoActivo = -1;
  }
  function resorte(dt) {
    let falta = 0;
    for (const e of ["l", "r", "t", "b"]) {
      m[e] = amortiguar(m[e], o[e], lam[e], dt);
      const d = Math.abs(o[e] - m[e]);
      if (d < 0.2) m[e] = o[e]; else falta = Math.max(falta, d);
    }
    escribirMarco();
    if (!falta) quieto = true;
  }

  // ---- Nitidez: k palabras ya nítidas, y cuál es la que se está mirando ----
  let k = 0;
  let focoActual = -1;
  function ponerK(nuevo) {
    nuevo = Math.max(0, Math.min(n, nuevo));
    if (nuevo === k) return;
    for (let i = Math.min(k, nuevo); i < Math.max(k, nuevo); i++) {
      palabras[i].classList.toggle("es-nitida", i < nuevo);
    }
    k = nuevo;
    const foco = k >= 1 && k < n ? k - 1 : -1;
    if (foco !== focoActual) {
      palabras[focoActual]?.classList.remove("es-foco");
      palabras[foco]?.classList.add("es-foco");
      focoActual = foco;
    }
  }

  // ---- Con tiempo: una máquina chica que avanza una palabra cada tanto ----
  let idx = -1; // última palabra nítida; n = terminó; n + 1 = a repetir
  let espera = 0.6;
  function avanzarTiempo(dt) {
    espera -= dt;
    if (espera > 0) return;
    idx++;
    if (idx < n) {
      if (idx === 0) abrirMarco();
      ponerK(idx + 1);
      apuntar(idx);
      mostrarMarco(true);
      espera = (ritmo + palabras[idx].textContent.length * 28) / 1000;
    } else if (idx === n) {
      mostrarMarco(false); // todo nítido: el marco se va y el texto se queda un rato
      espera = pausaFinal / 1000;
    } else {
      ponerK(0); // vuelve a desenfocarse todo y empieza de nuevo
      idx = -1;
      espera = 0.9;
    }
  }

  // ---- Con scroll: el progreso dice cuántas palabras están nítidas ----
  let engancheScroll = null;
  if (con === "scroll") {
    engancheScroll = alScroll(el, (p) => {
      const q = limitar((p - rango[0]) / ((rango[1] - rango[0]) || 1));
      const nuevo = Math.round(q * n);
      if (nuevo === k) return;
      const antes = k;
      ponerK(nuevo);
      if (nuevo >= 1 && nuevo < n) {
        if (antes < 1 || antes >= n) abrirMarco();
        apuntar(nuevo - 1);
        mostrarMarco(true);
      } else {
        mostrarMarco(false);
      }
    }, { tramo, suavizar });
  }

  // ---- Un solo bucle, solo mientras el texto se ve ----
  let sub = null;
  function cuadro(t, dt) {
    if (reducido()) { el.classList.add("es-estatico"); return; }
    el.classList.remove("es-estatico");
    if (con !== "scroll") avanzarTiempo(dt);
    if (!quieto) resorte(dt);
  }
  const io = new IntersectionObserver((entradas) => {
    const dentro = entradas[entradas.length - 1].isIntersecting;
    if (dentro && !sub) sub = bucle(cuadro);
    else if (!dentro && sub) { sub.destruir(); sub = null; }
  });
  io.observe(el);

  // ---- Volver a medir cuando cambia el ancho o llega la tipografía ----
  let pendiente = 0;
  const remedir = () => {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(medir);
  };
  const ro = new ResizeObserver(remedir);
  ro.observe(el);
  document.fonts?.ready.then(remedir);
  medir();

  return {
    destruir() {
      sub?.destruir();
      io.disconnect();
      ro.disconnect();
      engancheScroll?.destruir();
      cancelAnimationFrame(pendiente);
      el.innerHTML = original;
      el.classList.remove("texto-foco", "es-estatico");
      el.style.removeProperty("--tf-desenfoque");
    },
  };
}

// Atajo: engancha todos los [data-texto-foco] (data-con="tiempo|scroll", data-ritmo="900")
export function textosFoco(raiz = document, opciones = {}) {
  const todos = [...raiz.querySelectorAll("[data-texto-foco]")].map((el) =>
    textoFoco(el, {
      ...opciones,
      con: el.dataset.con || opciones.con || "tiempo",
      ritmo: Number(el.dataset.ritmo) || opciones.ritmo || 900,
    })
  );
  return { destruir() { todos.forEach((t) => t.destruir()); } };
}
