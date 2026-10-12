/* Motor webi · motor-scroll.js
   Progreso de scroll, escenario fijo, aparecer al entrar, bucle compartido y amortiguar.
   Sin dependencias. Todo lo que engancha algo devuelve { destruir() }. */

const hayDom = typeof window !== "undefined" && typeof document !== "undefined";
const nada = () => ({ destruir() {} });

/* ---------- Matemática chica ---------- */

export function limitar(v, min = 0, max = 1) {
  // un NaN cae en el mínimo en vez de contagiar todo el cálculo
  return v >= min ? (v <= max ? v : max) : min;
}

export function mapear(v, a, b, c, d, conLimite = true) {
  if (a === b) return c; // rango vacío: evita dividir por cero
  let t = (v - a) / (b - a);
  if (conLimite) t = limitar(t);
  return c + (d - c) * t;
}

/* Suavizado que no depende de los fps. `lambda` es la fracción del camino que se recorre
   por cuadro a 60 fps (0.1 = 10 % por cuadro), así los mismos números sirven para `suavizar`.
   lambda <= 0 o >= 1 va directo al objetivo (0 = sin inercia, como pide el contrato). */
export function amortiguar(actual, objetivo, lambda, dt) {
  if (!(lambda > 0) || lambda >= 1) return objetivo;
  const k = 1 - Math.pow(1 - lambda, Math.max(dt, 0) * 60);
  return actual + (objetivo - actual) * k;
}

