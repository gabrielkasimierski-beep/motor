// capas.js — profundidad sin 3D (Motor webi).
//   capas(): paralaje de capas planas que se separan con el scroll + deriva con el puntero.
//   portal(): una puerta que crece hasta pasar por encima de quien mira.
// Todo va por transform (translate3d + scale): no toca layout ni pinta de nuevo.
import { escenario, limitar, reducido } from "./motor-scroll.js";
import { puntero as crearPuntero } from "./puntero.js";

const mezcla = (a, b, t) => a + (b - a) * t;
const suave = (a, b, v) => {
  const t = limitar((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// En táctil no hay "cursor": la deriva se apaga (decisión, no accidente: el dedo ya mueve la página).
const sinPuntero = () => !!window.matchMedia?.("(hover: none)").matches;

// El escenario es la pista alta; la zona del puntero es el escenario pegado, que mide lo que se ve.
const zonaDe = (elEscenario) => elEscenario.querySelector(":scope > [data-escena]") || elEscenario;

// Mientras el escenario está en pantalla las capas tienen will-change; fuera, se suelta
// (mantenerlo siempre reserva memoria de GPU para nada).
function vigilarPantalla(elEscenario, alCambiar) {
  if (typeof IntersectionObserver === "undefined") { alCambiar(true); return { disconnect() {} }; }
  const io = new IntersectionObserver((en) => alCambiar(en[en.length - 1].isIntersecting), { rootMargin: "10% 0px" });
  io.observe(elEscenario);
  return io;
}

// ---------------------------------------------------------------------------
// capas(elEscenario, { capas, puntero, suavizar }) → { cambiar(opciones), destruir() }
//   capas: [{ el, profundidad (0 = fondo lejano … 1 = primer plano), escala: [de, a], y: [de, a] en % }]
//   Sin `escala` ni `y` se deducen de la profundidad: crecen con su cuadrado, así la capa más cercana
//   se mueve y escala mucho y la más lejana casi nada. Por defecto bajan al avanzar el scroll
//   (el escenario es fijo: se siente como tilt de cámara hacia arriba).
//   puntero: { fuerza } px de deriva a profundidad 1; la deriva de cada capa es proporcional a la suya.
//     Se mueven en sentido contrario al cursor (como mirar alrededor). false / fuerza 0 la apaga.
//   suavizar: inercia del scroll, igual que en escenario().
//   Reducir movimiento: las capas quedan en su composición de reposo, sin deriva.
// ---------------------------------------------------------------------------
export function capas(elEscenario, { capas: lista = [], puntero = { fuerza: 10 }, suavizar = 0.1 } = {}) {
  const cfg = { fuerza: puntero ? (puntero.fuerza ?? 10) : 0, suavizar };

  const items = lista.map((c) => {
    const d = limitar(c.profundidad ?? 0);
    return {
      el: c.el,
      d,
      escala: c.escala ?? [1, 1 + 0.22 * d * d],
      y: c.y ?? [0, 14 * d * d],
    };
  });

  let p = 0; // progreso de scroll

  const punt = crearPuntero(zonaDe(elEscenario), { suavizar: 0.08 });

  function dibujar() {
    const quieto = reducido();
    const prog = quieto ? 0 : p;
    const deriva = !quieto && cfg.fuerza > 0 && !sinPuntero() && punt.tipo !== "touch";
    const nx = deriva ? (punt.x - 0.5) * 2 : 0;
    const ny = deriva ? (punt.y - 0.5) * 2 : 0;
    for (const c of items) {
      const y = mezcla(c.y[0], c.y[1], prog);
      const s = mezcla(c.escala[0], c.escala[1], prog);
      const dx = -nx * cfg.fuerza * c.d;
      const dy = -ny * cfg.fuerza * c.d;
      // Dos translate: el % se mide sobre la capa y los px de la deriva no se escalan.
      c.el.style.transform =
        `translate3d(0, ${y.toFixed(3)}%, 0) translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    }
  }

  let sub = null;
  function suscribir() {
    sub?.destruir();
    sub = escenario(elEscenario, (v) => { p = v; dibujar(); }, { suavizar: cfg.suavizar });
  }
  suscribir();
  dibujar();

  const quitarMover = punt.alMover(dibujar);

  const io = vigilarPantalla(elEscenario, (si) => {
    for (const c of items) c.el.style.willChange = si ? "transform" : "";
  });

  const pref = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  pref?.addEventListener?.("change", dibujar);

  return {
    cambiar(opciones = {}) {
      if (opciones.puntero !== undefined) cfg.fuerza = opciones.puntero ? (opciones.puntero.fuerza ?? 10) : 0;
      if (opciones.fuerza !== undefined) cfg.fuerza = opciones.fuerza;
      if (opciones.suavizar !== undefined && opciones.suavizar !== cfg.suavizar) {
        cfg.suavizar = opciones.suavizar;
        suscribir();
      }
      dibujar();
      return this;
    },
    destruir() {
      sub?.destruir();
      quitarMover();
      punt.destruir();
      io.disconnect();
      pref?.removeEventListener?.("change", dibujar);
      for (const c of items) { c.el.style.transform = ""; c.el.style.willChange = ""; }
    },
  };
}

// ---------------------------------------------------------------------------
// portal(elEscenario, { puerta, fondo, frente, escalaFinal, origen, suavizar }) → { cambiar(opciones), destruir() }
//   puerta: la capa con el vano transparente; escala de 1 a `escalaFinal` con curva acelerada hacia el
//     final (crece geométricamente: el zoom se siente parejo y termina rápido) desde `origen`
//     ([x, y] de 0..1 sobre la capa: el centro del vano) y se retira al final.
//   fondo: lo que se ve por el vano; se acerca mucho menos y termina a pantalla completa.
//   frente: [nubes, niebla…] más cerca que la puerta: escalan más rápido y se desvanecen.
//   Reducir movimiento: queda el final (la puerta ya pasó, el fondo a pantalla completa).
//   Sin will-change en puerta y frente: fijaría la resolución de la capa y, escalada ×9, se vería borrosa.
// ---------------------------------------------------------------------------
export function portal(elEscenario, { puerta, fondo, frente = [], escalaFinal = 9, origen = [0.5, 0.5], suavizar = 0.1 } = {}) {
  const cfg = { escalaFinal, origen, suavizar };
  let p = 0;

  function fijarOrigen() {
    const o = `${(cfg.origen[0] * 100).toFixed(2)}% ${(cfg.origen[1] * 100).toFixed(2)}%`;
    for (const el of [puerta, fondo, ...frente]) if (el) el.style.transformOrigin = o;
  }

  function dibujar() {
    const q = reducido() ? 1 : p;

    if (puerta) {
      // Arranca lenta y termina rápida: exponente > 1 sobre el progreso.
      const s = Math.pow(cfg.escalaFinal, Math.pow(q, 1.8));
      puerta.style.transform = `translate3d(0, 0, 0) scale(${s.toFixed(4)})`;
      const opacidad = 1 - suave(0.9, 1, q);
      puerta.style.opacity = opacidad.toFixed(3);
      puerta.style.visibility = opacidad <= 0.001 ? "hidden" : "";
    }

    if (fondo) {
      fondo.style.transform = `translate3d(0, 0, 0) scale(${(1 + 0.25 * q).toFixed(4)})`;
    }

    frente.forEach((el, i) => {
      // Cuanto más lejos en la lista, más cerca de la cámara: sale más rápido.
      const k = 1.5 + i * 0.5;
      const s = Math.pow(cfg.escalaFinal * k, Math.pow(q, 1.5));
      el.style.transform = `translate3d(0, 0, 0) scale(${s.toFixed(4)})`;
      const opacidad = 1 - suave(0.18 + 0.1 * i, 0.62 + 0.1 * i, q);
      el.style.opacity = opacidad.toFixed(3);
      el.style.visibility = opacidad <= 0.001 ? "hidden" : "";
    });
  }

  let sub = null;
  function suscribir() {
    sub?.destruir();
    sub = escenario(elEscenario, (v) => { p = v; dibujar(); }, { suavizar: cfg.suavizar });
  }
  fijarOrigen();
  suscribir();
  dibujar();

  // will-change solo en el fondo, y solo mientras el escenario se ve.
  const io = vigilarPantalla(elEscenario, (si) => { if (fondo) fondo.style.willChange = si ? "transform" : ""; });

  const pref = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  pref?.addEventListener?.("change", dibujar);

  return {
    cambiar(opciones = {}) {
      if (opciones.escalaFinal !== undefined) cfg.escalaFinal = opciones.escalaFinal;
      if (opciones.origen) { cfg.origen = opciones.origen; fijarOrigen(); }
      if (opciones.suavizar !== undefined && opciones.suavizar !== cfg.suavizar) {
        cfg.suavizar = opciones.suavizar;
        suscribir();
      }
      dibujar();
      return this;
    },
    destruir() {
      sub?.destruir();
      io.disconnect();
      pref?.removeEventListener?.("change", dibujar);
      for (const el of [puerta, fondo, ...frente]) {
        if (!el) continue;
        el.style.transform = ""; el.style.transformOrigin = ""; el.style.opacity = "";
        el.style.visibility = ""; el.style.willChange = "";
      }
    },
  };
}
