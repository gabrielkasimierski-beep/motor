/* Motor webi · escena3d.js
   three.js dormido: no se descarga hasta que el contenedor está por entrar en pantalla.
   Todo lo que arma es procedural (sin modelos). Colores y tipografía salen de tokens.css.
   La página trae three por importmap:
     <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}</script>

   Exporta:
     escena3d(contenedor, armar, opciones)      escena lista para dibujar con el scroll
     camaraPorCapitulos(camara, poses)          (p) => cámara entre poses
     particulasAFigura(THREE, opciones)         nube que converge a una figura
     acoplar(objeto3d, camara, elDom)           posición y escala para caer sobre un hueco del DOM
   Extras para la página:
     puntosDeTexto(texto, opciones)             Promise<Float32Array> con puntos donde hay tinta
     luzDeEstudio(THREE, escena)                principal + relleno + contraluz del acento
     entornoDeEstudio(THREE, render, escena)    reflejos de estudio (el vidrio los necesita)
     colorToken(THREE, "--acento")              THREE.Color leído de una variable CSS */

import { escenario, bucle, amortiguar, limitar, reducido } from "./motor-scroll.js";

const hayDom = typeof window !== "undefined" && typeof document !== "undefined";

/* ---------- three.js a demanda ---------- */

let promesaThree = null;
let T = null; // el módulo three, una vez cargado (lo usa acoplar sin pedirlo de nuevo)
const contenedorDe = new WeakMap(); // cámara → contenedor: acoplar necesita saber dónde cae el canvas

function cargarThree() {
  // "three" lo resuelve el importmap de la página; si falta, el import falla y queda el respaldo
  promesaThree ||= import("three")
    .then((m) => (T = m))
    .catch((err) => {
      promesaThree = null; // permite reintentar más tarde
      throw err;
    });
  return promesaThree;
}

function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    // se suelta enseguida: los navegadores limitan los contextos vivos
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* ---------- Color desde CSS ---------- */

let ctxColor = null;
// Un canvas de 1×1 entiende cualquier color CSS (hex, color-mix, oklch…); three solo entiende algunos.
function cssARgb(valor) {
  if (!ctxColor) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    ctxColor = c.getContext("2d", { willReadFrequently: true });
  }
  ctxColor.clearRect(0, 0, 1, 1);
  ctxColor.fillStyle = "#000"; // si el valor no se entiende, el fillStyle queda en negro y no en el color anterior
  ctxColor.fillStyle = valor;
  ctxColor.fillRect(0, 0, 1, 1);
  const d = ctxColor.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

export function colorToken(THREE, nombre, respaldo = "#ffffff", raiz = hayDom ? document.documentElement : null) {
  const valor = (raiz && getComputedStyle(raiz).getPropertyValue(nombre).trim()) || respaldo;
  const [r, g, b] = cssARgb(valor);
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); // sRGB → espacio de trabajo lineal de three
}

// Acepta THREE.Color, número (0xRRGGBB), color CSS o nombre de token ("--acento").
function aColor(THREE, valor) {
  if (valor && valor.isColor) return valor;
  if (typeof valor === "string") {
    if (valor.startsWith("--")) return colorToken(THREE, valor);
    const [r, g, b] = cssARgb(valor);
    return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  }
  return new THREE.Color(valor);
}

/* ---------- Utilidades ---------- */

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);

// Generador con semilla: la misma nube sale igual en cada carga (y en cada prueba)
function mulberry32(semilla) {
  let a = semilla | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Libera lo que three guarda en la GPU: geometrías, materiales, texturas (y el entorno de estudio).
function liberar(raiz) {
  const vistas = new Set();
  const soltar = (tex) => {
    if (!tex || vistas.has(tex)) return;
    vistas.add(tex);
    const rt = tex.userData && tex.userData.rt; // el entorno de estudio es la textura de un render target
    if (rt && rt.dispose) rt.dispose();
    else if (tex.dispose) tex.dispose();
  };
  raiz.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) soltar(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) soltar(u.value);
      m.dispose();
    }
  });
  if (raiz.background && raiz.background.isTexture) soltar(raiz.background);
  soltar(raiz.environment);
}

