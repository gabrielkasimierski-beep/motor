/* ============================================================================
   tarjeta-video · tarjeta de trabajo que muestra un póster y, al activarse,
   reproduce un video corto.

   EL TRUCO
   Nada se baja hasta que hace falta: el <video> nace sin src (preload="none") y
   con un <img> póster encima. Al activar la tarjeta se le pone el src y se
   reproduce; el póster se desvanece, así que no hay parpadeo. Al desactivarla
   vuelve al póster y se rebobina; si la tarjeta queda lejos de la pantalla
   (más de ~1 pantalla) se le saca el src y se llama a load(): el navegador
   libera el buffer. Quién activa depende del dispositivo, a propósito:
     · escritorio (hay hover): el puntero o el foco de teclado; con una pausa
       de 120 ms para no bajar un video por cada tarjeta que se cruza de paso.
     · táctil (sin hover): una sola tarjeta a la vez, la que está más cerca del
       centro de la pantalla mientras se hace scroll.
   El borde de luz es un conic-gradient cuyo ángulo es una propiedad registrada
   (@property --angulo) que anima el CSS; una máscara deja solo el borde.
   Con "reducir movimiento" el video no se reproduce nunca: queda el póster.

   CÓMO SE USA EN HTML
     <link rel="stylesheet" href="kit/componentes/tarjeta-video/tarjeta-video.css">

     <a class="tarjeta-video" href="/trabajos/casa-pampa">
       <div class="tarjeta-video__medio">
         <img class="tarjeta-video__poster" src="poster.jpg" alt="" width="960" height="600">
         <video class="tarjeta-video__video" data-src="clip.mp4" poster="poster.jpg"
                muted loop playsinline preload="none" aria-hidden="true"></video>
         <span class="tarjeta-video__ver">Ver →</span>
       </div>
       <div class="tarjeta-video__info">
         <span class="tarjeta-video__tipo">Identidad y sitio</span>
         <h3 class="tarjeta-video__titulo">Casa Pampa</h3>
         <p class="tarjeta-video__linea">Una bodega que se cuenta sola.</p>
       </div>
     </a>

     <script type="module">
       import { tarjetasVideo } from "./kit/componentes/tarjeta-video/tarjeta-video.js";
       tarjetasVideo();   // arma todas las .tarjeta-video de la página
     </script>

   El video va en `data-src` (o en `src`: el JS lo guarda y lo saca hasta que
   se necesite). Estados: .es-activa (hover, foco o la más centrada en táctil)
   y .es-reproduciendo (el video ya está corriendo).
   ========================================================================== */

import { reducido } from "../../motor-scroll.js";

/* ---------- Táctil: una sola tarjeta activa, la más centrada ----------
   Un solo coordinador compartido por todas las tarjetas de la página. */

const tactiles = new Set(); // { el, encender(), apagar() } de cada tarjeta
const sinHover = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(hover: none)") : null;
let montado = false; // escucha los cambios de modo mientras haya tarjetas
let escuchando = false; // escucha el scroll solo si hay tarjetas Y el dispositivo es táctil
let pendiente = 0;
let elegida = null;

function evaluar() {
  pendiente = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let mejor = null;
  let mejorD = Infinity;
  for (const t of tactiles) {
    const r = t.el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue; // fuera de pantalla
    const dy = (r.top + r.bottom) / 2 - vh / 2;
    const dx = (r.left + r.right) / 2 - vw / 2;
    if (Math.abs(dy) > vh * 0.42) continue; // asoma pero está lejos del centro: no cuenta
    const d = Math.hypot(dx, dy);
    if (d < mejorD) {
      mejorD = d;
      mejor = t;
    }
  }
  if (mejor === elegida) return;
  if (elegida) elegida.apagar();
  elegida = mejor;
  if (mejor) mejor.encender();
}

// El scroll dispara a ráfagas: se evalúa a lo sumo cada ~90 ms
function programar() {
  if (!pendiente) pendiente = setTimeout(evaluar, 90);
}

function sincronizar() {
  const hay = tactiles.size > 0;
  if (hay && !montado && sinHover) {
    sinHover.addEventListener("change", sincronizar);
    montado = true;
  } else if (!hay && montado) {
    sinHover.removeEventListener("change", sincronizar);
    montado = false;
  }
  const debe = hay && !!sinHover && sinHover.matches;
  if (debe === escuchando) return;
  escuchando = debe;
  if (debe) {
    window.addEventListener("scroll", programar, { passive: true });
    window.addEventListener("resize", programar);
    programar();
  } else {
    window.removeEventListener("scroll", programar);
    window.removeEventListener("resize", programar);
    clearTimeout(pendiente);
    pendiente = 0;
    if (elegida) elegida.apagar();
    elegida = null;
  }
}

