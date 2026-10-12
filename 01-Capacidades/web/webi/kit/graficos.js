/* Motor webi — gráficos en SVG para pantallas de app.
   barras · area · chispa · dona · dial · matriz
   Cada función devuelve un <svg> (con .destruir() colgado) que toma sus colores de variables CSS
   (tokens.css), así cambia solo con el tema. Ver kit/CONTRATO.md.

   Opciones comunes: { alto, formato /(n)=>string/, etiqueta /aria-label/, color /"--acento"/, animar = true }
   Los gráficos de ancho libre (barras, area, chispa, matriz) rehacen su viewBox al ancho real del
   contenedor, así el texto nunca se estira. dona y dial son cuadrados: escalan con max-width. */

const NS = "http://www.w3.org/2000/svg";
const CARACTER = 6; // ancho aprox. de un carácter mono de 10 px; alcanza para reservar márgenes
const PALETA = ["--acento", "--bruma", "--tenue", "--acento-hondo", "--linea-fuerte"];
let contador = 0;

/* ================= formato es-AR ================= */

const memo = new Map();
const intl = (clave, opciones) => {
  if (!memo.has(clave)) memo.set(clave, new Intl.NumberFormat("es-AR", opciones));
  return memo.get(clave);
};

// "120 mil", "1,5 M": el compacto de Intl en es-AR da "120 k", que acá no se dice
function compacto(v) {
  const a = Math.abs(v);
  const dec = (x) => intl("d", { maximumFractionDigits: 1 }).format(x);
  if (a < 1000) return formatos.numero(v);
  if (Math.round(a / 100) / 10 < 1000) return `${dec(v / 1000)} mil`;
  if (Math.round(a / 1e5) / 10 < 1000) return `${dec(v / 1e6)} M`;
  return `${dec(v / 1e9)} mil M`;
}

export const formatos = {
  numero: (v) => intl("n", { maximumFractionDigits: 2 }).format(v),
  compacto,
  pesos: (v) => intl("p", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v),
  porcentaje: (v) => intl("%", { maximumFractionDigits: 0 }).format(v) + "%",
};

/* ================= utilidades puras ================= */

const escapar = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const f = (x) => (Number.isFinite(x) ? String(+x.toFixed(2)) : "0");
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const anchoTexto = (s) => String(s).length * CARACTER;
const variable = (c, porDefecto) => {
  const v = c || porDefecto;
  return /^--/.test(v) ? `var(${v})` : v;
};
const normalizar = (def, op = {}) => {
  const r = { ...def };
  for (const k in op) if (op[k] !== undefined) r[k] = op[k];
  return r;
};
const reducido = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Menor paso "lindo" (1, 2, 2.5 o 5 × 10^k) que sea >= minimo. entero: sin decimales. */
function pasoLindo(minimo, entero = false) {
  if (!(minimo > 0)) return 1;
  const k = Math.floor(Math.log10(minimo));
  for (let e = k; e <= k + 1; e++) {
    for (const m of [1, 2, 2.5, 5]) {
      const p = +(m * 10 ** e).toPrecision(12);
      if (entero && (p < 1 || !Number.isInteger(p))) continue;
      if (p >= minimo * (1 - 1e-9)) return p;
    }
  }
  return +(10 ** (k + 2)).toPrecision(12);
}

/* Escala con pocas marcas redondas. Con dos máximos (doble eje) usa el mismo número de
   intervalos para los dos, así las líneas de guía coinciden.
   → { intervalos, pasos: [..], topes: [..] } */
export function escalaLinda(maximos, { entero = false, intervalos = [3, 4, 5] } = {}) {
  const lista = [].concat(maximos).map((m) => (m > 0 ? m : 0));
  let mejor = null;
  for (const n of intervalos) {
    const pasos = lista.map((m) => (m > 0 ? pasoLindo(m / n, entero) : 1));
    // cuánto se pasa el tope del dato (1 = justo); un intervalo de más cuesta un poco
    const costo = lista.reduce((s, m, i) => s + (m > 0 ? (pasos[i] * n) / m : 1), 0) + n * 0.01;
    if (!mejor || costo < mejor.costo - 1e-9) mejor = { n, pasos, costo };
  }
  return { intervalos: mejor.n, pasos: mejor.pasos, topes: mejor.pasos.map((p) => +(p * mejor.n).toPrecision(12)) };
}

/* Qué etiquetas del eje X se muestran para que no se pisen (siempre arranca en la primera). */
export function indicesVisibles(cantidad, espacioPorItem, anchoEtiqueta) {
  const salto = Math.max(1, Math.ceil(anchoEtiqueta / Math.max(1, espacioPorItem)));
  const r = [];
  for (let i = 0; i < cantidad; i += salto) r.push(i);
  return r;
}

const trazoRecto = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("");

