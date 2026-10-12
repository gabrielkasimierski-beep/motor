/* cargador-intro.js — entrada de página (los estilos viven en cargador-intro.css).

   QUÉ ES: una pantalla de entrada. Un lema se arma palabra por palabra, da paso al logo y la
   pantalla se abre en dos paneles hacia los costados mostrando la página. Después se saca sola
   del DOM. Mientras dura, el scroll queda bloqueado, y se devuelve siempre (termine bien, se
   salte o se destruya).

   EL TRUCO: la secuencia es una máquina de tres estados que viven como clases del contenedor
   (es-lema → es-logo → es-abriendo); el movimiento lo hacen las transiciones del CSS y el JS solo
   agenda cuándo cambiar de clase. Hay DOS copias de la escena, una en cada panel, alineadas
   para formar una sola: por eso el logo se parte al medio al abrirse. Las duraciones salen de
   una sola tabla (abajo) que el JS escribe como variables CSS, así no se desfasan.

   SE SALTEA (y llama a alTerminar igual) si ya se vio en esta sesión (sessionStorage, con
   try/catch por si está bloqueado) o si el sistema pide reducir movimiento. También se puede
   saltar a mano: tocar la pantalla o apretar Esc.

   USO:
     <link rel="stylesheet" href="…/cargador-intro.css">
     import { cargadorIntro } from "…/cargador-intro.js";
     const intro = cargadorIntro({
       lema: "Hecho a mano para vender",     // se parte en palabras (el texto es real)
       logo: "webi",                         // texto, o un nodo (se clona, no se mueve)
       alAbrir()    { … },                   // arranca el hero mientras los paneles se abren
       alTerminar() { … },                   // ya se sacó del DOM
     });

   ATADO A UNA CARGA REAL: intro.progreso(p) con p de 0 a 1. Si lo usás, no se abre hasta p = 1
   (con un tope de espera, para no dejar a nadie trabado). Llamalo enseguida —aunque sea con 0—
   o pasá { conProgreso: true }, así sabe desde el principio que tiene que esperar:
     const intro = cargadorIntro({ lema, logo, conProgreso: true });
     pelicula.alCargar = (p) => intro.progreso(p);

   Devuelve { progreso(p), saltar(), destruir(), saltado }. destruir() corta todo sin avisar. */
import { reducido } from "../../motor-scroll.js";

// Tiempos en ms. Se multiplican por `ritmo` (0.7 = más rápido). El CSS lee estos mismos valores.
const T = {
  escalon: 110, // entre una palabra y la siguiente
  palabra: 900, // lo que tarda cada palabra en armarse
  pausaLema: 350, // el lema completo se queda un momento
  salida: 600, // las palabras salen hacia arriba
  demoraLogo: 300, // el logo entra un poco después de que las palabras empiezan a irse
  logo: 900,
  pausaLogo: 500,
  abrir: 1000, // los paneles se van
};

const CLAVE = "webi-intro-visto";
let activa = null; // una sola entrada a la vez

function yaVisto(clave) {
  try { return sessionStorage.getItem(clave) === "1"; } catch { return false; }
}
function marcarVisto(clave) {
  try { sessionStorage.setItem(clave, "1"); } catch { /* storage bloqueado: no pasa nada */ }
}

// Congela el scroll sin que la página se corra por la barra que desaparece
function bloquearScroll() {
  const html = document.documentElement;
  const antes = { overflow: html.style.overflow, relleno: html.style.paddingRight };
  const barra = window.innerWidth - html.clientWidth;
  html.style.overflow = "hidden";
  if (barra > 0) html.style.paddingRight = barra + "px";
  let liberado = false;
  return () => {
    if (liberado) return;
    liberado = true;
    html.style.overflow = antes.overflow;
    html.style.paddingRight = antes.relleno;
  };
}

function crearEscena(lema, logo) {
  const escena = document.createElement("div");
  escena.className = "cargador-intro__escena";

  if (lema) {
    const p = document.createElement("p");
    p.className = "cargador-intro__lema";
    lema.trim().split(/\s+/).forEach((palabra, i, todas) => {
      const caja = document.createElement("span");
      caja.className = "cargador-intro__palabra";
      caja.style.setProperty("--i", i);
      const interior = document.createElement("span");
      interior.textContent = palabra;
      caja.append(interior);
      p.append(caja);
      if (i < todas.length - 1) p.append(" "); // el espacio es real: el texto se lee y se copia bien
    });
    escena.append(p);
  }

  if (logo) {
    const envoltura = document.createElement("div");
    envoltura.className = "cargador-intro__logo";
    if (logo instanceof Node) {
      const copia = logo.cloneNode(true);
      // Sin ids repetidos: la copia vive en el DOM junto al original
      if (copia.removeAttribute) copia.removeAttribute("id");
      copia.querySelectorAll?.("[id]").forEach((n) => n.removeAttribute("id"));
      envoltura.append(copia);
    } else {
      const texto = document.createElement("span");
      texto.className = "cargador-intro__logo-texto";
      texto.textContent = String(logo);
      envoltura.append(texto);
    }
    escena.append(envoltura);
  }
  return escena;
}