/* ---------- Una tarjeta ---------- */

export function tarjetaVideo(el, { lejos = "120%", espera = 120 } = {}) {
  const video = el && el.querySelector("video");
  if (!video) return { destruir() {} };

  const teniaSrc = video.hasAttribute("src");
  const fuente = video.getAttribute("src") || video.dataset.src || "";
  video.removeAttribute("src"); // nace descargado: nada baja hasta activar
  video.muted = true; // sin sonido no hay bloqueo de autoplay
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  video.setAttribute("preload", "none");

  let cargado = false;
  let activa = false;
  let puntero = false;
  let foco = false;
  let tactil = false;
  let temporizador = 0;

  function cargar() {
    if (cargado) return;
    video.src = fuente;
    cargado = true;
  }

  function reproducir() {
    if (reducido() || !fuente || document.hidden) return; // quieto: queda el póster
    cargar();
    const p = video.play();
    if (p && p.catch) p.catch(() => {}); // si el navegador lo niega, queda el póster
  }

  function detener() {
    clearTimeout(temporizador);
    video.pause();
    if (cargado) {
      try {
        video.currentTime = 0; // el póster ya lo tapa: la próxima vez arranca de cero
      } catch (e) {}
    }
    el.classList.remove("es-reproduciendo");
  }

  // Lejos de pantalla: se suelta el archivo y el buffer
  function descargar() {
    detener();
    if (!cargado) return;
    video.removeAttribute("src");
    video.load();
    cargado = false;
  }

  function poner(valor) {
    if (valor === activa) return;
    activa = valor;
    el.classList.toggle("es-activa", valor);
    if (valor) {
      clearTimeout(temporizador);
      temporizador = setTimeout(reproducir, espera);
    } else {
      detener();
    }
  }
  const refrescar = () => poner(puntero || foco || tactil);

  const alEntrar = (e) => {
    if (e.pointerType === "touch") return; // el dedo lo maneja el coordinador táctil
    puntero = true;
    refrescar();
  };
  const alSalir = (e) => {
    if (e.pointerType === "touch") return;
    puntero = false;
    refrescar();
  };
  const alEnfocar = (e) => {
    foco = e.target.matches(":focus-visible"); // un clic de mouse no cuenta como foco de teclado
    refrescar();
  };
  const alDesenfocar = (e) => {
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    foco = false;
    refrescar();
  };
  const alVerse = () => el.classList.add("es-reproduciendo");
  const alPararse = () => el.classList.remove("es-reproduciendo");
  const alOcultar = () => {
    if (document.hidden) video.pause();
    else if (activa) reproducir();
  };

  el.addEventListener("pointerenter", alEntrar);
  el.addEventListener("pointerleave", alSalir);
  el.addEventListener("focusin", alEnfocar);
  el.addEventListener("focusout", alDesenfocar);
  video.addEventListener("playing", alVerse);
  video.addEventListener("pause", alPararse);
  video.addEventListener("ended", alPararse);
  document.addEventListener("visibilitychange", alOcultar);

  const registro = {
    el,
    encender() {
      tactil = true;
      refrescar();
    },
    apagar() {
      tactil = false;
      refrescar();
    },
  };
  tactiles.add(registro);
  sincronizar();

  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting && cargado) descargar();
    },
    { rootMargin: `${lejos} 0px` }
  );
  io.observe(el);

  return {
    destruir() {
      io.disconnect();
      tactiles.delete(registro);
      if (elegida === registro) elegida = null;
      sincronizar();
      el.removeEventListener("pointerenter", alEntrar);
      el.removeEventListener("pointerleave", alSalir);
      el.removeEventListener("focusin", alEnfocar);
      el.removeEventListener("focusout", alDesenfocar);
      video.removeEventListener("playing", alVerse);
      video.removeEventListener("pause", alPararse);
      video.removeEventListener("ended", alPararse);
      document.removeEventListener("visibilitychange", alOcultar);
      activa = false;
      descargar();
      el.classList.remove("es-activa", "es-reproduciendo");
      if (teniaSrc) video.setAttribute("src", fuente); // queda como estaba (preload="none": no baja)
    },
  };
}

// Atajo: arma todas las .tarjeta-video dentro de `raiz`
export function tarjetasVideo(raiz = document, opciones = {}) {
  const lista = [...raiz.querySelectorAll(".tarjeta-video")].map((el) => tarjetaVideo(el, opciones));
  return {
    destruir() {
      lista.forEach((t) => t.destruir());
    },
  };
}
