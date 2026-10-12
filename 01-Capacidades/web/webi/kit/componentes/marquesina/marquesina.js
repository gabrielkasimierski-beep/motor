/* ============================================================================
   marquesina · cinta infinita de contenido (palabras, logos, miniaturas).

   EL TRUCO
   El movimiento lo hace CSS y nada más: una pista que se traslada −50 % en un
   bucle lineal. La pista tiene DOS mitades idénticas; cuando la primera terminó
   de salir, la segunda ocupa exactamente su lugar y la animación recomienza sin
   que se note el corte. El JS solo:
     1. repite el contenido hasta que cada mitad sea más larga que el visor
        (si no, quedaría un hueco al final de la vuelta), y
     2. marca todo lo repetido con aria-hidden + inert para que un lector de
        pantalla y el teclado vean el contenido una sola vez.
   Así no hay requestAnimationFrame ni cálculo por cuadro: el navegador mueve
   la pista en el compositor.

   CÓMO SE USA EN HTML
     <link rel="stylesheet" href="kit/componentes/marquesina/marquesina.css">

     <div class="marquesina" data-velocidad="30" aria-label="Lo que hacemos">
       <span>Sitios con movimiento</span>
       <span>Identidad</span>
       <span>Carta digital</span>
     </div>

     <script type="module">
       import { marquesinas } from "./kit/componentes/marquesina/marquesina.js";
       marquesinas();   // arma todas las .marquesina de la página
     </script>

   Variantes (atributos del mismo div):
     data-sentido="reversa"   corre al revés
     data-eje="y"             vertical: el div necesita alto (--alto o height)
     data-velocidad="30"      segundos que tarda en pasar UNA copia del contenido
                              (si hubo que repetirlo para llenar, el tiempo se
                              multiplica y la velocidad en pantalla no cambia)
   Se frena sola al pasar el puntero o al enfocar algo adentro, y cuando sale
   de pantalla o se oculta la pestaña. Con "reducir movimiento" no corre: queda
   el contenido original quieto y se puede desplazar a mano.
   ========================================================================== */

// Todo lo repetido se apaga para el teclado y los lectores de pantalla.
function marcarClon(nodo) {
  nodo.setAttribute("aria-hidden", "true");
  nodo.setAttribute("inert", "");
  nodo.setAttribute("data-clon", "");
  nodo.removeAttribute("id");
  nodo.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
  // inert ya los saca del tab; esto cubre navegadores viejos
  const selector = "a[href], button, input, select, textarea, [tabindex]";
  if (nodo.matches(selector)) nodo.setAttribute("tabindex", "-1");
  nodo.querySelectorAll(selector).forEach((x) => x.setAttribute("tabindex", "-1"));
  return nodo;
}

export function marquesina(el, opciones = {}) {
  if (!el) return { destruir() {} };

  // Los atributos mandan; las opciones del JS son el plan B
  if (opciones.eje && !el.dataset.eje) el.dataset.eje = opciones.eje;
  if (opciones.sentido && !el.dataset.sentido) el.dataset.sentido = opciones.sentido;
  if (opciones.velocidad && !el.dataset.velocidad) el.dataset.velocidad = String(opciones.velocidad);

  // Lo que escribió la persona: elementos (y texto suelto, envuelto en un span)
  const originales = [];
  for (const nodo of Array.from(el.childNodes)) {
    if (nodo.nodeType === 1) originales.push(nodo);
    else if (nodo.nodeType === 3 && nodo.textContent.trim()) {
      const s = document.createElement("span");
      s.textContent = nodo.textContent.trim();
      originales.push(s);
    }
  }
  if (!originales.length) return { destruir() {} };

  const pista = document.createElement("div");
  pista.className = "marquesina__pista";
  const grupo = document.createElement("div");
  grupo.className = "marquesina__grupo";
  grupo.append(...originales);
  pista.append(grupo);
  el.replaceChildren(pista);
  if (el.hasAttribute("aria-label") && !el.hasAttribute("role")) el.setAttribute("role", "group");

  let veces = 0; // cuántas copias del contenido hay en cada mitad
  let copia = null; // la segunda mitad, idéntica a la primera

  const segundos = () => parseFloat(el.dataset.velocidad) || 40;
  const fijarVelocidad = () => el.style.setProperty("--vuelta", `${segundos() * veces}s`);

  function armar(n) {
    grupo.querySelectorAll("[data-clon]").forEach((x) => x.remove());
    if (copia) copia.remove();
    for (let k = 1; k < n; k++) for (const o of originales) grupo.append(marcarClon(o.cloneNode(true)));
    veces = n;
    copia = marcarClon(grupo.cloneNode(true));
    pista.append(copia);
    fijarVelocidad();
  }

  // Mide el visor y la mitad; repite el contenido solo si hace falta
  function ajustar() {
    const vertical = el.dataset.eje === "y";
    const visor = vertical ? el.clientHeight : el.clientWidth;
    const mitad = vertical ? grupo.offsetHeight : grupo.offsetWidth;
    if (!visor || !mitad) return; // oculto o sin cargar: el observer avisa cuando haya tamaño
    const base = mitad / veces; // tamaño de UNA copia
    const necesarias = Math.max(1, Math.ceil((visor + 2) / base));
    if (necesarias !== veces) armar(necesarias);
    else fijarVelocidad();
  }

  armar(1);
  ajustar();
  el.classList.add("esta-lista");

  // Pausa fuera de pantalla y con la pestaña oculta: CSS frena con .es-pausada
  let fuera = false;
  const pausar = () => el.classList.toggle("es-pausada", fuera || document.hidden);
  const io = new IntersectionObserver(
    ([e]) => {
      fuera = !e.isIntersecting;
      pausar();
    },
    { rootMargin: "60px" }
  );
  io.observe(el);
  document.addEventListener("visibilitychange", pausar);

  // Cambia el ancho, cargan las fuentes o las imágenes: se vuelve a medir (un cuadro después)
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(ajustar);
  });
  ro.observe(el);
  ro.observe(grupo);

  return {
    destruir() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", pausar);
      el.replaceChildren(...originales);
      el.classList.remove("esta-lista", "es-pausada");
      el.style.removeProperty("--vuelta");
    },
  };
}

// Atajo: arma todas las .marquesina dentro de `raiz`
export function marquesinas(raiz = document, opciones = {}) {
  const lista = [...raiz.querySelectorAll(".marquesina")].map((el) => marquesina(el, opciones));
  return {
    destruir() {
      lista.forEach((m) => m.destruir());
    },
  };
}