/* Curva suave que no se pasa de los datos (cúbica monótona, Fritsch–Carlson). */
export function trazoSuave(pts) {
  const n = pts.length;
  if (n < 3) return trazoRecto(pts);
  const dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${f(x0 + h)} ${f(y0 + t[i] * h)} ${f(x1 - h)} ${f(y1 - t[i + 1] * h)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}

/* Barra con las dos esquinas de arriba redondeadas. */
function barraRedonda(x, y, w, h) {
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${f(x)} ${f(y + h)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h)}Z`;
}

/* Porciones de la dona en grados (0° = derecha, horario; arranca a las 12 en punto). */
export function porciones(valores, separacion = 3) {
  const limpios = valores.map((v) => Math.max(0, +v || 0));
  const total = limpios.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return [];
  const gap = limpios.filter((v) => v > 0).length > 1 ? separacion : 0;
  let a = -90;
  return limpios.map((v) => {
    const barrido = (v / total) * 360;
    const a0 = a + gap / 2;
    const a1 = Math.min(a + barrido - gap / 2, a0 + 359.99);
    a += barrido;
    return { frac: v / total, a0, a1: Math.max(a1, a0 + (v > 0 ? 0.3 : 0)), vacia: v <= 0 };
  });
}

export function arcoDona(cx, cy, r, a0, a1) {
  const rad = (g) => (g * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

/* Segmentos del dial: arco de 270° abierto abajo. */
export function segmentosDial(proporcion, n = 36, inicio = 135, barrido = 270) {
  const llenos = Math.round(entre(proporcion, 0, 1) * n);
  return Array.from({ length: n }, (_, i) => ({ angulo: inicio + ((i + 0.5) / n) * barrido, lleno: i < llenos }));
}

/* ================= tooltip compartido (un solo <div>) ================= */

let tip = null;
let duenio = null;
let alOcultarDuenio = null;
let escuchando = false;

function elTip() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "g-tip";
    tip.setAttribute("role", "status"); // región viva: lo leen también quienes navegan con teclado
    document.body.append(tip);
  }
  return tip;
}

function ocultarTodo() {
  if (tip) tip.classList.remove("es-visible");
  if (escuchando) {
    escuchando = false;
    removeEventListener("scroll", ocultarTodo, true);
    removeEventListener("resize", ocultarTodo);
    removeEventListener("pointerdown", tocoAfuera, true);
  }
  const cb = alOcultarDuenio;
  duenio = null;
  alOcultarDuenio = null;
  cb?.();
}

function tocoAfuera(e) {
  if (duenio && !duenio.contains(e.target)) ocultarTodo();
}

function ocultarTip(quien) {
  if (duenio === quien) ocultarTodo();
}

function mostrarTip(quien, contenido, x, y, alOcultar) {
  if (duenio && duenio !== quien) ocultarTodo(); // el anterior apaga su resalte
  const el = elTip();
  el.replaceChildren();
  const t = document.createElement("div");
  t.className = "g-tip-t";
  t.textContent = contenido.titulo ?? "";
  el.append(t);
  for (const fila of contenido.filas) {
    const r = document.createElement("div");
    r.className = "g-tip-f";
    if (fila.color) {
      const m = document.createElement("i");
      m.style.background = fila.color;
      r.append(m);
    }
    const n = document.createElement("span");
    n.textContent = fila.nombre ?? "";
    const v = document.createElement("b");
    v.textContent = fila.valor;
    r.append(n, v);
    el.append(r);
  }
  const ancho = el.offsetWidth, alto = el.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const px = entre(x - ancho / 2, 8, Math.max(8, vw - ancho - 8));
  let py = y - alto - 12;
  if (py < 8) py = y + 16; // si no entra arriba, va abajo
  el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
  el.classList.add("es-visible");
  duenio = quien;
  alOcultarDuenio = alOcultar;
  if (!escuchando) {
    escuchando = true;
    addEventListener("scroll", ocultarTodo, { passive: true, capture: true });
    addEventListener("resize", ocultarTodo);
    addEventListener("pointerdown", tocoAfuera, true);
  }
}

/* Puntero, táctil y teclado sobre un gráfico. cfg:
   cantidad(geo) · indiceDe(e, geo, [ux, uy]) · contenido(i, geo) · ancla(i, geo) → [x, y] del viewBox
   resaltar(i, geo) · saltos(geo) → { izq, der, arr, aba } (cuánto se mueve el índice con cada flecha) */
function interactuar(svg, geoDe, cfg) {
  let activo = -1;
  const reinicio = () => { activo = -1; cfg.resaltar(-1, geoDe()); };

  const aUnidades = (e) => {
    const r = svg.getBoundingClientRect(), k = svg.viewBox.baseVal.width / (r.width || 1);
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };
  const ir = (i) => {
    if (i === activo) return;
    const geo = geoDe();
    if (i < 0) { ocultarTip(svg); reinicio(); return; }
    activo = i;
    cfg.resaltar(i, geo);
    const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
    const [ux, uy] = cfg.ancla(i, geo);
    mostrarTip(svg, cfg.contenido(i, geo), r.left + ux * k, r.top + uy * k, reinicio);
  };

  const alPuntero = (e) => ir(cfg.indiceDe(e, geoDe(), aUnidades(e)));
  const alSalir = (e) => { if (e.pointerType === "mouse") ir(-1); }; // en táctil queda hasta tocar afuera
  const alTecla = (e) => {
    if (e.key === "Escape") { ir(-1); return; }
    const geo = geoDe(), s = cfg.saltos(geo), total = cfg.cantidad(geo);
    let i = activo < 0 ? 0 : activo;
    const paso = { ArrowRight: s.der, ArrowLeft: s.izq, ArrowDown: s.aba, ArrowUp: s.arr }[e.key];
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = total - 1;
    else if (paso) i += paso;
    else return;
    e.preventDefault();
    if (i < 0 || i > total - 1) return; // en el borde la flecha no hace nada (no salta al otro extremo)
    ir(i);
  };
  const alFoco = () => {
    let teclado = true;
    try { teclado = svg.matches(":focus-visible"); } catch { /* navegador viejo: mostrar igual */ }
    if (teclado && activo < 0) ir(0);
  };
  const alDesenfocar = () => ir(-1);

  svg.addEventListener("pointermove", alPuntero);
  svg.addEventListener("pointerdown", alPuntero);
  svg.addEventListener("pointerleave", alSalir);
  svg.addEventListener("keydown", alTecla);
  svg.addEventListener("focus", alFoco);
  svg.addEventListener("blur", alDesenfocar);
  return {
    reiniciar() { ocultarTip(svg); reinicio(); },
    destruir() {
      svg.removeEventListener("pointermove", alPuntero);
      svg.removeEventListener("pointerdown", alPuntero);
      svg.removeEventListener("pointerleave", alSalir);
      svg.removeEventListener("keydown", alTecla);
      svg.removeEventListener("focus", alFoco);
      svg.removeEventListener("blur", alDesenfocar);
      ocultarTip(svg);
    },
  };
}

/* ================= estilos (se inyectan una sola vez) ================= */

const CSS = `
.g-svg{display:block;width:100%;height:auto;color:var(--acento);touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.g-svg:focus-visible{outline:2px solid var(--acento);outline-offset:4px;border-radius:var(--r-chico)}
.g-dona,.g-dial{margin-inline:auto}
.g-txt{font:500 10px/1 var(--f-mono);fill:var(--bruma);letter-spacing:.02em}
.g-grilla,.g-base{stroke-width:1;shape-rendering:crispEdges}
.g-grilla{stroke:var(--linea)}
.g-base{stroke:var(--linea-fuerte)}
.g-resalte{fill:var(--linea);opacity:0;transition:opacity var(--d-corta) var(--curva-salida),transform var(--d-corta) var(--curva-salida)}
.g-resalte.es-activa{opacity:1}
.g-barra{transform-box:fill-box;transform-origin:50% 100%;transition:transform var(--d-larga) var(--curva-salida) calc(var(--i,0)*40ms)}
.g-linea{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;transition:stroke-dashoffset calc(var(--d-larga)*1.4) var(--curva-ida-vuelta)}
.g-chispa .g-linea{stroke-width:1.75}
.g-relleno{stroke:none;transition:opacity var(--d-larga) var(--curva-salida) var(--d-media)}
.g-final{fill:currentColor;transition:opacity var(--d-media) var(--curva-salida) calc(var(--d-larga)*1.2)}
.g-halo{fill:currentColor;opacity:.22;transition:opacity var(--d-media) var(--curva-salida) calc(var(--d-larga)*1.2)}
.g-marca{opacity:0;transition:opacity var(--d-corta)}
.g-marca.es-activa{opacity:1}
.g-marca line{stroke:var(--linea-fuerte);stroke-width:1}
.g-marca circle{fill:var(--tinta-2);stroke:currentColor;stroke-width:2}
.g-arco{fill:none;stroke-dasharray:1 2;transition:stroke-dashoffset var(--d-larga) var(--curva-salida) calc(var(--i,0)*120ms),opacity var(--d-corta)}
.g-anillo{fill:none;stroke:var(--linea)}
.g-svg.tiene-activo .g-arco:not(.es-activa){opacity:.35}
.g-centro-valor{font:800 30px/1 var(--f-titulo);fill:var(--hueso);text-anchor:middle;font-variant-numeric:tabular-nums}
.g-centro-nota{font:500 10px/1 var(--f-mono);fill:var(--bruma);text-anchor:middle;letter-spacing:.12em;text-transform:uppercase}
.g-seg{stroke:var(--linea-fuerte);stroke-linecap:round;transition:stroke var(--d-media) var(--curva-salida) calc(var(--i,0)*22ms)}
.g-seg[data-on]{stroke:currentColor}
.g-punto{fill:currentColor;transform-box:fill-box;transform-origin:center;transition:transform var(--d-media) var(--curva-rebote) var(--demora,0ms),opacity var(--d-media) var(--curva-salida) var(--demora,0ms)}
.g-punto.es-activa{stroke:var(--hueso);stroke-width:1.5}
.g-svg[data-anim="esperando"] .g-barra{transform:scaleY(0)}
.g-svg[data-anim="esperando"] .g-linea,.g-svg[data-anim="esperando"] .g-arco{stroke-dashoffset:1}
.g-svg[data-anim="esperando"] .g-relleno,.g-svg[data-anim="esperando"] .g-final,.g-svg[data-anim="esperando"] .g-halo{opacity:0}
.g-svg[data-anim="esperando"] .g-seg[data-on]{stroke:var(--linea-fuerte)}
.g-svg[data-anim="esperando"] .g-punto{transform:scale(.2);opacity:0}
@media (prefers-reduced-motion:reduce){
.g-svg[data-anim] .g-barra,.g-svg[data-anim] .g-punto{transform:none;opacity:1}
.g-svg[data-anim] .g-linea,.g-svg[data-anim] .g-arco{stroke-dashoffset:0}
.g-svg[data-anim] .g-relleno,.g-svg[data-anim] .g-final{opacity:1}
.g-svg[data-anim] .g-halo{opacity:.22}
.g-svg[data-anim] .g-seg[data-on]{stroke:currentColor}
}
.g-tip{position:fixed;left:0;top:0;z-index:1000;min-width:6rem;max-width:16rem;padding:.5rem .65rem;border:1px solid var(--linea-fuerte);border-radius:var(--r-chico);background:var(--superficie);color:var(--hueso);font:500 var(--t-nota)/1.3 var(--f-texto);pointer-events:none;opacity:0;transition:opacity var(--d-corta) var(--curva-salida)}
.g-tip.es-visible{opacity:1}
.g-tip-t{margin-bottom:.35rem;font:500 var(--t-etiqueta)/1.2 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--bruma)}
.g-tip-f{display:flex;align-items:center;gap:.5rem}
.g-tip-f i{flex:none;width:.5rem;height:.5rem;border-radius:2px}
.g-tip-f span{color:var(--bruma)}
.g-tip-f b{margin-left:auto;padding-left:.75rem;font:500 var(--t-nota)/1.3 var(--f-mono);white-space:nowrap}
`;

function estilos() {
  if (typeof document === "undefined" || document.querySelector("style[data-graficos]")) return;
  const s = document.createElement("style");
  s.setAttribute("data-graficos", "");
  s.textContent = CSS;
  document.head.append(s);
}

/* ================= armado común del <svg> ================= */

/* def: { dibujar(ancho) → { html, alto, ancho?, geo }, aria, interaccion?(svg, geoDe), fijo?, maxAncho?, alAparecer?(svg, geo) } */
function crear(tipo, op, def) {
  estilos();
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", `g-svg g-${tipo}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", op.etiqueta || def.aria);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.setProperty("color", variable(op.color, "--acento"));
  if (def.maxAncho) svg.style.maxWidth = `${def.maxAncho}px`;

  const anima = op.animar !== false && !reducido();
  svg.dataset.anim = anima ? "esperando" : "listo";

  let geo = null, anchoActual = 0, interaccion = null, io = null, ro = null, limpiarExtra = null;
  const pintar = (w) => {
    anchoActual = w;
    const r = def.dibujar(w, anima);
    svg.setAttribute("viewBox", `0 0 ${f(r.ancho ?? w)} ${f(r.alto)}`);
    svg.innerHTML = r.html;
    geo = r.geo;
    interaccion?.reiniciar();
  };
  pintar(op.ancho || 640);

  if (def.interaccion && geo && geo.cantidad > 0) {
    svg.setAttribute("tabindex", "0");
    interaccion = def.interaccion(svg, () => geo);
  }

  if (!def.fijo && !op.ancho && typeof ResizeObserver === "function") {
    ro = new ResizeObserver((entradas) => {
      const w = Math.round(entradas[0].contentRect.width);
      if (w > 0 && w !== anchoActual) pintar(w);
    });
    ro.observe(svg);
  }

  const revelar = () => {
    io?.disconnect();
    io = null;
    svg.dataset.anim = "listo";
    limpiarExtra = def.alAparecer ? def.alAparecer(svg, geo) : null;
  };
  if (anima) {
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) revelar(); }, { rootMargin: "0px 0px -10% 0px" });
      io.observe(svg);
    } else revelar();
  }

  svg.destruir = () => {
    io?.disconnect();
    ro?.disconnect();
    interaccion?.destruir();
    limpiarExtra?.();
  };
  return svg;
}

