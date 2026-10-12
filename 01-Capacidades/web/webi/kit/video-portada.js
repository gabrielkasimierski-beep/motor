// video-portada.js — video de portada (Motor webi).
//   videoPortada: reproduce una vez y congela, en bucle, o va y vuelve (bumerán).
//   videoConScroll: el scroll mueve la cabeza de reproducción de un clip corto.
import { bucle, escenario, amortiguar, limitar, reducido } from "./motor-scroll.js";

// Cambio instantáneo, sin fundido, aunque la página tenga transiciones en la imagen:
// el empalme video → imagen no tiene que notarse.
function mostrar(img, si) {
  if (!img) return;
  img.style.transition = "none";
  img.style.opacity = si ? "1" : "0";
  img.classList.toggle("se-ve", si);
}

// Cuando el video llega a su último cuadro la imagen ya tiene que estar decodificada.
const decodificar = (img) => img?.decode?.().catch(() => {});

// Los atributos también, no solo las propiedades: iOS y algunos navegadores leen el HTML.
function prepararMudo(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
}

// ---------------------------------------------------------------------------
// videoPortada(video, { modo, final, recorte, alTerminar }) → { reproducir(), destruir() }
//   modo "una-vez": reproduce y, al llegar al último cuadro, pausa y muestra `final`
//     (<img> con ese cuadro exacto) y `recorte` (PNG con alfa del sujeto, que va ENCIMA del título).
//   modo "bucle": loop nativo.
//   modo "bumeran": al llegar al final retrocede y vuelve a arrancar, sin corte.
//     OJO: necesita un clip todo-intra (ffmpeg -g 1). Retroceder es buscar un cuadro por vez con
//     currentTime; con un GOP largo cada búsqueda decodifica desde el keyframe anterior y se traba.
//   reproducir() vuelve a empezar desde el primer cuadro (sirve de "Repetir").
// ---------------------------------------------------------------------------
export function videoPortada(video, { modo = "una-vez", final = null, recorte = null, alTerminar } = {}) {
  prepararMudo(video);
  video.loop = modo === "bucle";
  mostrar(final, false);
  mostrar(recorte, false);
  decodificar(final);
  decodificar(recorte);

  let enPantalla = typeof IntersectionObserver === "undefined"; // se confirma con el observer
  let quiere = true;      // false cuando ya terminó o quedó quieto
  let terminado = false;
  let retrocede = false;  // bumerán: va hacia atrás
  let cabeza = 0;         // bumerán: tiempo virtual mientras retrocede
  let destruido = false;
  let lazo = null;

  const alMetadatos = (fn) => {
    if (video.readyState >= 1) fn();
    else video.addEventListener("loadedmetadata", fn, { once: true });
  };

  // Estado final quieto: el último cuadro (una-vez) o el primero (bucle, bumerán).
  function quieto() {
    quiere = false;
    retrocede = false;
    video.pause();
    if (modo === "una-vez") {
      terminado = true;
      mostrar(final, true);
      mostrar(recorte, true);
      // Sin imagen de final, el video mismo queda en su último cuadro.
      if (!final) alMetadatos(() => { video.currentTime = video.duration; });
    }
  }

  function intentarReproducir() {
    const promesa = video.play();
    if (promesa && promesa.catch) {
      promesa.catch((error) => {
        if (error && error.name === "AbortError") return; // lo interrumpió una pausa nuestra
        quieto(); // autoplay bloqueado o clip que no carga: final quieto, nunca roto
      });
    }
  }

  // Un solo lugar decide si el video debe estar corriendo.
  function actualizar() {
    if (destruido) return;
    const debe = quiere && enPantalla && !document.hidden && !retrocede && !reducido();
    if (debe && video.paused) intentarReproducir();
    else if (!debe && !video.paused) video.pause();
  }

  function alLlegarAlFinal() {
    if (terminado || retrocede) return;
    if (modo === "una-vez") {
      terminado = true;
      quiere = false;
      mostrar(final, true);
      mostrar(recorte, true);
      video.pause();
      if (alTerminar) alTerminar();
    } else if (modo === "bumeran") {
      retrocede = true;
      cabeza = video.duration;
      video.pause();
      lazo ||= bucle(retroceder);
    }
  }

  // Bumerán: la cabeza vuelve hacia atrás a velocidad normal, dentro del bucle compartido.
  function retroceder(_t, dt) {
    if (!retrocede || !enPantalla) return;
    cabeza -= dt;
    if (cabeza <= 0.02) {
      retrocede = false;
      video.currentTime = 0;
      actualizar(); // vuelve a ir hacia adelante
      return;
    }
    if (!video.seeking) video.currentTime = cabeza;
  }

  const alTerminarElVideo = () => alLlegarAlFinal();
  // timeupdate cae cada ~250 ms: sirve de red de seguridad por si ended tarda o no llega.
  const alActualizarTiempo = () => {
    if (modo === "bucle" || video.seeking || !video.duration) return;
    if (video.currentTime >= video.duration - 0.04) alLlegarAlFinal();
  };
  video.addEventListener("ended", alTerminarElVideo);
  video.addEventListener("timeupdate", alActualizarTiempo);
  document.addEventListener("visibilitychange", actualizar);

  let io = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((en) => {
      enPantalla = en[en.length - 1].isIntersecting;
      actualizar();
    }, { threshold: 0.25 });
    io.observe(video);
  }

  // "Reducir movimiento" se lee en vivo: si se activa con la página abierta, queda el estado quieto.
  const pref = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const alCambiarPreferencia = () => { if (reducido()) quieto(); };
  pref?.addEventListener?.("change", alCambiarPreferencia);

  if (reducido()) quieto();
  else actualizar();

  return {
    reproducir() {
      if (destruido) return;
      terminado = false;
      quiere = true;
      retrocede = false;
      mostrar(final, false);
      mostrar(recorte, false);
      if (reducido()) { quieto(); return; }
      video.currentTime = 0;
      intentarReproducir(); // directo: si viene de un click, cuenta como gesto de la persona
    },
    destruir() {
      destruido = true;
      video.removeEventListener("ended", alTerminarElVideo);
      video.removeEventListener("timeupdate", alActualizarTiempo);
      document.removeEventListener("visibilitychange", actualizar);
      pref?.removeEventListener?.("change", alCambiarPreferencia);
      io?.disconnect();
      lazo?.destruir();
      lazo = null;
    },
  };
}