export function cargadorIntro({
  lema = "",
  logo = "",
  alAbrir,
  alTerminar,
  ritmo = 1,
  siempre = false, // true = ignora el "ya se vio" (para demostraciones)
  recordar = true, // false = no marca la sesión
  clave = CLAVE,
  conProgreso = false,
  maxEspera = 10000, // ms que espera una carga que no llega antes de abrir igual
  textoSalto = "Tocá para saltar",
} = {}) {
  if (activa) return activa;

  const avisar = (f) => { try { f?.(); } catch (err) { console.error(err); } };

  // ---- Se saltea: igual se avisa, pero después de devolver el control ----
  if (reducido() || (!siempre && yaVisto(clave))) {
    Promise.resolve().then(() => { avisar(alAbrir); avisar(alTerminar); });
    return { progreso() {}, saltar() {}, destruir() {}, saltado: true };
  }

  // ---- Armado ----
  const raiz = document.createElement("div");
  raiz.className = "cargador-intro";
  raiz.setAttribute("aria-hidden", "true"); // es ornamento: la página de atrás ya se puede leer
  raiz.dataset.cargadorIntro = "";
  const ms = (n) => Math.round(n * ritmo) + "ms";
  raiz.style.setProperty("--ci-escalon", ms(T.escalon));
  raiz.style.setProperty("--ci-palabra", ms(T.palabra));
  raiz.style.setProperty("--ci-salida", ms(T.salida));
  raiz.style.setProperty("--ci-demora-logo", ms(T.demoraLogo));
  raiz.style.setProperty("--ci-logo", ms(T.logo));
  raiz.style.setProperty("--ci-abrir", ms(T.abrir));

  const izq = document.createElement("div");
  izq.className = "cargador-intro__panel cargador-intro__panel--izq";
  izq.append(crearEscena(lema, logo));
  const der = document.createElement("div");
  der.className = "cargador-intro__panel cargador-intro__panel--der";
  der.append(crearEscena(lema, logo));

  const barra = document.createElement("div");
  barra.className = "cargador-intro__barra";
  barra.append(document.createElement("i"));
  const salto = document.createElement("span");
  salto.className = "cargador-intro__salto";
  salto.textContent = textoSalto;
  raiz.append(izq, der, barra, salto);

  const liberarScroll = bloquearScroll();
  document.body.append(raiz);

  // ---- Estado ----
  const esperas = new Set();
  const luego = (n, f) => {
    const id = setTimeout(() => { esperas.delete(id); f(); }, n * ritmo);
    esperas.add(id);
    return id;
  };
  const cortarEsperas = () => { esperas.forEach(clearTimeout); esperas.clear(); };

  let fase = "lema"; // lema → logo → listo → abriendo → fin
  let esperaCarga = conProgreso;
  let valor = 0;
  let avisadoAbrir = false;
  let terminado = false;
  let guardia = 0;

  if (conProgreso) raiz.classList.add("es-con-progreso");

  function abrir() {
    if (terminado || fase === "abriendo") return;
    fase = "abriendo";
    cortarEsperas();
    raiz.classList.add("es-abriendo");
    if (!avisadoAbrir) { avisadoAbrir = true; avisar(alAbrir); }
    luego(T.abrir + 80, () => terminar(true));
  }

  function intentarAbrir() {
    if (fase === "listo" && (!esperaCarga || valor >= 1)) abrir();
  }

  function limpiar() {
    terminado = true;
    cortarEsperas();
    document.removeEventListener("keydown", alTecla);
    raiz.removeEventListener("click", saltar);
    raiz.removeEventListener("wheel", frenarGesto);
    raiz.removeEventListener("touchmove", frenarGesto);
    raiz.remove();
    liberarScroll(); // siempre, pase lo que pase
    if (activa === api) activa = null;
  }

  function terminar(conAviso) {
    if (terminado) return;
    limpiar();
    if (conAviso) {
      if (recordar) marcarVisto(clave);
      avisar(alTerminar);
    }
  }

  function saltar() {
    if (terminado || fase === "abriendo") return;
    fase = "abriendo";
    cortarEsperas();
    raiz.classList.add("es-saltando");
    if (!avisadoAbrir) { avisadoAbrir = true; avisar(alAbrir); }
    luego(320 / ritmo, () => terminar(true)); // el desvanecido dura 0.3 s fijos
  }

  function alTecla(e) { if (e.key === "Escape") saltar(); }
  // El scroll está bloqueado en el html; esto cubre la rueda y el rebote del dedo en iOS
  function frenarGesto(e) { e.preventDefault(); }

  document.addEventListener("keydown", alTecla);
  raiz.addEventListener("click", saltar);
  raiz.addEventListener("wheel", frenarGesto, { passive: false });
  raiz.addEventListener("touchmove", frenarGesto, { passive: false });

  // ---- Secuencia ----
  const nPalabras = Math.max(1, lema.trim().split(/\s+/).filter(Boolean).length);
  const lemaCompleto = (nPalabras - 1) * T.escalon + T.palabra + T.pausaLema;
  const logoCompleto = T.demoraLogo + T.logo + T.pausaLogo;

  void raiz.offsetWidth; // fuerza el primer cuadro en reposo: sin esto no habría transición
  raiz.classList.add("es-lema");

  luego(lema ? lemaCompleto : 0, () => {
    fase = "logo";
    raiz.classList.add("es-logo");
    luego(logo ? logoCompleto : 0, () => {
      fase = "listo";
      // Si la carga real no llegó, se espera, pero no para siempre
      if (esperaCarga && valor < 1) guardia = luego(maxEspera / ritmo, abrir);
      intentarAbrir();
    });
  });

  const api = {
    progreso(p) {
      if (terminado) return;
      esperaCarga = true;
      valor = Math.min(1, Math.max(0, Number(p) || 0));
      raiz.style.setProperty("--p", valor);
      raiz.classList.add("es-con-progreso");
      if (valor >= 1) { clearTimeout(guardia); intentarAbrir(); }
    },
    saltar,
    destruir() { terminar(false); },
    saltado: false,
  };
  activa = api;
  return api;
}