/* ================= barras ================= */

/* datos: [{ etiqueta, valor, valor2? }]. Con valor2 hay dos series emparejadas.
   Extras: nombres ["Ventas","Pedidos"], color2, formato2, formatoEje, formatoEje2,
   escalaDoble (cada serie con su eje, el segundo a la derecha), entero. */
function dibujarBarras(datos, op, ancho) {
  const n = datos.length, alto = op.alto;
  const dos = datos.some((d) => d.valor2 != null);
  const dual = dos && op.escalaDoble;
  const v1 = datos.map((d) => Math.max(0, +d.valor || 0));
  const v2 = datos.map((d) => Math.max(0, +d.valor2 || 0));
  const m1 = Math.max(0, ...v1), m2 = Math.max(0, ...v2);
  const escala = escalaLinda(dual ? [m1, m2] : [Math.max(m1, m2)], { entero: op.entero });
  const k = escala.intervalos, tope1 = escala.topes[0], tope2 = dual ? escala.topes[1] : tope1;
  const marcas = Array.from({ length: k + 1 }, (_, j) => j);
  const eje1 = marcas.map((j) => op.formatoEje(escala.pasos[0] * j));
  const eje2 = dual ? marcas.map((j) => op.formatoEje2(escala.pasos[1] * j)) : [];
  const izq = Math.max(...eje1.map(anchoTexto)) + 12;
  const der = dual ? Math.max(...eje2.map(anchoTexto)) + 12 : 4;
  const arriba = 8, abajo = 24;
  const x0 = izq, x1 = ancho - der, yBase = alto - abajo, altoPlot = yBase - arriba;
  const banda = Math.max(1, (x1 - x0) / Math.max(1, n));
  const c1 = variable(op.color, "--acento"), c2 = variable(op.color2, "--tenue");

  let html = "";
  marcas.forEach((j) => {
    const y = yBase - (j / k) * altoPlot;
    html += `<line class="${j === 0 ? "g-base" : "g-grilla"}" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y)}" y2="${f(y)}"/>`;
    html += `<text class="g-txt" x="${f(x0 - 8)}" y="${f(y)}" dy=".35em" text-anchor="end">${escapar(eje1[j])}</text>`;
    if (dual) html += `<text class="g-txt" x="${f(x1 + 8)}" y="${f(y)}" dy=".35em">${escapar(eje2[j])}</text>`;
  });
  html += `<rect class="g-resalte" x="0" y="${f(arriba)}" width="${f(banda)}" height="${f(altoPlot)}" rx="6"/>`;

  const grupo = Math.min(banda * (dos ? 0.78 : 0.62), dos ? 60 : 44);
  const sep = dos ? Math.min(3, grupo * 0.08) : 0;
  const w = dos ? (grupo - sep) / 2 : grupo;
  const alturas = [];
  datos.forEach((d, i) => {
    const gx = x0 + banda * (i + 0.5) - grupo / 2;
    const h1 = v1[i] > 0 ? Math.max(2, (v1[i] / tope1) * altoPlot) : 0;
    const h2 = dos && v2[i] > 0 ? Math.max(2, (v2[i] / tope2) * altoPlot) : 0;
    alturas.push(Math.max(h1, h2));
    if (h1) html += `<path class="g-barra" style="--i:${i};fill:${escapar(c1)}" d="${barraRedonda(gx, yBase - h1, w, h1)}"/>`;
    if (h2) html += `<path class="g-barra" style="--i:${i};fill:${escapar(c2)}" d="${barraRedonda(gx + w + sep, yBase - h2, w, h2)}"/>`;
  });

  const anchoEtq = Math.max(0, ...datos.map((d) => anchoTexto(d.etiqueta ?? ""))) + 10;
  for (const i of indicesVisibles(n, banda, anchoEtq)) {
    html += `<text class="g-txt" x="${f(x0 + banda * (i + 0.5))}" y="${f(yBase + 16)}" text-anchor="middle">${escapar(datos[i].etiqueta ?? "")}</text>`;
  }
  return { html, alto, geo: { cantidad: n, x0, banda, yBase, arriba, altoPlot, alturas, v1, v2, dos, c1, c2 } };
}

