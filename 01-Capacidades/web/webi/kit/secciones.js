/* Motor webi — secciones.js
   Lo mínimo que piden las bandas de secciones.css. Sin dependencias: cada función
   recibe el elemento de la banda y devuelve { destruir() }.

   navQueSeAsienta(nav, opciones)        nav pegada: gana fondo al bajar + menú móvil ([data-menu])
   contar(raiz)                          [data-contar="1250"] cuenta desde 0 al entrar en pantalla
   cuentaRegresiva(el, fechaISO, op)     "12 d 04 h 31 m 08 s" hasta una fecha
   alternarPrecios(raiz, opciones)       interruptor [data-modalidad] sobre [data-mensual][data-anual]
   filtrar(raiz)                         pastillas [data-filtro] sobre ítems [data-categoria]
   mensajeWhatsApp(form, { numero })     arma el mensaje y abre wa.me; no manda nada a ningún servidor
*/

const nada = () => ({ destruir() {} });
const hayDom = typeof document !== "undefined";

// "Reducir movimiento" se lee en vivo: la persona puede cambiarlo con la página abierta.
const sinMovimiento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Número a texto es-AR sin depender de los datos de idioma del navegador:
   puntos de miles (también en 4 cifras) y coma decimal. */
function aTexto(valor, decimales = 0) {
  const [entera, dec] = Math.abs(valor).toFixed(decimales).split(".");
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (valor < 0 ? "-" : "") + miles + (dec ? "," + dec : "");
}

/* ---------- Nav que se asienta ---------- */

// Gana fondo y línea (.es-asentada) al pasar `umbral` px. Si hay [data-menu] (el botón)
// también maneja el panel de móvil: .es-abierto en la nav, Escape y clic afuera lo cierran.
export function navQueSeAsienta(nav, { umbral = 24 } = {}) {
  if (!hayDom || !nav) return nada();

  let asentada = null;     // así el DOM se toca solo cuando cambia el estado
  let pendiente = false;
  const medir = () => {
    pendiente = false;
    const ya = window.scrollY > umbral;
    if (ya !== asentada) { asentada = ya; nav.classList.toggle("es-asentada", ya); }
  };
  const alScroll = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(medir); } };
  addEventListener("scroll", alScroll, { passive: true });
  medir();

  const boton = nav.querySelector("[data-menu]");
  const abrir = (si) => {
    if (!boton) return;
    nav.classList.toggle("es-abierto", si);
    boton.setAttribute("aria-expanded", String(si));
    boton.setAttribute("aria-label", si ? "Cerrar menú" : "Abrir menú");
  };
  const alBoton = () => abrir(!nav.classList.contains("es-abierto"));
  const alLink = (e) => { if (e.target.closest("a")) abrir(false); };
  const alTeclado = (e) => {
    if (e.key === "Escape" && nav.classList.contains("es-abierto")) { abrir(false); boton.focus(); }
  };
  const alFuera = (e) => { if (!nav.contains(e.target)) abrir(false); };
  // Al pasar a escritorio el panel deja de existir: se cierra para no quedar "abierto" por detrás.
  const escritorio = matchMedia("(min-width: 60em)");
  const alCambiar = () => { if (escritorio.matches) abrir(false); };

  if (boton) {
    boton.addEventListener("click", alBoton);
    nav.addEventListener("click", alLink);
    document.addEventListener("keydown", alTeclado);
    document.addEventListener("pointerdown", alFuera);
    escritorio.addEventListener("change", alCambiar);
  }

  return {
    destruir() {
      removeEventListener("scroll", alScroll);
      if (boton) {
        boton.removeEventListener("click", alBoton);
        nav.removeEventListener("click", alLink);
        document.removeEventListener("keydown", alTeclado);
        document.removeEventListener("pointerdown", alFuera);
        escritorio.removeEventListener("change", alCambiar);
      }
    },
  };
}

/* ---------- Números que cuentan ---------- */

// <p data-contar="1250" data-prefijo="+" data-sufijo=" m²" data-decimales="0" data-duracion="1800">
// El HTML lleva el número final escrito: sin JS o con "reducir movimiento" se lee igual.
export function contar(raiz = document) {
  if (!hayDom || !raiz) return nada();
  const items = [...raiz.querySelectorAll("[data-contar]")].map((el) => {
    const crudo = String(el.dataset.contar).trim();
    const fin = parseFloat(crudo.replace(",", "."));
    return {
      el, fin,
      decimales: el.dataset.decimales != null ? Math.max(0, parseInt(el.dataset.decimales, 10) || 0) : (crudo.split(/[.,]/)[1] || "").length,
      prefijo: el.dataset.prefijo || "",
      sufijo: el.dataset.sufijo || "",
      duracion: parseInt(el.dataset.duracion, 10) || 1800,
      id: 0,
    };
  }).filter((d) => Number.isFinite(d.fin));
  if (!items.length) return nada();

  const poner = (d, v) => { d.el.textContent = d.prefijo + aTexto(v, d.decimales) + d.sufijo; };

  if (sinMovimiento() || !("IntersectionObserver" in window)) {
    items.forEach((d) => poner(d, d.fin));
    return nada();
  }

  const salida = (t) => 1 - Math.pow(1 - t, 4);   // frena al final, como una cuenta que se asienta
  const correr = (d) => {
    const t0 = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / d.duracion);
      poner(d, d.fin * salida(t));
      d.id = t < 1 ? requestAnimationFrame(paso) : 0;
    };
    d.id = requestAnimationFrame(paso);
  };

  items.forEach((d) => poner(d, 0));
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const d = items.find((x) => x.el === e.target);
      io.unobserve(e.target);
      if (d) correr(d);
    }
  }, { threshold: 0.4 });
  items.forEach((d) => io.observe(d.el));

  return {
    destruir() {
      io.disconnect();
      items.forEach((d) => { if (d.id) cancelAnimationFrame(d.id); poner(d, d.fin); });
    },
  };
}