// ---------------------------------------------------------------------------
// videoConScroll(video, elEscenario, { suavizar }) → { cambiar(opciones), destruir() }
//   El progreso del escenario (0..1) fija un tiempo objetivo; la cabeza se acerca con amortiguar
//   y solo busca (currentTime) si el video no está buscando y la diferencia supera 1/60 s.
//   Para clips cortos codificados todo-intra (-g 1): cada búsqueda cae en un cuadro completo.
//   suavizar: fracción del camino por cuadro a 60 fps (como en motor-scroll); 0 = directo.
//   Con reducido() queda el último cuadro, quieto.
// ---------------------------------------------------------------------------
export function videoConScroll(video, elEscenario, { suavizar = 0.12 } = {}) {
  const cfg = { suavizar };
  prepararMudo(video);
  video.loop = false;
  video.autoplay = false;
  video.preload = "auto";
  video.pause();

  let duracion = 0;
  let progreso = 0;
  let actual = 0;          // tiempo suavizado
  let primera = true;
  let enPantalla = false;

  function alTenerMetadatos() {
    duracion = video.duration;
    if (!(duracion > 0) || !Number.isFinite(duracion)) { duracion = 0; return; }
    // Safari de iPhone no decodifica un video que nunca arrancó: un play/pause rápido lo despierta.
    try {
      const p = video.play();
      video.pause();
      if (p && p.catch) p.catch(() => {});
    } catch { /* sin permiso: se las arregla buscando cuadros */ }
  }
  if (video.readyState >= 1) alTenerMetadatos();
  else video.addEventListener("loadedmetadata", alTenerMetadatos, { once: true });

  // El suavizado lo hacemos acá (escenario va directo) para poder cambiarlo en vivo.
  const sub = escenario(elEscenario, (p) => { progreso = p; }, { suavizar: 0 });

  const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((en) => {
    enPantalla = en[en.length - 1].isIntersecting;
    if (enPantalla) primera = true; // al volver a entrar no se barre desde donde quedó
  }, { rootMargin: "50% 0px 50% 0px" });
  io?.observe(elEscenario);
  if (!io) enPantalla = true;

  const lazo = bucle((_t, dt) => {
    if (!duracion || !enPantalla) return;
    const tope = Math.max(duracion - 0.001, 0);
    const objetivo = limitar(reducido() ? 1 : progreso) * duracion;
    if (primera || reducido()) {
      actual = objetivo;
      primera = false;
    } else {
      actual = amortiguar(actual, objetivo, cfg.suavizar, dt);
      if (Math.abs(objetivo - actual) < 1 / 240) actual = objetivo;
    }
    const destino = limitar(actual, 0, tope);
    if (!video.seeking && Math.abs(destino - video.currentTime) > 1 / 60) video.currentTime = destino;
  });

  return {
    cambiar(opciones = {}) {
      Object.assign(cfg, opciones);
      return this;
    },
    destruir() {
      sub.destruir();
      lazo.destruir();
      io?.disconnect();
      video.removeEventListener("loadedmetadata", alTenerMetadatos);
    },
  };
}