function barras(datos = [], opciones = {}) {
  datos = Array.isArray(datos) ? datos : [];
  const op = normalizar({
    alto: 220, formato: formatos.numero, formatoEje: formatos.compacto, color: "--acento", color2: "--tenue",
    nombres: [], escalaDoble: false, entero: false,
  }, opciones);
  op.formato2 ??= op.formato;
  op.formatoEje2 ??= op.formatoEje;
  const dos = datos.some((d) => d.valor2 != null);
  const [n1 = "Valor", n2 = "Valor 2"] = op.nombres;
  let aria = "Gráfico de barras sin datos.";
  if (datos.length) {
    const mayor = datos.reduce((a, d) => ((+d.valor || 0) > (+a.valor || 0) ? d : a), datos[0]);
    aria = `Gráfico de barras${dos ? ` de ${n1} y ${n2}` : ""}, ${datos.length} valores. Valor máximo${dos ? ` de ${n1.toLowerCase()}` : ""}: ${op.formato(+mayor.valor || 0)} (${mayor.etiqueta}).`;
  }
  return crear("barras", op, {
    aria,
    dibujar: (ancho) => dibujarBarras(datos, op, ancho),
    interaccion: (svg, geoDe) => {
      const resalte = () => svg.querySelector(".g-resalte");
      return interactuar(svg, geoDe, {
        cantidad: (g) => g.cantidad,
        indiceDe: (e, g, [ux]) => {
          const i = Math.floor((ux - g.x0) / g.banda);
          return i >= 0 && i < g.cantidad ? i : -1;
        },
        contenido: (i, g) => {
          const filas = [{ color: g.c1, nombre: g.dos ? n1 : "", valor: op.formato(g.v1[i]) }];
          if (g.dos) filas.push({ color: g.c2, nombre: n2, valor: op.formato2(g.v2[i]) });
          return { titulo: String(datos[i].etiqueta ?? ""), filas };
        },
        ancla: (i, g) => [g.x0 + g.banda * (i + 0.5), g.yBase - g.alturas[i]],
        resaltar: (i, g) => {
          const r = resalte();
          if (!r) return;
          r.classList.toggle("es-activa", i >= 0);
          if (i >= 0) r.style.transform = `translateX(${f(g.x0 + g.banda * i)}px)`;
        },
        saltos: () => ({ izq: -1, der: 1, arr: 0, aba: 0 }),
      });
    },
  });
}