/* ---------- Cuenta regresiva ---------- */

// Escribe "12 d 04 h 31 m 08 s" en `el`. Con "reducir movimiento" no hay segundos (nada que
// cambie cada segundo). Solo corre si la pestaña está visible y la cuenta está en pantalla.
// Al llegar a cero escribe "terminó", suma .es-vencida y llama a alVencer().
export function cuentaRegresiva(el, fechaISO, { alVencer } = {}) {
  const fin = new Date(fechaISO).getTime();
  if (!hayDom || !el || Number.isNaN(fin)) return nada();

  const dos = (n) => String(n).padStart(2, "0");
  let reloj = 0, enPantalla = true, vencida = false;

  const pintar = () => {
    const falta = fin - Date.now();
    if (falta <= 0) {
      vencida = true;
      parar();
      el.textContent = "terminó";
      el.classList.add("es-vencida");
      if (alVencer) alVencer();
      return;
    }
    const s = Math.floor(falta / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    el.textContent = `${d} d ${dos(h)} h ${dos(m)} m` + (sinMovimiento() ? "" : ` ${dos(s % 60)} s`);
  };
  const parar = () => { if (reloj) { clearInterval(reloj); reloj = 0; } };
  const arrancar = () => {
    if (reloj || vencida || !enPantalla || document.hidden) return;
    pintar();
    if (!vencida) reloj = setInterval(pintar, sinMovimiento() ? 15000 : 1000);
  };

  const alVisibilidad = () => (document.hidden ? parar() : arrancar());
  document.addEventListener("visibilitychange", alVisibilidad);
  let io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(([e]) => { enPantalla = e.isIntersecting; enPantalla ? arrancar() : parar(); });
    io.observe(el);
  }
  arrancar();

  return {
    destruir() {
      parar();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", alVisibilidad);
    },
  };
}

/* ---------- Precios: mensual / anual ---------- */

// raiz contiene botones [data-modalidad="mensual|anual"] y textos [data-mensual][data-anual].
// El nombre de las modalidades es el del kit; qué significan lo dice la página (cuotas / contado, por ejemplo).
// Deja data-modo-actual en la raíz, para que el CSS mueva la perilla del interruptor.
export function alternarPrecios(raiz, { inicial = "mensual" } = {}) {
  if (!hayDom || !raiz) return nada();
  const botones = [...raiz.querySelectorAll("[data-modalidad]")];
  const textos = [...raiz.querySelectorAll("[data-mensual][data-anual]")];
  if (!botones.length) return nada();

  const aplicar = (modo, animar) => {
    raiz.dataset.modoActual = modo;
    botones.forEach((b) => {
      const activo = b.dataset.modalidad === modo;
      b.setAttribute("aria-pressed", String(activo));
      b.classList.toggle("es-activa", activo);
    });
    textos.forEach((t) => {
      const nuevo = t.dataset[modo];
      if (nuevo == null || t.textContent === nuevo) return;
      t.textContent = nuevo;
      if (animar && !sinMovimiento()) {
        t.classList.remove("es-cambia");
        void t.offsetWidth;                 // reinicia la animación aunque se cambie rápido
        t.classList.add("es-cambia");
      }
    });
  };
  const alClic = (e) => {
    const b = e.target.closest("[data-modalidad]");
    if (b && raiz.contains(b)) aplicar(b.dataset.modalidad, true);
  };
  raiz.addEventListener("click", alClic);
  aplicar(inicial, false);

  return { destruir() { raiz.removeEventListener("click", alClic); } };
}

/* ---------- Filtro por categoría ---------- */