/* ---------- escena3d ---------- */

/* armar({ THREE, escena, camara, render, contenedor }) → { cuadro(t, dt, p), alRedimensionar?(ancho, alto), destruir?() }
     render   es el THREE.WebGLRenderer (hace falta para el entorno de estudio y el anisotropy de las texturas)
     p        progreso 0..1 del [data-escenario] más cercano hacia arriba (0 si no hay), suavizado con `suavizar`
     t        segundos de animación propia; con "reducir movimiento" queda fijo en 0
   Devuelve { lista, destruir(), suavizar(v), redibujar() }:
     suavizar(v) cambia la inercia en vivo; redibujar() fuerza un cuadro (útil con "reducir movimiento"). */
export function escena3d(contenedor, armar, { fondo = null, dprMax = 2, suavizar = 0.1, fov = 35 } = {}) {
  let destruido = false;
  let cancelarEspera = null;
  let renderer = null;
  let escena = null;
  let camara = null;
  let api = null;
  let hEscenario = null;
  let hBucle = null;
  let ioVista = null;
  let ro = null;
  let lienzo = null;
  let enPantalla = false;
  let sucio = true; // algo cambió desde el último cuadro (hace falta repintar aunque no haya animación)
  let perdido = false; // contexto WebGL perdido
  let primerP = true;
  let pObjetivo = 0;
  let pSuave = 0;
  let suav = suavizar;
  let tPropio = 0;
  let ancho = 1;
  let alto = 1;

  const alPerder = (e) => {
    e.preventDefault(); // sin esto el navegador no intenta recuperarlo
    perdido = true;
  };
  const alRecuperar = () => {
    perdido = false;
    sucio = true;
  };

  function esperarEntrada() {
    return new Promise((resolver) => {
      if (!("IntersectionObserver" in window)) return resolver();
      // margen amplio: three.js se baja antes de que la escena se vea
      const io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            io.disconnect();
            resolver();
          }
        },
        { rootMargin: "100% 0px" }
      );
      io.observe(contenedor);
      cancelarEspera = () => {
        io.disconnect();
        resolver();
      };
    });
  }

  function medir() {
    ancho = Math.max(1, Math.round(contenedor.clientWidth));
    alto = Math.max(1, Math.round(contenedor.clientHeight));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprMax));
    renderer.setSize(ancho, alto, false); // el tamaño visual lo manda el CSS (100 % del contenedor)
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    if (api && api.alRedimensionar) api.alRedimensionar(ancho, alto);
    sucio = true;
  }

  function pintar(t, dt) {
    sucio = false;
    if (api.cuadro) api.cuadro(t, dt, pSuave);
    renderer.render(escena, camara);
  }

  // Un cuadro del bucle compartido. Solo corre mientras la escena está en pantalla.
  function cuadro(_t, dtBruto) {
    if (perdido || !api) return;
    const quieto = reducido(); // "reducir movimiento": responde al scroll, pero sin animación propia
    const dt = quieto ? 0 : dtBruto;
    if (!quieto) tPropio += dt;
    const antes = pSuave;
    pSuave = quieto ? pObjetivo : amortiguar(pSuave, pObjetivo, suav, dt);
    if (Math.abs(pObjetivo - pSuave) < 0.0004) pSuave = pObjetivo;
    if (quieto && !sucio && pSuave === antes) return; // nada cambió: no hace falta repintar
    pintar(quieto ? 0 : tPropio, dt);
  }

  function limpiar() {
    if (cancelarEspera) cancelarEspera();
    if (hBucle) hBucle.destruir();
    if (hEscenario) hEscenario.destruir();
    hBucle = hEscenario = null;
    if (ioVista) ioVista.disconnect();
    if (ro) ro.disconnect();
    ioVista = ro = null;
    try {
      if (api && api.destruir) api.destruir();
    } catch (err) {
      console.error(err);
    }
    if (escena) liberar(escena);
    if (renderer) {
      if (lienzo) {
        lienzo.removeEventListener("webglcontextlost", alPerder);
        lienzo.removeEventListener("webglcontextrestored", alRecuperar);
        lienzo.remove();
      }
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }
    renderer = escena = camara = api = lienzo = null;
  }

  // Sin WebGL (o sin three): la página muestra su imagen de respaldo con .sin-3d
  function respaldo() {
    limpiar();
    contenedor.classList.add("sin-3d");
  }

  const lista = (async () => {
    if (!hayDom || !contenedor) return;
    await esperarEntrada();
    if (destruido) return;
    if (!hayWebGL()) return respaldo();

    let THREE;
    try {
      THREE = await cargarThree();
    } catch (err) {
      console.warn("escena3d: no se pudo cargar three.js", err);
      return respaldo();
    }
    if (destruido) return;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: fondo === null, powerPreference: "high-performance" });
    } catch (err) {
      console.warn("escena3d: sin WebGL", err);
      return respaldo();
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral conserva el tono de la marca; ACES lo desaturaba
    renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    escena = new THREE.Scene();
    if (fondo === null) {
      renderer.setClearColor(0x000000, 0); // canvas transparente: detrás va lo que ponga la página
    } else {
      const c = aColor(THREE, fondo);
      renderer.setClearColor(c, 1);
      escena.background = c.clone();
    }
    camara = new THREE.PerspectiveCamera(fov, 1, 0.1, 300);
    camara.position.set(0, 0, 8);
    contenedorDe.set(camara, contenedor);

    if (getComputedStyle(contenedor).position === "static") contenedor.style.position = "relative";
    lienzo = renderer.domElement;
    lienzo.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    lienzo.setAttribute("aria-hidden", "true");
    lienzo.addEventListener("webglcontextlost", alPerder);
    lienzo.addEventListener("webglcontextrestored", alRecuperar);
    contenedor.appendChild(lienzo);
    medir();

    // El progreso de la pista se pide directo (suavizar: 0): la inercia la pongo acá, así se cambia en vivo
    const pista = contenedor.closest("[data-escenario]");
    if (pista) {
      hEscenario = escenario(
        pista,
        (p) => {
          if (primerP) {
            primerP = false;
            pSuave = p; // el primer valor es directo: nada de barrido falso al cargar a mitad de página
          }
          if (p !== pObjetivo) {
            pObjetivo = p;
            sucio = true;
          }
        },
        { suavizar: 0 }
      );
    }

    const escenaLocal = escena; // limpiar() pone las referencias en null; esta sigue sirviendo para liberar
    let devuelto;
    try {
      devuelto = await armar({ THREE, escena, camara, render: renderer, contenedor });
    } catch (err) {
      console.error("escena3d: falló armar()", err);
      if (!destruido) respaldo();
      return;
    }
    if (destruido) {
      // destruir() llegó mientras armaba: lo que armar() creó después también se libera
      try {
        if (devuelto && devuelto.destruir) devuelto.destruir();
      } catch (err) {
        console.error(err);
      }
      liberar(escenaLocal);
      return;
    }
    api = devuelto;
    api = api || {};
    medir(); // avisa el tamaño a quien armó
    pSuave = pObjetivo;
    pintar(0, 0); // un cuadro ya, para que no aparezca vacío
    contenedor.classList.add("esta-lista");

    // Se dibuja solo mientras está en pantalla (y el bucle ya se frena con la pestaña oculta)
    if ("IntersectionObserver" in window) {
      ioVista = new IntersectionObserver(
        (es) => {
          const ve = es[es.length - 1].isIntersecting;
          if (ve === enPantalla) return;
          enPantalla = ve;
          if (ve) {
            sucio = true;
            if (!hBucle) hBucle = bucle(cuadro);
          } else if (hBucle) {
            hBucle.destruir();
            hBucle = null;
          }
        },
        { rootMargin: "80px 0px" }
      );
      ioVista.observe(contenedor);
    } else {
      enPantalla = true;
      hBucle = bucle(cuadro);
    }

    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => {
        if (renderer) medir();
      });
      ro.observe(contenedor);
    }
  })();

  return {
    lista,
    destruir() {
      if (destruido) return;
      destruido = true;
      limpiar();
    },
    suavizar(v) {
      suav = v;
    },
    redibujar() {
      sucio = true;
    },
  };
}