/* ================= area ================= */

function degrade(id, alfa) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:currentColor;stop-opacity:${alfa}"/><stop offset="1" style="stop-color:currentColor;stop-opacity:0"/></linearGradient></defs>`;
}

function dibujarArea(datos, op, ancho, id) {
  const n = datos.length, alto = op.alto;
  const vals = datos.map((d) => Math.max(0, +d.valor || 0));
  const escala = escalaLinda([Math.max(0, ...vals)], { entero: op.entero });
  const k = escala.intervalos, tope = escala.topes[0];
  const marcas = Array.from({ length: k + 1 }, (_, j) => j);
  const eje = marcas.map((j) => op.formatoEje(escala.pasos[0] * j));
  const izq = Math.max(...eje.map(anchoTexto)) + 12, der = 14, arriba = 10, abajo = 24;
  const x0 = izq, x1 = ancho - der, yBase = alto - abajo, altoPlot = yBase - arriba;
  const X = (i) => (n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1));
  const Y = (v) => yBase - (v / tope) * altoPlot;

  let html = degrade(id, 0.32);
  marcas.forEach((j) => {
    const y = yBase - (j / k) * altoPlot;
    html += `<line class="${j === 0 ? "g-base" : "g-grilla"}" x1="${f(x0)}" x2="${f(x1)}" y1="${f(y)}" y2="${f(y)}"/>`;
    html += `<text class="g-txt" x="${f(x0 - 8)}" y="${f(y)}" dy=".35em" text-anchor="end">${escapar(eje[j])}</text>`;
  });
  const pts = vals.map((v, i) => [X(i), Y(v)]);
  const trazo = op.suave ? trazoSuave(pts) : trazoRecto(pts);
  html += `<path class="g-relleno" style="fill:url(#${id})" d="${trazo}L${f(X(n - 1))} ${f(yBase)}L${f(X(0))} ${f(yBase)}Z"/>`;
  html += `<path class="g-linea" pathLength="1" d="${trazo}"/>`;

  const anchoEtq = Math.max(0, ...datos.map((d) => anchoTexto(d.etiqueta ?? ""))) + 12;
  for (const i of indicesVisibles(n, n > 1 ? (x1 - x0) / (n - 1) : x1 - x0, anchoEtq)) {
    html += `<text class="g-txt" x="${f(X(i))}" y="${f(yBase + 16)}" text-anchor="${i === 0 ? "start" : "middle"}">${escapar(datos[i].etiqueta ?? "")}</text>`;
  }
  const [ux, uy] = pts[n - 1];
  html += `<circle class="g-final" cx="${f(ux)}" cy="${f(uy)}" r="3.5"/>`;
  html += `<g class="g-marca"><line x1="0" x2="0" y1="${f(arriba)}" y2="${f(yBase)}"/><circle r="4.5" cx="0" cy="0"/></g>`;
  return { html, alto, geo: { cantidad: n, x0, x1, X, Y, vals, yBase, arriba } };
}