export const curvas = {
  // easeOutQuint: arranca rápido y se posa; para entradas
  salida: (t) => 1 - Math.pow(1 - limitar(t), 5),
  // easeInOutCubic: simétrica; para ir y volver
  idaVuelta: (t) => {
    t = limitar(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  // easeOutBack con poco sobrepaso (c1 chico): pasa apenas del final y vuelve
  rebote: (t) => {
    t = limitar(t);
    const c1 = 1.1, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

let consultaReducido = null;
export function reducido() {
  if (!hayDom || !window.matchMedia) return false;
  consultaReducido ||= window.matchMedia("(prefers-reduced-motion: reduce)");
  return consultaReducido.matches; // .matches se lee en vivo: respeta el cambio de preferencia
}

/* ---------- Bucle único ---------- */

const suscriptos = new Set();
let raf = 0;
let previo = 0; // marca del cuadro anterior en ms (0 = recién arrancado)
let idCuadro = 0; // sube en cada cuadro; deja memorizar lecturas por cuadro
let escuchaVisibilidad = false;

function paso(ahora) {
  raf = requestAnimationFrame(paso);
  // tope de 0.1 s: al volver de una pestaña oculta no hay saltos gigantes
  const dt = previo ? Math.min((ahora - previo) / 1000, 0.1) : 1 / 60;
  previo = ahora;
  idCuadro++;
  for (const s of suscriptos) {
    s.t += dt;
    try {
      s.cb(s.t, dt);
    } catch (err) {
      console.error(err); // un callback roto no tumba al resto
    }
  }
}

function arrancar() {
  if (raf || !suscriptos.size || document.hidden) return;
  previo = 0;
  raf = requestAnimationFrame(paso);
}

function frenar() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  previo = 0;
}

function alCambiarVisibilidad() {
  if (document.hidden) frenar();
  else arrancar();
}

export function bucle(cb) {
  if (!hayDom) return nada();
  if (!escuchaVisibilidad) {
    escuchaVisibilidad = true;
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
  }
  const s = { cb, t: 0 };
  suscriptos.add(s);
  arrancar();
  return {
    destruir() {
      suscriptos.delete(s);
      if (!suscriptos.size) frenar();
    },
  };
}

/* ---------- Lectura de scroll compartida (una por cuadro) ---------- */

const lectura = { y: 0, velocidad: 0, direccion: 0, id: -2, iniciada: false };

function leerScroll(dt) {
  if (lectura.id === idCuadro) return lectura;
  const y = window.scrollY || window.pageYOffset || 0;
  if (lectura.iniciada && lectura.id === idCuadro - 1 && dt > 0) {
    const dy = y - lectura.y;
    // un poco de suavizado: el scroll llega a saltos y la velocidad cruda es muy picuda
    lectura.velocidad = amortiguar(lectura.velocidad, Math.abs(dy) / dt, 0.35, dt);
    if (dy !== 0) lectura.direccion = dy > 0 ? 1 : -1;
  } else {
    lectura.velocidad = 0; // hubo un hueco: la diferencia no es de un solo cuadro
  }
  lectura.y = y;
  lectura.id = idCuadro;
  lectura.iniciada = true;
  return lectura;
}

/* ---------- Despertar elementos dormidos ----------
   Un elemento fuera de pantalla no mide. Pero si el scroll lo salta de un tirón (ancla, tecla
   Fin, "reducir movimiento"), el IntersectionObserver no se entera: al terminar de moverse el
   mundo se pide una medición más para que el progreso caiga en 0 o en 1. */

const durmientes = new Set();
let temporizador = 0;
let escuchaGlobal = false;

function despertarTodos() {
  for (const f of durmientes) f();
}
function alMoverseElMundo() {
  clearTimeout(temporizador);
  temporizador = setTimeout(despertarTodos, 120);
}
function alVolverVisible() {
  if (!document.hidden) despertarTodos();
}
function sumarDurmiente(f) {
  durmientes.add(f);
  if (escuchaGlobal) return;
  escuchaGlobal = true;
  window.addEventListener("scroll", alMoverseElMundo, { passive: true });
  window.addEventListener("resize", alMoverseElMundo, { passive: true });
  document.addEventListener("visibilitychange", alVolverVisible);
}
function sacarDurmiente(f) {
  durmientes.delete(f);
  if (durmientes.size || !escuchaGlobal) return;
  escuchaGlobal = false;
  clearTimeout(temporizador);
  window.removeEventListener("scroll", alMoverseElMundo);
  window.removeEventListener("resize", alMoverseElMundo);
  document.removeEventListener("visibilitychange", alVolverVisible);
}

/* ---------- alScroll ---------- */

function progresoDe(tramo, top, alto, vh) {
  let p;
  if (tramo === "entra") {
    p = (vh - top) / Math.max(1, Math.min(vh, alto));
  } else if (tramo === "dentro") {
    const recorrido = alto - vh; // lo que la pista tiene de más sobre el escenario pegado
    p = recorrido > 0 ? -top / recorrido : top <= 0 ? 1 : 0;
  } else {
    p = (vh - top) / (vh + alto);
  }
  return limitar(p);
}

export function alScroll(el, cb, { tramo = "cruza", suavizar = 0 } = {}) {
  if (!hayDom || !el) return nada();
  if (tramo === "dentro") inyectarCss();

  // En "dentro" la altura de referencia es la del escenario pegado (100svh), no innerHeight:
  // en el celu innerHeight cambia con la barra del navegador y el progreso temblaría.
  const escena = tramo === "dentro" ? el.querySelector(":scope > [data-escena]") : null;

  let activo = false; // cerca del viewport: mide en cada cuadro
  let asentando = true; // pide medir hasta que el valor se pose (arranque, salida, salto)
  let primera = true;
  let actual = 0;
  let ultimo = NaN;
  const info = { velocidad: 0, direccion: 0 };

  const despertar = () => {
    if (!activo) asentando = true;
  };

  const medir = () => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const ref = escena ? escena.getBoundingClientRect().height || vh : vh;
    return progresoDe(tramo, r.top, r.height, ref);
  };

  const sub = bucle((t, dt) => {
    if (!activo && !asentando) return;
    const objetivo = medir();
    const lec = leerScroll(dt);
    if (primera || !(suavizar > 0) || reducido()) {
      actual = objetivo; // el primer valor es directo: no hay barrido falso al cargar
    } else {
      actual = amortiguar(actual, objetivo, suavizar, dt);
      if (Math.abs(objetivo - actual) < 0.0004) actual = objetivo;
    }
    primera = false;
    if (actual !== ultimo) {
      ultimo = actual;
      info.velocidad = lec.velocidad;
      info.direccion = lec.direccion;
      cb(actual, info);
    }
    if (!activo && actual === objetivo) asentando = false;
  });

  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(
      (entradas) => {
        activo = entradas[entradas.length - 1].isIntersecting;
        if (!activo) asentando = true; // una última pasada para dejar 0 o 1 exactos
      },
      { rootMargin: "50% 0px 50% 0px" } // margen generoso: se despierta media pantalla antes
    );
    io.observe(el);
  } else {
    activo = true;
  }
  sumarDurmiente(despertar);

  return {
    destruir() {
      sub.destruir();
      if (io) io.disconnect();
      sacarDurmiente(despertar);
    },
  };
}

/* ---------- Escenario fijo ---------- */

const CSS_ESCENARIO =
  "[data-escenario]{position:relative;height:var(--largo,300vh)}" +
  "[data-escena]{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}";
let cssInyectado = false;

function inyectarCss() {
  if (cssInyectado || !hayDom) return;
  cssInyectado = true;
  if (document.getElementById("motor-escenario-css")) return;
  const estilo = document.createElement("style");
  estilo.id = "motor-escenario-css";
  estilo.textContent = CSS_ESCENARIO;
  // al principio del head: el CSS de la página puede pisarlo sin pelear por la especificidad
  (document.head || document.documentElement).prepend(estilo);
}
// si la página ya trae escenarios, el CSS entra antes del primer dibujo y no hay salto de layout
if (hayDom && document.querySelector("[data-escenario]")) inyectarCss();

export function escenario(el, cb, { suavizar = 0.1 } = {}) {
  if (!hayDom || !el) return nada();
  inyectarCss();
  const escena = el.querySelector(":scope > [data-escena]");
  if (!escena) console.warn("escenario(): falta un hijo directo [data-escena] dentro de", el);
  return alScroll(
    el,
    (p, info) => {
      // el progreso también queda como variable CSS por si una pieza lo prefiere sobre JS
      if (escena) escena.style.setProperty("--progreso", p.toFixed(4));
      cb(p, info);
    },
    { tramo: "dentro", suavizar }
  );
}

// Reparte el progreso en tramos. cortes: [0, .25, .6, 1] → capítulo 0, 1 y 2.
export function capitulos(p, cortes) {
  const n = cortes.length - 1;
  if (n < 1) return { indice: 0, local: limitar(p) };
  let indice = 0;
  for (let k = 1; k < n; k++) if (p >= cortes[k]) indice = k;
  const a = cortes[indice];
  const b = cortes[indice + 1];
  return { indice, local: b > a ? limitar((p - a) / (b - a)) : p >= b ? 1 : 0 };
}

/* ---------- Aparecer al entrar ---------- */

export function aparecer(raiz = document, { escalon = 70, margen = "0px 0px -10% 0px", unaVez = true } = {}) {
  if (!hayDom || !raiz) return nada();
  const items = [...raiz.querySelectorAll("[data-aparecer]")];
  if (raiz.matches && raiz.matches("[data-aparecer]")) items.unshift(raiz);
  if (!items.length) return nada();

  // sin observer o con "reducir movimiento": todo ya puesto
  if (!("IntersectionObserver" in window) || reducido()) {
    items.forEach((el) => el.classList.add("se-ve"));
    return nada();
  }

  const propias = new WeakSet(); // demoras que puse yo; las que escribió la persona se respetan
  const io = new IntersectionObserver(
    (entradas) => {
      const entran = entradas
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      entran.forEach((e, i) => {
        const el = e.target;
        if (!el.style.getPropertyValue("--demora") || propias.has(el)) {
          // tope de 12 escalones: si entran 40 de golpe no esperan 3 segundos
          el.style.setProperty("--demora", Math.min(i, 12) * escalon + "ms");
          propias.add(el);
        }
        el.classList.add("se-ve");
        if (unaVez) io.unobserve(el);
      });
      if (!unaVez) {
        for (const e of entradas) {
          if (e.isIntersecting) continue;
          e.target.classList.remove("se-ve");
          if (propias.has(e.target)) e.target.style.removeProperty("--demora"); // al salir no hay espera
        }
      }
    },
    { rootMargin: margen, threshold: 0.01 }
  );
  items.forEach((el) => io.observe(el));
  return { destruir: () => io.disconnect() };
}

/* ---------- Scroll suave (inercia propia, solo rueda) ---------- */

// ¿el objetivo está dentro de algo con scroll propio? Entonces la rueda es de ese elemento.
function dentroDeScrollPropio(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 1) return true;
  }
  return false;
}