/* ---------- Cámara por capítulos ---------- */

// poses: [{ pos:[x,y,z], mira:[x,y,z] }]. Entre pose y pose la curva es suave (arranca y frena),
// así la cámara "se posa" en cada capítulo en vez de pasar de largo.
export function camaraPorCapitulos(camara, poses) {
  const n = poses.length;
  return (p) => {
    if (!n) return;
    const f = limitar(p) * (n - 1);
    const i = Math.min(Math.floor(f), Math.max(n - 2, 0));
    const a = poses[i];
    const b = poses[Math.min(i + 1, n - 1)];
    const u = suave(limitar(f - i));
    camara.position.set(lerp(a.pos[0], b.pos[0], u), lerp(a.pos[1], b.pos[1], u), lerp(a.pos[2], b.pos[2], u));
    camara.lookAt(lerp(a.mira[0], b.mira[0], u), lerp(a.mira[1], b.mira[1], u), lerp(a.mira[2], b.mira[2], u));
    camara.updateMatrixWorld(); // para que proyectar puntos 3D a pantalla ya use esta pose
  };
}

/* ---------- Partículas que arman una figura ---------- */

const VERTICE_PARTICULAS = /* glsl */ `
  uniform float uP;        // progreso global 0..1
  uniform float uT;        // segundos (fijo si hay "reducir movimiento")
  uniform float uTamano;   // tamaño de la partícula en unidades del mundo
  uniform float uEscala;   // píxeles por unidad a distancia 1 (lo pone onBeforeRender)
  attribute vec3 aOrigen;  // dónde arranca, dispersa
  attribute vec3 aDesvio;  // empuje lateral: el viaje es una curva, no una recta
  attribute vec3 aRasgos;  // x: retraso 0..1, y: variación de tamaño, z: fase
  varying float vBrillo;

  void main() {
    // cada partícula tiene su propio tramo del progreso: no llegan todas juntas
    float espera = 0.55;
    float q = clamp((uP - aRasgos.x * espera) / (1.0 - espera), 0.0, 1.0);
    float e = q * q * q * (q * (q * 6.0 - 15.0) + 10.0);

    // mientras está suelta, flota apenas
    float f = aRasgos.z * 6.2831853;
    vec3 deriva = vec3(sin(uT * 0.50 + f), cos(uT * 0.43 + f * 2.0), sin(uT * 0.37 + f * 3.0)) * 0.16 * (1.0 - e);

    vec3 pos = mix(aOrigen + deriva, position, e) + aDesvio * sin(e * 3.14159265);

    // al final, late apenas: una onda corta recorre la figura
    float llego = smoothstep(0.93, 1.0, uP);
    float onda = sin(uT * 2.2 - position.x * 1.1 + aRasgos.z * 0.8);
    pos *= 1.0 + llego * 0.010 * onda;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uTamano * aRasgos.y * (1.0 + llego * 0.22 * onda) * uEscala / -mv.z, 1.0, 64.0);
    vBrillo = 0.5 + 0.5 * e + llego * 0.18 * onda;
  }
`;

