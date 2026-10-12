/* Motor webi · cuadros.js
   Película por cuadros sobre canvas: con scroll (conScroll) o con el puntero (conPuntero).
   El canvas tiene que traer su tamaño por CSS (width/height: 100% del contenedor):
   acá solo se ajusta su resolución interna, nunca su tamaño en pantalla. */

import { escenario, alScroll, bucle, amortiguar, limitar, mapear, reducido } from "./motor-scroll.js";

const hayDom = typeof window !== "undefined" && typeof document !== "undefined";
const nada = () => ({ destruir() {} });
const PARALELOS = 6; // tope de pedidos simultáneos que HTTP/1.1 acepta por servidor

/* ---------- Carga ---------- */

// El patrón lleva una tira de # (su largo es el ancho del número). Los archivos empiezan en 1.
function urlDeCuadro(patron, indice) {
  return patron.replace(/#+/, (m) => String(indice + 1).padStart(m.length, "0"));
}

// Cuadro 1, después 1 de cada 8, de cada 4, de cada 2 y todos. El último se cuela tras el
// primer barrido (1 de cada 8): así el final de una película llega temprano y no queda un salto.
function ordenProgresivo(total) {
  const visto = new Uint8Array(total);
  const orden = [];
  const poner = (i) => {
    if (i >= 0 && i < total && !visto[i]) {
      visto[i] = 1;
      orden.push(i);
    }
  };
  poner(0);
  for (let i = 0; i < total; i += 8) poner(i);
  poner(total - 1);
  for (const paso of [4, 2, 1]) for (let i = 0; i < total; i += paso) poner(i);
  return orden;
}

async function decodificarConImg(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

// fetch → blob → createImageBitmap. Si el fetch está bloqueado (file://, CORS) o el bitmap
// falla, lo baja una etiqueta <img>. Un error HTTP no se reintenta: sería pedir lo mismo dos veces.
async function cargarImagen(url, senal, alProgresoBytes) {
  let blob;
  try {
    const r = await fetch(url, { signal: senal });
    if (!r.ok) {
      const e = new Error(r.status + " " + url);
      e.definitivo = true;
      throw e;
    }
    const largo = Number(r.headers.get("content-length")) || 0;
    if (alProgresoBytes && r.body && largo) {
      const lector = r.body.getReader();
      const partes = [];
      let recibido = 0;
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        partes.push(value);
        recibido += value.length;
        alProgresoBytes(Math.min(recibido / largo, 0.98)); // 1 solo cuando ya está decodificada
      }
      blob = new Blob(partes, { type: r.headers.get("content-type") || "" });
    } else {
      blob = await r.blob();
    }
  } catch (e) {
    if (e.definitivo || (senal && senal.aborted)) throw e;
    return decodificarConImg(url);
  }
  try {
    return await createImageBitmap(blob);
  } catch {
    const u = URL.createObjectURL(blob);
    try {
      return await decodificarConImg(u);
    } finally {
      URL.revokeObjectURL(u);
    }
  }
}

const anchoDe = (img) => img.naturalWidth || img.width;
const altoDe = (img) => img.naturalHeight || img.height;

/* ---------- Película ---------- */

export function crearCuadros(canvas, { fuente, total, encaje = "cubrir", foco = [0.5, 0.5], mezclar = true, dprMax = 2, alCargar } = {}) {
  const esHoja = fuente && typeof fuente === "object";
  const columnas = esHoja ? Math.max(1, fuente.columnas | 0) : 0;
  const filas = esHoja ? Math.max(1, fuente.filas | 0) : 0;
  if (esHoja) total = total || columnas * filas;
  if (!(total >= 1)) throw new Error("crearCuadros: falta `total` (cantidad de cuadros)");
  if (!esHoja && (typeof fuente !== "string" || !fuente.includes("#"))) {
    throw new Error('crearCuadros: `fuente` es un patrón con # ("toma-####.webp") o { hoja, columnas, filas }');
  }
  total = Math.floor(total);

  const ctx = canvas.getContext("2d");
  const fx = limitar(foco[0] ?? 0.5);
  const fy = limitar(foco[1] ?? 0.5);

  const cuadros = new Array(total).fill(null); // ImageBitmap o <img> por índice (0-based)
  let hojaImg = null;
  let srcW = 0; // tamaño de UN cuadro de la fuente (se sabe al llegar el primero)
  let srcH = 0;
  let cargados = 0;
  let muerto = false;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;

  /* --- tamaño del canvas --- */
  let cssW = 0;
  let cssH = 0;
  let dprActual = 0;
  let versionTamano = 0;
  const dprDeseado = () => Math.min((hayDom && window.devicePixelRatio) || 1, dprMax);

  function aplicarTamano() {
    dprActual = dprDeseado();
    const w = Math.max(1, Math.round(cssW * dprActual));
    const h = Math.max(1, Math.round(cssH * dprActual));
    if (canvas.width !== w) canvas.width = w; // asignar width o height reinicia el contexto
    if (canvas.height !== h) canvas.height = h;
    versionTamano++;
  }

  /* --- encaje: lo usan el dibujo y punto(), así coinciden siempre --- */
  function geometria() {
    const cw = cssW;
    const ch = cssH;
    const iw = srcW || cw; // sin cuadro todavía: se supone la misma proporción que el canvas
    const ih = srcH || ch;
    const contener = encaje === "contener";
    const esc = contener ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    const w = iw * esc;
    const h = ih * esc;
    // con "cubrir" el sobrante se reparte según el foco: el punto de foco nunca queda recortado
    return { x: (cw - w) * (contener ? 0.5 : fx), y: (ch - h) * (contener ? 0.5 : fy), w, h };
  }

  /* --- dibujo --- */
  let indice = 0; // posición pedida, fraccionaria, 0..total-1
  let ultimaClave = "";

  // el cargado más cercano al pedido: se puede dibujar antes de terminar de cargar
  function cercano(i) {
    if (esHoja) return hojaImg ? Math.min(Math.max(i, 0), total - 1) : -1;
    if (cuadros[i]) return i;
    for (let d = 1; d < total; d++) {
      if (i - d >= 0 && cuadros[i - d]) return i - d;
      if (i + d < total && cuadros[i + d]) return i + d;
    }
    return -1;
  }

  function pintar(idx, g) {
    if (esHoja) {
      const cw = anchoDe(hojaImg) / columnas;
      const ch = altoDe(hojaImg) / filas;
      ctx.drawImage(hojaImg, (idx % columnas) * cw, Math.floor(idx / columnas) * ch, cw, ch, g.x, g.y, g.w, g.h);
    } else {
      ctx.drawImage(cuadros[idx], g.x, g.y, g.w, g.h);
    }
  }

  function dibujar(forzar) {
    if (muerto || !ctx || !cssW || !cssH) return;
    if (dprDeseado() !== dprActual) aplicarTamano(); // cambió el zoom o se movió de pantalla
    const base = mezclar ? Math.floor(indice) : Math.round(indice);
    const frac = mezclar ? indice - base : 0;
    const a = cercano(base);
    if (a < 0) return;
    let b = mezclar && frac > 0.004 && base + 1 < total ? cercano(base + 1) : -1;
    if (b === a) b = -1; // el vecino todavía no llegó: no tiene sentido mezclar un cuadro consigo mismo
    const alfa = b >= 0 ? Math.round(frac * 255) : 0;
    // solo se redibuja si cambió algo visible: cuadros, mezcla o tamaño
    const clave = a + "|" + b + "|" + alfa + "|" + versionTamano;
    if (!forzar && clave === ultimaClave) return;
    ultimaClave = clave;

    const g = geometria();
    ctx.setTransform(dprActual, 0, 0, dprActual, 0, 0); // se dibuja en px CSS
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, cssW, cssH);
    pintar(a, g); // abajo el cuadro de piso…
    if (b >= 0) {
      ctx.globalAlpha = alfa / 255; // …y encima el siguiente, con la fracción como opacidad
      pintar(b, g);
      ctx.globalAlpha = 1;
    }
  }

  /* --- observar tamaño --- */
  let ro = null;
  if (hayDom) {
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    if (cssW && cssH) aplicarTamano();
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entradas) => {
        const r = entradas[entradas.length - 1].contentRect;
        if (Math.abs(r.width - cssW) < 0.5 && Math.abs(r.height - cssH) < 0.5 && cssW) return;
        cssW = r.width;
        cssH = r.height;
        aplicarTamano();
        dibujar(true);
      });
      ro.observe(canvas);
    }
  }

  /* --- carga --- */
  let hechos = 0;
  let fallidos = 0;
  const informar = (p) => {
    if (!alCargar) return;
    try {
      alCargar(limitar(p));
    } catch (err) {
      console.error(err);
    }
  };

  async function cargarTodo() {
    await null; // deja volver a quien llamó antes del primer alCargar(0): su callback puede usar la película
    informar(0);
    if (esHoja) {
      try {
        hojaImg = await cargarImagen(fuente.hoja, ctrl && ctrl.signal, (p) => !muerto && informar(p));
      } catch (err) {
        if (!muerto) console.warn("cuadros: no se pudo cargar la hoja", fuente.hoja, err);
        throw new Error("no se cargó la hoja " + fuente.hoja);
      }
      if (muerto) return;
      srcW = anchoDe(hojaImg) / columnas;
      srcH = altoDe(hojaImg) / filas;
      cargados = total;
      dibujar();
      informar(1);
      return;
    }

    const orden = ordenProgresivo(total);
    let siguiente = 0;
    const trabajador = async () => {
      while (!muerto && siguiente < orden.length) {
        const i = orden[siguiente++];
        try {
          const img = await cargarImagen(urlDeCuadro(fuente, i), ctrl && ctrl.signal);
          if (muerto) {
            if (img.close) img.close();
            return;
          }
          cuadros[i] = img;
          cargados++;
          if (!srcW) {
            srcW = anchoDe(img);
            srcH = altoDe(img);
          }
          dibujar(); // si este cuadro es el más cercano al pedido, se ve ya
        } catch (err) {
          if (muerto) return;
          fallidos++;
          console.warn("cuadros: falló el cuadro", i + 1, err.message || err);
        }
        hechos++;
        if (hechos < total) informar(hechos / total); // progreso real: cuadros que ya llegaron / totales (el 1 va al final)
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALELOS, total) }, trabajador));
    if (muerto) return;
    if (!cargados) throw new Error("no se cargó ningún cuadro de " + fuente);
    informar(1);
  }

  const lista = cargarTodo().then(() => ({ cargados, fallidos, total }));
  lista.catch(() => {}); // si nadie la espera, que no avise "unhandled rejection"; quien la use igual la recibe rechazada

  /* --- API --- */
  const irA = (i) => {
    indice = limitar(i, 0, total - 1);
    dibujar();
  };

  return {
    lista,
    total,
    irA, // índice 0-based, puede ser fraccionario (entre dos cuadros)
    ir: (p) => irA(limitar(p) * (total - 1)),
    // x, y de 0..1 sobre la imagen fuente → px CSS dentro del canvas (mismo encaje que el dibujo)
    punto(x, y) {
      const g = geometria();
      return { x: g.x + x * g.w, y: g.y + y * g.h };
    },
    destruir() {
      muerto = true;
      if (ctrl) ctrl.abort();
      if (ro) ro.disconnect();
      for (let i = 0; i < cuadros.length; i++) {
        if (cuadros[i] && cuadros[i].close) cuadros[i].close();
        cuadros[i] = null;
      }
      if (hojaImg && hojaImg.close) hojaImg.close();
      hojaImg = null;
    },
  };
}