function area(datos = [], opciones = {}) {
  datos = Array.isArray(datos) ? datos : [];
  const op = normalizar({ alto: 200, formato: formatos.numero, formatoEje: formatos.compacto, color: "--acento", suave: true, entero: false }, opciones);
  const id = `g-grad-${++contador}`;
  let aria = "Gráfico de área sin datos.";
  if (datos.length) {
    const v = datos.map((d) => +d.valor || 0), i = v.indexOf(Math.max(...v));
    aria = `Gráfico de área, ${datos.length} valores, de ${op.formato(v[0])} (${datos[0].etiqueta}) a ${op.formato(v[v.length - 1])} (${datos[v.length - 1].etiqueta}). Máximo ${op.formato(v[i])} (${datos[i].etiqueta}).`;
  }
  return crear("area", op, {
    aria,
    dibujar: (ancho) => dibujarArea(datos.length ? datos : [{ etiqueta: "", valor: 0 }], op, ancho, id),
    interaccion: !datos.length ? null : (svg, geoDe) => {
      const marca = () => svg.querySelector(".g-marca");
      return interactuar(svg, geoDe, {
        cantidad: (g) => (datos.length ? g.cantidad : 0),
        indiceDe: (e, g, [ux]) => {
          if (g.cantidad === 1) return 0;
          const i = Math.round(((ux - g.x0) / (g.x1 - g.x0)) * (g.cantidad - 1));
          return ux < g.x0 - 20 || ux > g.x1 + 20 ? -1 : entre(i, 0, g.cantidad - 1);
        },
        contenido: (i, g) => ({ titulo: String(datos[i].etiqueta ?? ""), filas: [{ color: variable(op.color, "--acento"), nombre: "", valor: op.formato(g.vals[i]) }] }),
        ancla: (i, g) => [g.X(i), g.Y(g.vals[i])],
        resaltar: (i, g) => {
          const m = marca();
          if (!m) return;
          m.classList.toggle("es-activa", i >= 0);
          if (i >= 0) {
            const x = g.X(i);
            const [l, c] = [m.querySelector("line"), m.querySelector("circle")];
            l.setAttribute("x1", f(x)); l.setAttribute("x2", f(x));
            c.setAttribute("cx", f(x)); c.setAttribute("cy", f(g.Y(g.vals[i])));
          }
        },
        saltos: () => ({ izq: -1, der: 1, arr: 0, aba: 0 }),
      });
    },
  });
}

/* ================= chispa ================= */

function dibujarChispa(valores, op, ancho, id) {
  const alto = op.alto, pad = 6, n = valores.length;
  const min = Math.min(...valores), max = Math.max(...valores);
  const X = (i) => (n === 1 ? ancho / 2 : pad + ((ancho - pad * 2) * i) / (n - 1));
  const Y = (v) => (max === min ? alto / 2 : alto - pad - ((v - min) / (max - min)) * (alto - pad * 2));
  const pts = valores.map((v, i) => [X(i), Y(v)]);
  const trazo = trazoSuave(pts);
  let html = "";
  if (op.relleno) {
    html += degrade(id, 0.22);
    html += `<path class="g-relleno" style="fill:url(#${id})" d="${trazo}L${f(X(n - 1))} ${f(alto)}L${f(X(0))} ${f(alto)}Z"/>`;
  }
  html += `<path class="g-linea" pathLength="1" d="${trazo}"/>`;
  const [ux, uy] = pts[n - 1];
  html += `<circle class="g-halo" cx="${f(ux)}" cy="${f(uy)}" r="6"/><circle class="g-final" cx="${f(ux)}" cy="${f(uy)}" r="3"/>`;
  return { html, alto, geo: { cantidad: 0 } };
}