function irAlY(y) {
  // "instant" pisa el scroll-behavior: smooth de tokens.css; si no, cada cuadro lanzaría una animación nativa
  try {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, y);
  }
}

export function scrollSuave({ fuerza = 0.1 } = {}) {
  if (!hayDom) return nada();
  // dispositivo solo táctil: no hay rueda y el scroll nativo ya tiene su inercia
  if (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) return nada();

  const lineaPx = 33; // en Firefox la rueda manda "líneas": 3 líneas ≈ los 100 px de Chrome
  let objetivo = window.scrollY;
  let actual = objetivo;
  let propio = actual; // último Y que puse yo: si el real difiere, lo movió otro (barra, teclado, ancla)
  let sub = null;

  const maximo = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const resincronizar = () => {
    objetivo = actual = propio = window.scrollY;
    parar();
  };
  const parar = () => {
    if (sub) sub.destruir();
    sub = null;
  };

  const tick = (t, dt) => {
    const tope = maximo();
    objetivo = limitar(objetivo, 0, tope);
    actual = reducido() ? objetivo : amortiguar(actual, objetivo, fuerza, dt);
    if (Math.abs(objetivo - actual) < 0.3) actual = objetivo;
    irAlY(actual);
    propio = actual;
    if (actual === objetivo) parar();
  };

  const alRueda = (e) => {
    if (e.ctrlKey || e.defaultPrevented) return; // ctrl+rueda es zoom
    if (reducido()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return; // gesto horizontal: del navegador
    if (dentroDeScrollPropio(e.target)) return;
    if (Math.abs(window.scrollY - propio) > 3) resincronizar(); // lo movieron sin avisar
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= lineaPx;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    objetivo = limitar(objetivo + dy, 0, maximo());
    if (!sub) sub = bucle(tick);
  };

  const alScrollNativo = () => {
    // nuestros propios scrollTo también disparan este evento: solo cuenta si el salto es ajeno
    if (Math.abs(window.scrollY - propio) > 3) resincronizar();
  };

  window.addEventListener("wheel", alRueda, { passive: false }); // no pasivo: hace falta preventDefault
  window.addEventListener("scroll", alScrollNativo, { passive: true });
  window.addEventListener("resize", resincronizar, { passive: true });

  return {
    destruir() {
      parar();
      window.removeEventListener("wheel", alRueda);
      window.removeEventListener("scroll", alScrollNativo);
      window.removeEventListener("resize", resincronizar);
    },
  };
}