/* ---------- Con scroll ---------- */

// Un escenario fijo ([data-escenario] > [data-escena]) reparte su progreso en los cuadros.
// Sin esa estructura, el elemento se recorre de punta a punta mientras cruza la pantalla.
export function conScroll(pelicula, elEscenario, { tramo = [0, 1], suavizar = 0.12 } = {}) {
  const alProgreso = (p) => {
    // "reducir movimiento": un cuadro quieto (el final), sin recorrer la película con el scroll
    pelicula.ir(reducido() ? 1 : mapear(p, tramo[0], tramo[1], 0, 1));
  };
  const esEscenario = elEscenario.hasAttribute("data-escenario") || elEscenario.querySelector(":scope > [data-escena]");
  return esEscenario
    ? escenario(elEscenario, alProgreso, { suavizar })
    : alScroll(elEscenario, alProgreso, { tramo: "cruza", suavizar });
}

/* ---------- Con el puntero ---------- */

const VUELTA = (Math.PI * 2) / 9; // el barrido tarda 9 s en ir y volver

export function conPuntero(pelicula, zona, { eje = "x", suavizar = 0.14, reposo = { tras: 6000, modo: "barrido" } } = {}) {
  if (!hayDom || !zona) return nada();
  const esX = eje !== "y";
  const tras = (reposo && reposo.tras) ?? 6000;
  const barrer = !reposo || reposo.modo !== "quieto";
  const touchAntes = zona.style.touchAction;
  // táctil: el eje elegido es del dedo, el otro sigue siendo scroll de la página
  zona.style.touchAction = esX ? "pan-y" : "pan-x";

  let objetivo = 0.5;
  let actual = 0.5;
  let enviado = NaN;
  let ultimaActividad = performance.now();
  let barrido = null; // { t0, fase0 } mientras la zona está en reposo
  let arrastre = null; // dedo apoyado: { id, c0, p0 }
  let quieto = false; // ya se mostró el cuadro del medio por "reducir movimiento"
  let sub = null;

  const marcar = () => {
    ultimaActividad = performance.now();
  };
  const coord = (e) => (esX ? e.clientX : e.clientY);
  const largo = (r) => (esX ? r.width : r.height);

  function alMover(e) {
    const r = zona.getBoundingClientRect();
    if (e.pointerType === "touch") {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      // táctil relativo: arrastrar el ancho de la zona recorre todo el rango, sin saltar al apoyar
      objetivo = limitar(arrastre.p0 + (coord(e) - arrastre.c0) / Math.max(1, largo(r)));
    } else {
      objetivo = limitar((coord(e) - (esX ? r.left : r.top)) / Math.max(1, largo(r)));
    }
    marcar();
  }
  function alBajar(e) {
    if (e.pointerType !== "touch") return;
    arrastre = { id: e.pointerId, c0: coord(e), p0: objetivo };
    marcar();
  }
  function alSoltar(e) {
    if (arrastre && e.pointerId === arrastre.id) arrastre = null;
    marcar();
  }

  function tick(t, dt) {
    if (reducido()) {
      // "reducir movimiento": el cuadro del medio y nada más
      if (!quieto) {
        quieto = true;
        pelicula.ir(0.5);
      }
      return;
    }
    quieto = false;
    if (barrer && !arrastre && performance.now() - ultimaActividad > tras) {
      // en reposo: seno lento que arranca desde donde quedó, así no hay salto al empezar
      if (!barrido) barrido = { t0: t, fase0: Math.asin(limitar((objetivo - 0.5) * 2, -1, 1)) };
      objetivo = 0.5 + 0.5 * Math.sin(barrido.fase0 + (t - barrido.t0) * VUELTA);
    } else {
      barrido = null;
    }
    actual = amortiguar(actual, objetivo, suavizar, dt);
    if (Math.abs(objetivo - actual) < 0.0002) actual = objetivo;
    if (actual !== enviado) {
      enviado = actual;
      pelicula.ir(actual); // se busca en cada llamada: así se puede envolver pelicula.ir desde afuera
    }
  }

  // la zona solo anima mientras se ve; al volver a verse, el tiempo de reposo cuenta desde cero
  let io = null;
  const encender = () => {
    marcar();
    barrido = null;
    if (!sub) sub = bucle(tick);
  };
  const apagar = () => {
    if (sub) sub.destruir();
    sub = null;
  };
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver((es) => (es[es.length - 1].isIntersecting ? encender() : apagar()), { rootMargin: "10% 0px" });
    io.observe(zona);
  } else {
    encender();
  }

  zona.addEventListener("pointermove", alMover);
  zona.addEventListener("pointerdown", alBajar);
  zona.addEventListener("pointerup", alSoltar);
  zona.addEventListener("pointercancel", alSoltar); // el navegador toma el gesto (scroll vertical)

  return {
    destruir() {
      apagar();
      if (io) io.disconnect();
      zona.removeEventListener("pointermove", alMover);
      zona.removeEventListener("pointerdown", alBajar);
      zona.removeEventListener("pointerup", alSoltar);
      zona.removeEventListener("pointercancel", alSoltar);
      zona.style.touchAction = touchAntes;
    },
  };
}