function chispa(valores = [], opciones = {}) {
  const vals = (Array.isArray(valores) ? valores : []).map((v) => +v || 0);
  const op = normalizar({ alto: 40, formato: formatos.numero, color: "--acento", relleno: true }, opciones);
  const datos = vals.length ? vals : [0];
  const id = `g-grad-${++contador}`;
  const aria = vals.length
    ? `Tendencia de ${vals.length} valores: de ${op.formato(vals[0])} a ${op.formato(vals[vals.length - 1])}, mínimo ${op.formato(Math.min(...vals))}, máximo ${op.formato(Math.max(...vals))}.`
    : "Tendencia sin datos.";
  return crear("chispa", op, { aria, dibujar: (ancho) => dibujarChispa(datos, op, ancho, id) });
}

/* ================= dona ================= */

function dibujarDona(datos, op) {
  const T = 200, c = T / 2, R = 96, grosor = op.grosor, r = R - grosor / 2;
  const valores = datos.map((d) => Math.max(0, +d.valor || 0));
  const total = valores.reduce((s, v) => s + v, 0);
  const trozos = porciones(valores, op.separacion);
  let html = `<circle class="g-anillo" cx="${c}" cy="${c}" r="${f(r)}" stroke-width="${grosor}"/>`;
  const medios = [];
  trozos.forEach((t, i) => {
    medios.push((t.a0 + t.a1) / 2);
    if (t.vacia) return;
    const color = variable(datos[i].color, PALETA[i % PALETA.length]);
    html += `<path class="g-arco" data-i="${i}" pathLength="1" style="--i:${i};stroke:${escapar(color)}" stroke-width="${grosor}" d="${arcoDona(c, c, r, t.a0, t.a1)}"/>`;
  });
  if (op.centro !== false) {
    const cen = op.centro || {};
    const valor = String(cen.valor ?? op.formato(total));
    const tam = valor.length > 9 ? 18 : valor.length > 6 ? 24 : 30;
    html += `<text class="g-centro-valor" x="${c}" y="${c - 2}" dy=".35em" style="font-size:${tam}px">${escapar(valor)}</text>`;
    html += `<text class="g-centro-nota" x="${c}" y="${c + 20}">${escapar(cen.etiqueta ?? "total")}</text>`;
  }
  return { html, alto: T, ancho: T, geo: { cantidad: datos.length, c, R, valores, total, trozos, medios } };
}

function dona(datos = [], opciones = {}) {
  datos = Array.isArray(datos) ? datos : [];
  const op = normalizar({ alto: 200, formato: formatos.numero, grosor: 22, separacion: 3, centro: undefined }, opciones);
  const total = datos.reduce((s, d) => s + Math.max(0, +d.valor || 0), 0);
  const aria = datos.length && total > 0
    ? `Gráfico de dona: ${datos.map((d) => `${d.etiqueta} ${formatos.porcentaje((Math.max(0, +d.valor || 0) / total) * 100)}`).join(", ")}.`
    : "Gráfico de dona sin datos.";
  return crear("dona", op, {
    aria,
    fijo: true,
    maxAncho: op.alto,
    dibujar: () => dibujarDona(datos, op),
    interaccion: (svg, geoDe) => interactuar(svg, geoDe, {
      cantidad: (g) => g.cantidad,
      indiceDe: (e) => {
        const el = e.target.closest?.("[data-i]");
        return el ? +el.dataset.i : -1;
      },
      contenido: (i, g) => {
        const frac = g.total > 0 ? g.valores[i] / g.total : 0;
        return {
          titulo: String(datos[i].etiqueta ?? ""),
          filas: [{ color: variable(datos[i].color, PALETA[i % PALETA.length]), nombre: formatos.porcentaje(frac * 100), valor: op.formato(g.valores[i]) }],
        };
      },
      ancla: (i, g) => {
        const a = ((g.medios[i] ?? -90) * Math.PI) / 180;
        return [g.c + g.R * Math.cos(a), g.c + g.R * Math.sin(a)];
      },
      resaltar: (i) => {
        svg.classList.toggle("tiene-activo", i >= 0);
        svg.querySelectorAll(".g-arco").forEach((a) => a.classList.toggle("es-activa", +a.dataset.i === i));
      },
      saltos: () => ({ izq: -1, der: 1, arr: -1, aba: 1 }),
    }),
  });
}

/* ================= dial ================= */