const FRAGMENTO_PARTICULAS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacidad;
  varying float vBrillo;

  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0; // 0 en el centro, 1 en el borde
    float a = smoothstep(1.0, 0.0, r);
    a *= a;                                     // núcleo concentrado y borde blando
    gl_FragColor = vec4(uColor * vBrillo, a * uOpacidad);
    #include <colorspace_fragment>
  }
`;

/* puntos: Float32Array xyz del destino (por ejemplo de puntosDeTexto).
   cantidad: si es distinta de la cantidad de puntos, se submuestrea o se repite con un poco de dispersión.
   color: THREE.Color, número, color CSS o token; por defecto --acento-claro.
   tamano: en unidades del mundo. dispersion: multiplica el radio de la nube suelta. */
export function particulasAFigura(THREE, { puntos, cantidad, color, tamano = 0.035, dispersion = 1, aditivo = true, semilla = 11 } = {}) {
  const n = Math.floor(puntos.length / 3);
  const total = Math.max(1, Math.floor(cantidad ?? n));
  const azar = mulberry32(semilla);

  let rMax = 0;
  for (let i = 0; i < n; i++) rMax = Math.max(rMax, Math.hypot(puntos[i * 3], puntos[i * 3 + 1], puntos[i * 3 + 2]));
  rMax = Math.max(rMax, 0.5);
  const radioNube = rMax * 2.4 * dispersion + 1.5;

  const destino = new Float32Array(total * 3);
  const origen = new Float32Array(total * 3);
  const desvio = new Float32Array(total * 3);
  const rasgos = new Float32Array(total * 3);

  for (let i = 0; i < total; i++) {
    const k = n ? (total >= n ? i % n : Math.floor((i * n) / total)) : 0;
    const repetido = n > 0 && total > n && i >= n; // un punto usado dos veces se corre un poco para no apilarse
    for (let c = 0; c < 3; c++) destino[i * 3 + c] = n ? puntos[k * 3 + c] + (repetido ? (azar() - 0.5) * 0.03 : 0) : 0;

    // posición al azar dentro de una esfera (la raíz cúbica reparte parejo por volumen)
    const u = azar() * 2 - 1;
    const th = azar() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radioNube * Math.cbrt(azar());
    origen[i * 3] = r * s * Math.cos(th);
    origen[i * 3 + 1] = r * u;
    origen[i * 3 + 2] = r * s * Math.sin(th);

    const u2 = azar() * 2 - 1;
    const th2 = azar() * Math.PI * 2;
    const s2 = Math.sqrt(1 - u2 * u2);
    const largo = rMax * 0.55 * (0.3 + azar());
    desvio[i * 3] = largo * s2 * Math.cos(th2);
    desvio[i * 3 + 1] = largo * u2;
    desvio[i * 3 + 2] = largo * s2 * Math.sin(th2);

    rasgos[i * 3] = azar();
    rasgos[i * 3 + 1] = 0.55 + azar() * 0.9;
    rasgos[i * 3 + 2] = azar();
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(destino, 3));
  geometria.setAttribute("aOrigen", new THREE.BufferAttribute(origen, 3));
  geometria.setAttribute("aDesvio", new THREE.BufferAttribute(desvio, 3));
  geometria.setAttribute("aRasgos", new THREE.BufferAttribute(rasgos, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uP: { value: 0 },
      uT: { value: 0 },
      uTamano: { value: tamano },
      uEscala: { value: 600 },
      uOpacidad: { value: 0.9 },
      uColor: { value: aColor(THREE, color ?? "--acento-claro").clone() },
    },
    vertexShader: VERTICE_PARTICULAS,
    fragmentShader: FRAGMENTO_PARTICULAS,
    transparent: true,
    depthWrite: false,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const malla = new THREE.Points(geometria, material);
  malla.frustumCulled = false; // las posiciones se mueven en el shader: el volumen de la geometría no sirve

  // El tamaño en píxeles depende de la altura real del buffer y del fov: se actualiza justo antes de dibujar
  const tam = new THREE.Vector2();
  malla.onBeforeRender = (rend, _escena, camara) => {
    rend.getDrawingBufferSize(tam);
    material.uniforms.uEscala.value = tam.y / (2 * Math.tan((camara.fov * Math.PI) / 360));
  };

  return {
    malla,
    cantidad: total,
    // p: 0..1. t (opcional): segundos para la deriva y el latido; sin t quedan quietos.
    avanzar(p, t = 0) {
      material.uniforms.uP.value = limitar(p);
      material.uniforms.uT.value = t;
    },
  };
}

/* ---------- Texto → puntos ---------- */

/* Dibuja el texto en un canvas 2D y muestrea puntos donde hay tinta.
   fuente: shorthand CSS con tamaño en px (por defecto 800 sobre --f-titulo). Espera a que la fuente esté cargada.
   Devuelve xyz centrados en el origen, con y hacia arriba; la tinta mide `alto` unidades de alto
   y `grosor` unidades de espesor en z. */
export async function puntosDeTexto(texto, { fuente, cantidad = 4000, alto = 2, grosor = 0.16, semilla = 7 } = {}) {
  if (!fuente) {
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--f-titulo").trim() || "system-ui, sans-serif";
    fuente = `800 360px ${fam}`;
  }
  try {
    if (document.fonts) await document.fonts.load(fuente, texto);
  } catch {
    // sin la fuente se dibuja con la de respaldo; mejor eso que nada
  }
  const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(fuente)?.[1]) || 300;
  const lineas = String(texto).split("\n");

  const medidor = document.createElement("canvas").getContext("2d");
  medidor.font = fuente;
  const masAncha = Math.max(...lineas.map((l) => medidor.measureText(l).width));
  const w = Math.ceil(masAncha + px * 0.5);
  const h = Math.ceil(px * (1.2 * lineas.length + 0.5));

  const lienzo = document.createElement("canvas");
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  ctx.font = fuente;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  lineas.forEach((l, i) => ctx.fillText(l, px * 0.25, px * 0.2 + i * px * 1.15));

  const datos = ctx.getImageData(0, 0, w, h).data;
  const tinta = [];
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (datos[(y * w + x) * 4 + 3] > 128) {
        tinta.push(y * w + x);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  const salida = new Float32Array(cantidad * 3);
  const azar = mulberry32(semilla);
  if (!tinta.length) {
    // no se dibujó nada (fuente rota): un anillo, para que la escena igual muestre algo
    for (let i = 0; i < cantidad; i++) {
      const a = azar() * Math.PI * 2;
      salida[i * 3] = Math.cos(a) * alto * 0.5;
      salida[i * 3 + 1] = Math.sin(a) * alto * 0.5;
      salida[i * 3 + 2] = (azar() - 0.5) * grosor;
    }
    return salida;
  }

  const escala = alto / Math.max(1, y1 - y0 + 1);
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  for (let i = 0; i < cantidad; i++) {
    const k = tinta[(azar() * tinta.length) | 0]; // con repetición: el reparto queda parejo sobre la tinta
    const px_ = (k % w) + azar();
    const py_ = Math.floor(k / w) + azar();
    salida[i * 3] = (px_ - cx) * escala;
    salida[i * 3 + 1] = -(py_ - cy) * escala;
    salida[i * 3 + 2] = (azar() - 0.5) * grosor;
  }
  return salida;
}

/* ---------- Luz y entorno de estudio ---------- */

// Una luz principal, una de relleno y un contraluz del color de --acento. Devuelve { principal, relleno, contraluz }.
export function luzDeEstudio(THREE, escena, { intensidad = 1 } = {}) {
  const principal = new THREE.DirectionalLight(colorToken(THREE, "--hueso"), 3.2 * intensidad);
  principal.position.set(4, 6, 5);
  const relleno = new THREE.DirectionalLight(colorToken(THREE, "--bruma"), 1.1 * intensidad);
  relleno.position.set(-5, 1.5, 3);
  const contraluz = new THREE.DirectionalLight(colorToken(THREE, "--acento"), 5 * intensidad);
  contraluz.position.set(-2, 3, -6);
  escena.add(principal, relleno, contraluz);
  return { principal, relleno, contraluz };
}

// Un "estudio" armado con paneles luminosos que se hornea a un mapa de entorno. Sin él, el vidrio y el metal
// no tienen qué reflejar y se ven planos. Se libera solo con escena3d().destruir().
export function entornoDeEstudio(THREE, render, escena, { intensidad = 1 } = {}) {
  const sala = new THREE.Scene();
  sala.background = colorToken(THREE, "--tinta-2");
  const hueso = colorToken(THREE, "--hueso");
  const acento = colorToken(THREE, "--acento");

  const panel = (w, h, color, fuerza, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(fuerza), side: THREE.DoubleSide })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0); // el plano mira al centro, donde va el producto
    sala.add(m);
  };
  panel(7, 4.5, hueso, 7, [-6, 5, 5]); // caja de luz principal, arriba a la izquierda
  panel(1.3, 9, hueso, 5, [7, 1, 2]); // tira vertical a la derecha: el reflejo largo del vidrio
  panel(10, 3, hueso, 3.5, [0, 9, 0]); // luz cenital
  panel(1, 6, hueso, 3, [-7, 2, -4]); // borde atrás a la izquierda
  panel(1.2, 7, acento, 4, [0, 1, -7]); // tira del color de la marca atrás
  panel(8, 1.2, hueso, 1.4, [0, -6, 3]); // relleno de abajo

  const pmrem = new THREE.PMREMGenerator(render);
  const rt = pmrem.fromScene(sala, 0.02);
  pmrem.dispose();
  sala.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });

  rt.texture.userData.rt = rt; // liberar() lo usa para soltar también el render target
  escena.environment = rt.texture;
  escena.environmentIntensity = intensidad;
  return rt.texture;
}

/* ---------- Acople al DOM ---------- */

/* Calcula dónde poner (y a qué escala) el objeto para que quede centrado sobre el rectángulo de `elDom`,
   a la profundidad que el objeto tiene ahora. Devuelve { posicion: THREE.Vector3, escala: número }:
   la página interpola hacia ahí (objeto.position.lerpVectors, objeto.scale.setScalar).
   `ajuste` es qué fracción del hueco ocupa (0.9 = deja un borde). Pensado para objetos centrados en su origen. */
export function acoplar(objeto3d, camara, elDom, { ajuste = 0.9 } = {}) {
  if (!T) throw new Error("acoplar(): se usa dentro de escena3d, cuando three ya está cargado");
  const V = T.Vector3;
  camara.updateMatrixWorld();
  objeto3d.updateWorldMatrix(true, true);

  // el canvas ocupa el contenedor de escena3d; si la cámara es ajena, la ventana entera
  const cont = contenedorDe.get(camara);
  const rc = cont ? cont.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const r = elDom.getBoundingClientRect();
  const ndcX = ((r.left + r.width / 2 - rc.left) / rc.width) * 2 - 1;
  const ndcY = 1 - ((r.top + r.height / 2 - rc.top) / rc.height) * 2;

  // profundidad actual del objeto a lo largo de la mirada de la cámara
  const adelante = camara.getWorldDirection(new V());
  const mundo = new V().setFromMatrixPosition(objeto3d.matrixWorld);
  const prof = mundo.clone().sub(camara.position).dot(adelante);

  // rayo de la cámara por el centro del hueco, cortado a esa misma profundidad
  const rayo = new V(ndcX, ndcY, 0.5).unproject(camara).sub(camara.position).normalize();
  const punto = camara.position.clone().addScaledVector(rayo, prof / rayo.dot(adelante));

  // tamaño del hueco en unidades del mundo a esa profundidad
  const mundoPorPx = (2 * prof * Math.tan((camara.fov * Math.PI) / 360)) / rc.height;
  const caja = new T.Box3().setFromObject(objeto3d);
  const tam = caja.getSize(new V());
  const s0 = objeto3d.scale.x || 1;
  const escala = Math.min((r.width * mundoPorPx) / (tam.x / s0), (r.height * mundoPorPx) / (tam.y / s0)) * ajuste;

  // el centro de la caja tiene que caer en el hueco, no el origen del objeto (a la nueva escala)
  const desvio = caja.getCenter(new V()).sub(mundo).multiplyScalar(escala / s0);
  punto.sub(desvio);
  if (objeto3d.parent) objeto3d.parent.worldToLocal(punto);
  return { posicion: punto, escala };
}
