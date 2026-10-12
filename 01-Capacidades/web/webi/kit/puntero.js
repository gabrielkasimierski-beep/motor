// puntero.js — puntero suavizado y "foco que revela" (Motor webi).
// puntero(zona) da una posición 0..1 con inercia; foco(elArriba) abre una ventana blanda
// en la imagen de arriba para dejar ver la de abajo.
import { bucle, amortiguar, limitar, reducido } from "./motor-scroll.js";

// `suavizar` es la fracción del camino que se recorre por cuadro a 60 fps (el `lambda` de amortiguar):
// 0.1 = 10 % por cuadro; 0 = sin inercia.
const mezcla = (a, b, t) => a + (b - a) * t;
const suave = (a, b, v) => {
  const t = limitar((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// puntero(zona) → { x, y (0..1 suavizados), dentro, tipo, alMover(cb), destruir() }
//   alMover(cb): cb(x, y) cada vez que cambia la posición suavizada; devuelve una función que lo quita.
//   tipo: "mouse" | "pen" | "touch" | null (el del último evento), para decidir qué hacer en táctil.
//   Al salir el mouse, la posición vuelve al centro (reposo); el dedo se queda donde levantó.
// ---------------------------------------------------------------------------
export function puntero(zona, { suavizar = 0.15 } = {}) {
  let x = 0.5, y = 0.5;          // lo que se lee (suavizado)
  let objX = 0.5, objY = 0.5;    // hacia dónde va
  let dentro = false, tipo = null, lazo = null;
  const oyentes = new Set();

  const avisar = () => { for (const cb of oyentes) cb(x, y); };

  function paso(_t, dt) {
    x = amortiguar(x, objX, suavizar, dt);
    y = amortiguar(y, objY, suavizar, dt);
    if (Math.abs(x - objX) < 5e-4 && Math.abs(y - objY) < 5e-4) {
      x = objX; y = objY;
      dormir();
    }
    avisar();
  }
  function despertar() { if (!lazo) lazo = bucle(paso); }
  function dormir() {
    // Se suelta el bucle recién cuando termina el cuadro, para no tocar la lista mientras se recorre.
    const viejo = lazo;
    lazo = null;
    if (viejo) queueMicrotask(() => viejo.destruir());
  }
  function ir() {
    if (suavizar > 0) despertar();
    else { x = objX; y = objY; avisar(); }
  }

  function apuntar(e) {
    const r = zona.getBoundingClientRect();
    if (!r.width || !r.height) return;
    tipo = e.pointerType || "mouse";
    dentro = true;
    objX = limitar((e.clientX - r.left) / r.width);
    objY = limitar((e.clientY - r.top) / r.height);
    ir();
  }
  function salir(e) {
    dentro = false;
    if ((e.pointerType || tipo) === "touch") return;
    objX = 0.5; objY = 0.5;
    ir();
  }

  const pasivo = { passive: true };
  zona.addEventListener("pointerenter", apuntar, pasivo);
  zona.addEventListener("pointermove", apuntar, pasivo);
  zona.addEventListener("pointerdown", apuntar, pasivo);
  zona.addEventListener("pointerleave", salir, pasivo);
  zona.addEventListener("pointercancel", salir, pasivo);

  return {
    get x() { return x; },
    get y() { return y; },
    get dentro() { return dentro; },
    get tipo() { return tipo; },
    alMover(cb) {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    destruir() {
      zona.removeEventListener("pointerenter", apuntar);
      zona.removeEventListener("pointermove", apuntar);
      zona.removeEventListener("pointerdown", apuntar);
      zona.removeEventListener("pointerleave", salir);
      zona.removeEventListener("pointercancel", salir);
      lazo?.destruir();
      lazo = null;
      oyentes.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// foco(elArriba, { radio, nucleo, suavizar }) → { cambiar(opciones), destruir() }
//   Dos imágenes idénticas salvo lo que se revela, una encima de la otra. elArriba lleva una máscara
//   que abre un agujero blando: núcleo transparente (se ve la de abajo) y un borde que se funde.
//   radio: px del borde exterior.  nucleo: fracción del radio que queda del todo abierta (0..0.95).
//   La zona de puntero es el padre de elArriba. Variables CSS que escribe en elArriba:
//     --foco-x / --foco-y (centro), --foco-r (radio), --foco-n (núcleo), --foco-b (ancho del borde blando)
//   Con el mouse sigue al cursor; con el dedo, al dedo (arrastre horizontal; el vertical sigue siendo
//   scroll). Sin interacción pasea sola por una curva lenta. Con reducido() queda quieta en el centro.
// ---------------------------------------------------------------------------

// El alfa de la máscara es el que recorta (negro opaco = se ve elArriba), no un color visible.
// Cinco paradas siguen una curva suave para que el borde no se vea como un anillo.
const MASCARA =
  "radial-gradient(circle at var(--foco-x) var(--foco-y)," +
  "transparent 0, transparent var(--foco-n)," +
  "rgb(0 0 0 / .16) calc(var(--foco-n) + var(--foco-b) * .25)," +
  "rgb(0 0 0 / .5) calc(var(--foco-n) + var(--foco-b) * .5)," +
  "rgb(0 0 0 / .84) calc(var(--foco-n) + var(--foco-b) * .75)," +
  "#000 var(--foco-r))";

export function foco(elArriba, { radio = 260, nucleo = 0.4, suavizar = 0.18 } = {}) {
  const cfg = { radio, nucleo, suavizar };
  const zona = elArriba.parentElement || elArriba;
  const estilo = elArriba.style;

  // La zona entrega la posición cruda: el foco suaviza una sola vez, acá abajo.
  const punt = puntero(zona, { suavizar: 0 });
  const touchAntes = zona.style.touchAction;
  zona.style.touchAction = "pan-y";

  // Valores iniciales en % para que, antes del primer cálculo, la ventana ya esté centrada.
  estilo.setProperty("--foco-x", "50%");
  estilo.setProperty("--foco-y", "50%");
  estilo.setProperty("--foco-r", "150px");
  estilo.setProperty("--foco-n", "60px");
  estilo.setProperty("--foco-b", "90px");
  for (const p of ["mask-image", "-webkit-mask-image"]) estilo.setProperty(p, MASCARA);
  for (const p of ["mask-repeat", "-webkit-mask-repeat"]) estilo.setProperty(p, "no-repeat");
  for (const p of ["mask-size", "-webkit-mask-size"]) estilo.setProperty(p, "100% 100%");

  // Medidas en caché: no se lee el layout en cada cuadro.
  let ancho = 0, alto = 0;
  const medir = () => {
    const r = elArriba.getBoundingClientRect();
    ancho = r.width; alto = r.height;
  };
  medir();
  const ro = new ResizeObserver(medir);
  ro.observe(elArriba);

  let visible = false;
  const io = new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; });
  io.observe(elArriba);

  // Última interacción real (para saber cuándo empezar a pasear sola).
  let ultimo = -1e9, uX = 0.5, uY = 0.5;
  const quitar = punt.alMover((px, py) => {
    if (!punt.dentro) return;   // al salir, el puntero vuelve al centro: eso no cuenta como posición
    ultimo = performance.now();
    uX = px; uY = py;
  });

  let cx = 0, cy = 0, iniciado = false;
  let paseo = 2;     // segundos paseando; arranca alto para que sin interacción empiece enseguida
  let reloj = 0;
  let previo = { x: NaN, y: NaN, r: NaN, n: NaN };

  function pintar(x, y, r, n) {
    // Solo se toca el DOM si algo cambió: re-rasterizar una máscara grande cuesta.
    if (Math.abs(x - previo.x) < 0.05 && Math.abs(y - previo.y) < 0.05 && r === previo.r && n === previo.n) return;
    previo = { x, y, r, n };
    estilo.setProperty("--foco-x", x.toFixed(1) + "px");
    estilo.setProperty("--foco-y", y.toFixed(1) + "px");
    estilo.setProperty("--foco-r", r.toFixed(1) + "px");
    estilo.setProperty("--foco-n", n.toFixed(1) + "px");
    estilo.setProperty("--foco-b", (r - n).toFixed(1) + "px");
  }

  const lazo = bucle((_t, dt) => {
    if (!visible || !ancho || !alto) return;
    reloj += dt;

    let ox, oy;
    if (reducido()) {
      ox = 0.5; oy = 0.5; paseo = 0;
    } else {
      const ocioso = (performance.now() - ultimo) / 1000;
      const espera = punt.tipo === "touch" ? 2.5 : 1;   // el dedo se queda un rato donde levantó
      if (punt.dentro || ocioso < espera) {
        ox = uX; oy = uY; paseo = 0;
      } else {
        // Curva lenta (dos senos de frecuencias distintas). Se mezcla desde la última posición
        // durante ~1.6 s para que no haya un salto al empezar a pasear.
        paseo += dt;
        const m = suave(0, 1.6, paseo);
        ox = mezcla(uX, 0.5 + 0.3 * Math.sin(reloj * 0.5), m);
        oy = mezcla(uY, 0.5 + 0.22 * Math.sin(reloj * 0.7 + 1.3), m);
      }
    }

    if (!iniciado || reducido() || cfg.suavizar <= 0) {
      cx = ox * ancho; cy = oy * alto; iniciado = true;
    } else {
      cx = amortiguar(cx, ox * ancho, cfg.suavizar, dt);
      cy = amortiguar(cy, oy * alto, cfg.suavizar, dt);
    }

    // En pantallas chicas el radio se acota al tamaño de la imagen.
    const r = Math.min(cfg.radio, Math.min(ancho, alto) * 0.46);
    pintar(cx, cy, r, r * limitar(cfg.nucleo, 0, 0.95));
  });

  return {
    cambiar(opciones = {}) {
      Object.assign(cfg, opciones);
      return this;
    },
    destruir() {
      lazo.destruir();
      io.disconnect();
      ro.disconnect();
      quitar();
      punt.destruir();
      zona.style.touchAction = touchAntes;
      for (const p of ["--foco-x", "--foco-y", "--foco-r", "--foco-n", "--foco-b",
        "mask-image", "-webkit-mask-image", "mask-repeat", "-webkit-mask-repeat", "mask-size", "-webkit-mask-size"]) {
        estilo.removeProperty(p);
      }
    },
  };
}