function dibujarDial(valor, op, inicial) {
  const cx = 100, cy = 100, rFuera = 92, rDentro = 76;
  const prop = op.max > 0 ? entre(valor / op.max, 0, 1) : 0;
  let html = "";
  segmentosDial(prop, op.segmentos).forEach((s, i) => {
    const a = (s.angulo * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
    html += `<line class="g-seg"${s.lleno ? " data-on" : ""} style="--i:${i}" stroke-width="6" x1="${f(cx + rDentro * co)}" y1="${f(cy + rDentro * si)}" x2="${f(cx + rFuera * co)}" y2="${f(cy + rFuera * si)}"/>`;
  });
  html += `<text class="g-centro-valor" x="${cx}" y="${cy - 2}" dy=".35em" style="font-size:36px">${escapar(op.formato(inicial ? 0 : valor))}</text>`;
  if (op.etiquetaCentro) html += `<text class="g-centro-nota" x="${cx}" y="${cy + 24}">${escapar(op.etiquetaCentro)}</text>`;
  return { html, alto: 176, ancho: 200, geo: { cantidad: 0 } };
}

function dial(valor = 0, opciones = {}) {
  const op = normalizar({ alto: 170, max: 100, segmentos: 36, color: "--acento", etiquetaCentro: "" }, opciones);
  op.formato ??= op.max === 100 ? (n) => `${Math.round(n)}%` : formatos.numero;
  const v = +valor || 0;
  const aria = `${op.etiquetaCentro ? op.etiquetaCentro + ": " : "Valor: "}${op.formato(v)}${op.max === 100 ? "" : ` de ${op.formato(op.max)}`}.`;
  let animando = op.animar !== false && !reducido();
  return crear("dial", op, {
    aria,
    fijo: true,
    maxAncho: Math.round((op.alto * 200) / 176),
    dibujar: () => dibujarDial(v, op, animando),
    alAparecer: (svg) => {
      const texto = svg.querySelector(".g-centro-valor");
      if (!texto || !animando) return null;
      animando = false;
      const t0 = performance.now(), dur = 900;
      let raf = 0;
      const paso = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        texto.textContent = op.formato(v * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
      return () => cancelAnimationFrame(raf);
    },
  });
}

/* ================= matriz ================= */

/* valores: number[][] (filas × columnas). Extras: filas ["Lun",..], columnas ["11",..], formato. */
function dibujarMatriz(valores, op, ancho) {
  const nf = valores.length, nc = Math.max(1, ...valores.map((r) => r.length));
  const etqF = op.filas, etqC = op.columnas;
  const izq = etqF.length ? Math.max(...etqF.map(anchoTexto)) + 10 : 0;
  const arriba = etqC.length ? 20 : 0;
  const celdaX = Math.max(4, (ancho - izq) / nc);
  const celdaY = entre(celdaX * 0.6, 24, 40);
  const radio = Math.min(celdaX, celdaY) * 0.38;
  const alto = arriba + nf * celdaY;
  const max = Math.max(0, ...valores.flat().map((v) => +v || 0));
  const cx = (c) => izq + celdaX * (c + 0.5), cy = (r) => arriba + celdaY * (r + 0.5);

  let html = "";
  if (etqC.length) {
    for (const c of indicesVisibles(nc, celdaX, Math.max(...etqC.map(anchoTexto)) + 6)) {
      html += `<text class="g-txt" x="${f(cx(c))}" y="8" text-anchor="middle">${escapar(etqC[c] ?? "")}</text>`;
    }
  }
  valores.forEach((fila, r) => {
    if (etqF.length) html += `<text class="g-txt" x="${f(izq - 8)}" y="${f(cy(r))}" dy=".35em" text-anchor="end">${escapar(etqF[r] ?? "")}</text>`;
    for (let c = 0; c < nc; c++) {
      if (fila[c] == null) continue;
      const v = Math.max(0, +fila[c] || 0), p = max > 0 ? v / max : 0;
      html += `<circle class="g-punto" data-i="${r * nc + c}" style="--demora:${(r + c) * 22}ms;fill-opacity:${f(0.1 + 0.9 * p ** 0.85)}" cx="${f(cx(c))}" cy="${f(cy(r))}" r="${f(radio)}"/>`;
    }
  });
  return { html, alto, geo: { cantidad: nf * nc, nf, nc, cx, cy, valores, max } };
}

function matriz(valores = [], opciones = {}) {
  valores = Array.isArray(valores) ? valores.map((r) => (Array.isArray(r) ? r : [])) : [];
  const op = normalizar({ formato: formatos.numero, color: "--acento", filas: [], columnas: [] }, opciones);
  let aria = "Mapa de intensidad sin datos.";
  const plano = valores.flat().map((v) => +v || 0);
  if (plano.length) {
    const nc = Math.max(...valores.map((r) => r.length)), i = plano.indexOf(Math.max(...plano));
    const r = Math.floor(i / nc), c = i % nc;
    aria = `Mapa de intensidad de ${valores.length} filas por ${nc} columnas. Mayor valor: ${op.formato(plano[i])} (${op.filas[r] ?? `fila ${r + 1}`}, ${op.columnas[c] ?? `columna ${c + 1}`}).`;
  }
  return crear("matriz", op, {
    aria,
    dibujar: (ancho) => dibujarMatriz(valores, op, ancho),
    interaccion: (svg, geoDe) => interactuar(svg, geoDe, {
      cantidad: (g) => g.cantidad,
      indiceDe: (e) => {
        const el = e.target.closest?.("[data-i]");
        return el ? +el.dataset.i : -1;
      },
      contenido: (i, g) => {
        const r = Math.floor(i / g.nc), c = i % g.nc;
        const titulo = [op.filas[r], op.columnas[c]].filter((x) => x != null).join(" · ");
        return { titulo, filas: [{ color: variable(op.color, "--acento"), nombre: "", valor: op.formato(+g.valores[r][c] || 0) }] };
      },
      ancla: (i, g) => [g.cx(i % g.nc), g.cy(Math.floor(i / g.nc)) - 8],
      resaltar: (i) => {
        svg.querySelectorAll(".g-punto").forEach((p) => p.classList.toggle("es-activa", +p.dataset.i === i));
      },
      saltos: (g) => ({ izq: -1, der: 1, arr: -g.nc, aba: g.nc }),
    }),
  });
}

export { barras, area, chispa, dona, dial, matriz };

/* Para probar la lógica pura sin navegador (ver la prueba en node). */
export const calculo = {
  pasoLindo, escalaLinda, indicesVisibles, trazoSuave, porciones, arcoDona, segmentosDial, barraRedonda,
  dibujar: { barras: dibujarBarras, area: dibujarArea, chispa: dibujarChispa, dona: dibujarDona, dial: dibujarDial, matriz: dibujarMatriz },
};