// raiz contiene pastillas [data-filtro="todos|cocinas|…"], ítems [data-categoria="cocinas"] (puede
// llevar varias separadas por espacio) y, opcional, un [data-filtro-estado] que anuncia el resultado
// a lectores de pantalla. Lo que no lleve data-categoria (la tarjeta "a medida") queda siempre.
export function filtrar(raiz) {
  if (!hayDom || !raiz) return nada();
  const botones = [...raiz.querySelectorAll("[data-filtro]")];
  const items = [...raiz.querySelectorAll("[data-categoria]")];
  const estado = raiz.querySelector("[data-filtro-estado]");
  if (!botones.length || !items.length) return nada();

  const aplicar = (cat) => {
    let visibles = 0, nombre = cat;
    botones.forEach((b) => {
      const on = b.dataset.filtro === cat;
      b.setAttribute("aria-pressed", String(on));
      if (on) nombre = b.dataset.nombre || b.textContent.trim();
    });
    items.forEach((it) => {
      const coincide = cat === "todos" || it.dataset.categoria.split(/\s+/).includes(cat);
      if (coincide) visibles++;
      if (coincide && it.hidden) {
        it.hidden = false;
        it.classList.add("se-ve");          // aparecer() nunca lo vio: que no quede transparente
        it.classList.remove("es-entrando");
        void it.offsetWidth;
        it.classList.add("es-entrando");
      } else if (!coincide) {
        it.hidden = true;
        it.classList.remove("es-entrando");
      }
    });
    if (estado) {
      estado.textContent = cat === "todos"
        ? `Mostrando los ${visibles} trabajos.`
        : `Mostrando ${visibles} ${visibles === 1 ? "trabajo" : "trabajos"} de ${nombre}.`;
    }
  };

  const alClic = (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b || !raiz.contains(b)) return;
    aplicar(b.dataset.filtro);
    // la fila de pastillas hace scroll horizontal: la elegida queda a la vista
    b.scrollIntoView({ inline: "center", block: "nearest", behavior: sinMovimiento() ? "auto" : "smooth" });
  };
  raiz.addEventListener("click", alClic);

  return { destruir() { raiz.removeEventListener("click", alClic); } };
}

/* ---------- Formulario → WhatsApp ---------- */

// Valida lo requerido, arma un mensaje ordenado y abre https://wa.me/<numero>?text=…
// Todo pasa en el navegador. Por cada campo requerido busca un [data-error-de="<name>"]
// para mostrar el aviso (si no existe, lo crea con la clase `claseError`). Un [data-estado]
// recibe el mensaje de resultado.
//   La etiqueta de cada línea sale de data-etiqueta, del <label for> o del name.
export function mensajeWhatsApp(form, { numero, saludo = "Hola, te escribo desde la web.", claseError = "contacto__error" } = {}) {
  if (!hayDom || !form) return nada();
  const limpio = String(numero || "").replace(/\D/g, "");
  const estado = form.querySelector("[data-estado]");
  const decir = (texto) => { if (estado) estado.textContent = texto; };

  const campos = () => [...form.elements].filter((c) => c.name && c.type !== "submit" && c.type !== "button");
  const etiquetaDe = (c) => {
    if (c.dataset.etiqueta) return c.dataset.etiqueta;
    const l = c.id ? form.querySelector(`label[for="${CSS.escape(c.id)}"]`) : null;
    // el texto de la etiqueta sin notas chicas como "(opcional)"
    return l ? l.textContent.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").replace(/[:?¿]/g, "").trim() : c.name;
  };
  const errorDe = (c) => {
    let p = form.querySelector(`[data-error-de="${CSS.escape(c.name)}"]`);
    if (!p) {
      p = document.createElement("p");
      p.className = claseError;
      p.dataset.errorDe = c.name;
      p.hidden = true;
      c.insertAdjacentElement("afterend", p);
    }
    return p;
  };
  const marcar = (c, mal) => {
    c.setAttribute("aria-invalid", String(mal));
    const p = errorDe(c);
    p.hidden = !mal;
    if (mal) {
      if (!p.id) p.id = `${c.id || c.name}-error`;
      c.setAttribute("aria-describedby", p.id);
    } else {
      c.removeAttribute("aria-describedby");
    }
  };

  const alEnviar = (e) => {
    e.preventDefault();
    const cs = campos();
    let primero = null;
    cs.forEach((c) => {
      const mal = c.required && !String(c.value).trim();
      marcar(c, mal);
      if (mal && !primero) primero = c;
    });
    if (primero) { decir("Faltan datos para armar el mensaje."); primero.focus(); return; }
    if (limpio.length < 8) { decir("Todavía no está cargado el número de WhatsApp."); return; }

    const lineas = cs
      .map((c) => [etiquetaDe(c), String(c.value).trim()])
      .filter(([, v]) => v)
      .map(([k, v]) => `*${k}:* ${v}`);
    const texto = [saludo, "", ...lineas].join("\n");
    const url = `https://wa.me/${limpio}?text=${encodeURIComponent(texto)}`;

    // Un <a> con clic propio: abre en pestaña nueva sin quedar atado a bloqueadores de ventanas emergentes
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();
    decir("Se abrió WhatsApp con tu mensaje listo. Si no pasó nada, revisá que el navegador no haya bloqueado la ventana.");
  };
  // Se limpia el aviso apenas la persona corrige el campo
  const alEscribir = (e) => { if (e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true" && String(e.target.value).trim()) marcar(e.target, false); };

  form.noValidate = true;
  form.addEventListener("submit", alEnviar);
  form.addEventListener("input", alEscribir);

  return {
    destruir() {
      form.removeEventListener("submit", alEnviar);
      form.removeEventListener("input", alEscribir);
    },
  };
}
