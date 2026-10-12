/* fondo-shader.js — Motor webi
   Fondos animados en la GPU (WebGL1, sin dependencias). Siete familias:
   malla · aurora · metal · semitono · remolino · celdas · llama.
   Uso:  const f = fondoShader(canvas, { familia: "aurora", velocidad: 0.8 });
         f.cambiar({ familia: "metal" });  f.foto();  f.grabar(6);  f.destruir();
   El canvas lo dimensiona el CSS (por ejemplo position:absolute; inset:0; width/height:100%). */

const FAMILIAS = ["malla", "aurora", "metal", "semitono", "remolino", "celdas", "llama"];
const VARIABLES = ["--tinta", "--acento-hondo", "--acento", "--acento-claro", "--hueso"];
const POR_DEFECTO = { familia: "malla", paleta: null, velocidad: 1, escala: 1, grano: 0.04, semilla: 0, puntero: false, dprMax: 1.5 };
// El cuadro quieto (reducir movimiento, foto sin animar) sale de un instante ya "armado", no de t = 0.
const T_INICIAL = 14;

/* ------------------------------------------------------------------ */
/* Shaders. El primer color de la paleta (uPal[0]) es siempre el fondo. */
/* ------------------------------------------------------------------ */

const VERTICE = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0., 1.); }
`;

// Piezas comunes: ruido de valor + fbm escritos desde cero, rampa de paleta.
const PRELUDIO = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uT;      // tiempo (ya multiplicado por la velocidad)
uniform float uGt;     // tiempo real, solo para el grano
uniform vec2 uRes;     // resolución del canvas en px
uniform vec3 uPal[5];  // paleta; la 0 es el fondo
uniform float uN;      // cuántos colores trae de verdad (2..5)
uniform float uEsc;    // escala: >1 agranda el dibujo
uniform float uGrano;
uniform vec2 uSem;     // desplazamiento de la semilla en el dominio del ruido
uniform vec2 uPtr;     // puntero 0..1 (y hacia arriba)
uniform float uPtrF;   // fuerza del puntero 0..1

// Hash 2D→1D: producto/suma/fract, sin senos (no se rompe con coordenadas grandes).
float hash(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794));
  p += dot(p, p.yx + 19.19);
  return fract(p.x * p.y);
}
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(31.7, 17.3))); }

// Ruido de valor con curva quíntica: sin cuadrícula marcada y sin saltos en la derivada.
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = hash(i);
  float b = hash(i + vec2(1., 0.));
  float c = hash(i + vec2(0., 1.));
  float d = hash(i + vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// fbm de 4 octavas, rotando el dominio en cada una para romper los ejes. Sale en 0..1.
float fbm(vec2 p) {
  float v = 0.;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.02 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v / 0.9375;
}

// Recorre la paleta con t de 0 a 1 (0 = fondo). Cada tramo entra y sale suave.
vec3 rampa(float t) {
  float s = clamp(t, 0., 1.) * (uN - 1.);
  vec3 c = uPal[0];
  for (int i = 0; i < 4; i++) {
    float f = clamp(s - float(i), 0., 1.);
    f = f * f * (3. - 2. * f);
    c = mix(c, uPal[i + 1], f);
  }
  return c;
}

// El color número k (entero, en float). Un uniforme array solo se indexa con el índice del bucle.
vec3 colorN(float k) {
  vec3 c = uPal[0];
  for (int i = 1; i < 5; i++) {
    if (float(i) <= k + 0.5) c = uPal[i];
  }
  return c;
}

vec3 pintar(vec2 p, vec2 uv);
`;

// Cierre común: lente del puntero + grano. p va centrado, en alturas de pantalla / escala; uv de 0..1.
const CIERRE = `
void main() {
  vec2 frag = gl_FragCoord.xy;
  float asp = uRes.x / uRes.y;
  vec2 p = (frag - 0.5 * uRes) / (uRes.y * uEsc);
  vec2 uv = frag / uRes;

  // Lente: el dibujo se abulta un poco bajo el cursor (en táctil la fuerza es 0 y no hace nada).
  vec2 d = p - (uPtr - 0.5) * vec2(asp, 1.) / uEsc;
  vec2 ds = d * uEsc;
  p -= d * exp(-dot(ds, ds) * 7.) * 0.32 * uPtrF;

  vec3 col = pintar(p, uv);

  // Grano de película (~18 cambios por segundo, triangular). También rompe el banding del degradé.
  vec2 gp = frag + mod(floor(uGt * 18.), 97.) * vec2(37.7, 91.3);
  float g = hash(gp) + hash(gp + 53.1) - 1.;
  col += g * uGrano;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}
`;

const FRAGMENTOS = {
  // Manchas blandas de la paleta que derivan, vistas a través de un dominio deformado por fbm.
  malla: `
vec3 pintar(vec2 p, vec2 uv) {
  float asp = uRes.x / uRes.y;
  float t = uT * 0.09;
  vec2 q = vec2(fbm(p * 1.2 + uSem + vec2(t, 0.)),
                fbm(p * 1.2 + uSem + vec2(5.2, 1.3 - t)));
  vec2 s = p * uEsc + (q - 0.5) * 0.55;          // pantalla en alturas, deformada
  float rad = 0.30 * max(1., asp * 0.75);
  vec3 acc = uPal[0] * 0.10;                      // el fondo pesa un poco en todos lados
  float suma = 0.10;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * (1.0 + 0.37 * fi) + fi * 2.4) * 0.46 * asp,
                  cos(t * (0.8 + 0.29 * fi) + fi * 1.7) * 0.42);
    vec2 d = s - c;
    float w = exp(-dot(d, d) / (rad * rad) * (1.4 + 0.25 * fi));
    acc += colorN(1. + mod(fi, uN - 1.)) * w;
    suma += w;
  }
  vec3 col = acc / suma;                          // promedio ponderado: mezcla sin cortes
  return col * (0.88 + 0.24 * q.y);
}
`,

  // Cortinas verticales: borde inferior ondulado (fbm en X), rayos finos y desvanecido hacia arriba.
  aurora: `
vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.05;
  float h = uv.y;
  vec3 col = mix(uPal[0], rampa(0.2), pow(1. - h, 3.) * 0.28);   // brillo tenue del horizonte
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (1.0 + 0.55 * fi) + fi * 3.7 + uSem.x;
    float onda = fbm(vec2(x * 0.8 + t * (1.0 + 0.5 * fi), h * 0.9 + uSem.y + fi * 5.1 - t * 0.4));
    float base = 0.20 + 0.55 * (onda - 0.5) + 0.07 * fi;
    float a = h - base;
    float sube = smoothstep(0., 0.12, a);
    float cae = exp(-max(a, 0.) * (2.8 - 0.5 * fi));
    // Muestrear fbm con X rápido e Y lento da rayas verticales.
    float rayo = smoothstep(0.30, 0.72, fbm(vec2(x * 3.4 + t * (2.0 + fi), h * 0.4 + fi * 7.1 + uSem.y - t * 0.6)));
    float luz = sube * cae * (0.30 + 0.70 * rayo);
    vec3 c = rampa(mix(0.9, 0.32, clamp(a * 2.4, 0., 1.)));       // claro en la base, hondo arriba
    col = 1. - (1. - col) * (1. - c * luz * (0.62 - 0.12 * fi));   // pantalla: suma sin quemar
  }
  return col;
}
`,

  // Cromo líquido: relieve de baja frecuencia → pendiente (diferencias anchas) → un solo coeficiente de
  // reflejo continuo que recorre la paleta; el brillo es un pico angosto, sin umbrales duros (no hay serrucho).
  metal: `
float alturaMetal(vec2 p, float t) {
  vec2 q = p * 0.55 + vec2(t, -t * 0.6);
  return 0.65 * ruido(q) + 0.35 * ruido(mat2(0.8, 0.6, -0.6, 0.8) * q * 2.0 + vec2(5.3, 1.7));
}

vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.05;
  vec2 po = p + uSem;
  float e = 0.12;                                              // diferencias anchas: la normal sale suave
  vec2 g = vec2(alturaMetal(po + vec2(e, 0.), t) - alturaMetal(po - vec2(e, 0.), t),
                alturaMetal(po + vec2(0., e), t) - alturaMetal(po - vec2(0., e), t)) / (2. * e);
  // Estrías del cepillado: apenas desplazan el reflejo (solo se notan sobre el brillo).
  float cepillo = ruido(vec2(po.x * 0.4, po.y * 60.)) * 0.6 + ruido(vec2(po.x * 0.9 + 7., po.y * 140.)) * 0.4;
  float v = -dot(g, vec2(0.7, 1.0)) * 2.0 + p.y * 0.45 + p.x * 0.12 + (cepillo - 0.5) * 0.012;  // hacia dónde mira el reflejo
  float s = clamp(0.5 + 0.5 * sin(6.2831853 * v + 0.9), 0., 1.);   // un período = una vuelta del entorno
  vec3 col = rampa(0.03 + 0.46 * pow(s, 1.7));                    // cuerpo: de oscuro a medio, siempre continuo
  col = mix(col, rampa(0.92), pow(s, 28.) * 0.9);                 // brillo máximo: pico angosto
  return col * (1. - 0.45 * pow(1. - s, 40.));                    // filo oscuro, también fino
}
`,

  // Grilla de puntos a 45°; el radio sale de un degradé que fluye, muestreado en el centro de cada celda.
  semitono: `
vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.06;
  float frec = 36.;                                   // puntos por altura (antes de la escala)
  mat2 R = mat2(0.7071068, 0.7071068, -0.7071068, 0.7071068);
  vec2 q = R * p * frec;
  vec2 id = floor(q);
  vec2 loc = q - id - 0.5;
  vec2 pc = ((id + 0.5) / frec) * R;                  // v*R = rotación inversa: el centro de la celda en p
  float w = fbm(pc * 0.8 + uSem + vec2(t, -t * 0.7));
  float f = 0.5 + 0.5 * sin(pc.x * 1.5 + pc.y * 1.0 + (w - 0.5) * 6. - t * 2.2);
  float r = 0.53 * sqrt(f);                           // área ∝ tono
  float px = frec / (uRes.y * uEsc);                  // 1 pixel en unidades de celda
  float punto = 1. - smoothstep(-px, px, length(loc) - r);   // borde nítido con antialias
  return mix(uPal[0], rampa(0.4 + 0.6 * f), punto);
}
`,

  // Cintas que giran alrededor del centro: torsión en polares, cada brazo recorre la paleta a su ritmo.
  remolino: `
vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.08;
  float r = length(p) + 0.0001;
  float a = atan(p.y, p.x);
  float giro = (1.8 + 0.5 * sin(t * 0.6)) / (r * 1.7 + 0.3);            // más torsión cerca del centro
  float desvio = (fbm(p * 1.7 + uSem + vec2(0., t)) - 0.5) * 1.2;       // orilla orgánica
  float brazos = 5.;
  // brazos entero: al cruzar la costura del atan, u salta un número entero y fract() no se entera.
  float u = (a + giro + desvio - t * 1.4) * brazos / 6.2831853 + r * 0.5;
  float v = fract(u);
  float perfil = pow(max(sin(v * 3.1415927), 0.), 0.8);                 // 0 en los bordes de la cinta
  float tono = mod(floor(u), brazos) / brazos + r * 0.3 - t * 0.6;
  vec3 cinta = rampa(0.28 + 0.72 * (0.5 + 0.5 * sin(6.2831853 * tono))); // seno: ciclo sin salto
  vec3 col = mix(uPal[0], cinta, perfil);
  float rs = r * uEsc;
  col = mix(uPal[0], col, smoothstep(0., 0.14, rs));                    // el centro gira demasiado rápido
  col = mix(col, rampa(0.85), exp(-rs * rs * 70.) * 0.55);              // brillo en el ojo
  return col * (1. - 0.45 * smoothstep(0.5, 1.4, rs));                  // viñeta
}
`,

  // Voronoi propio: sitios que orbitan despacio, un tono por celda (vecinos de la paleta), bordes finos y blandos.
  celdas: `
vec3 voronoi(vec2 p, float t) {
  vec2 ip = floor(p);
  vec2 fp = p - ip;
  float d1 = 9.;
  float d2 = 9.;
  float id = 0.;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash2(ip + g);
      vec2 o = 0.5 + 0.38 * sin(t * (0.6 + h.yx) + 6.2831853 * h);       // cada sitio a su ritmo, sin salir de su casillero
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = hash(ip + g + 23.7); }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}

vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.13;
  vec2 dom = vec2(fbm(p * 0.9 + vec2(t * 0.2, 0.)), fbm(p * 0.9 + vec2(8.1, 3.4 - t * 0.2)));
  vec2 q = p * 4.5 + uSem * 3.0 + (dom - 0.5) * 0.7;
  vec3 v = voronoi(q, t);
  float borde = v.y - v.x;                                 // 0 justo en el límite entre celdas
  // Cada celda cae en un tono entre el fondo y el acento; el color claro solo en unas pocas, y mezclado.
  float tono = 0.16 + 0.34 * v.z + 0.30 * smoothstep(0.86, 1., v.z);
  vec3 col = rampa(tono);
  col *= mix(0.80, 1.06, 1. - smoothstep(0., 0.75, v.x));  // leve degradé: el centro más claro que el borde
  return col * mix(0.80, 1., smoothstep(0., 0.10, borde)); // borde fino, apenas más oscuro que la celda
}
`,

  // Lenguas que suben: fbm que se desplaza hacia arriba, afinadas por la altura. La llama es acento hondo →
  // acento; el color claro es solo un núcleo fino cerca de la base; arriba queda el fondo.
  llama: `
vec3 pintar(vec2 p, vec2 uv) {
  float t = uT * 0.4;
  float h = uv.y;
  float yy = h / uEsc;
  float x = p.x * (1. + h * 0.9);                                         // arriba se muestrea más ancho: lenguas más finas
  x += (fbm(vec2(yy * 2.2 - t * 0.5, uSem.x + 3.1)) - 0.5) * 0.5 * h;    // balanceo lateral
  float f = fbm(vec2(x * 3.4 + uSem.x, yy * 1.6 - t * 1.0 + uSem.y));    // lenguas altas y angostas
  float g = fbm(vec2(x * 6.5 + 9.4, yy * 3.4 - t * 2.2 + uSem.y));       // detalle fino
  float d = f * 0.65 + g * 0.35;
  float calor = smoothstep(0., 0.85, d - h * 1.25 + 0.24);                // la altura se come el calor
  float nucleo = smoothstep(0.56, 0.80, d - h * 0.85) * calor;            // solo donde el ruido es muy alto y abajo
  float c = clamp(0.5 * pow(calor, 1.25) + 0.26 * nucleo, 0., 0.8) * mix(1., 0.92, h);
  return rampa(c);                                                         // 0.5 = acento; 0.75 = claro (solo el núcleo)
}
`,
};

/* ------------------------------------------------------------------ */
/* Color: hex o cualquier color CSS → [r, g, b] de 0 a 1              */
/* ------------------------------------------------------------------ */

let _lienzo2d = null;

function aRGB(valor, ancla) {
  const raiz = (ancla && ancla.parentNode) || document.body || document.documentElement;
  const el = document.createElement("i");
  el.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
  el.style.color = String(valor);
  if (!el.style.color) return null;                      // el navegador lo descartó: no es un color
  raiz.appendChild(el);                                  // dentro del mismo árbol, para que var(--x) resuelva igual
  const calculado = getComputedStyle(el).color;
  raiz.removeChild(el);
  return parsear(calculado);
}

function parsear(c) {
  let m = c.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [n[0] / 255, n[1] / 255, n[2] / 255];
  }
  m = c.match(/^color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  // oklch, lab, display-p3…: que lo convierta el canvas 2D
  const cv = _lienzo2d || (_lienzo2d = document.createElement("canvas"));
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.clearRect(0, 0, 1, 1);
  cx.fillStyle = c;
  cx.fillRect(0, 0, 1, 1);
  const d = cx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

const mezclar = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const luminancia = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Devuelve { plano: Float32Array(15), n, css: ["rgb(...)", ...] }. Sin paleta lee los tokens del canvas.
function resolverPaleta(canvas, paleta) {
  let crudos = Array.isArray(paleta) && paleta.length ? paleta.slice(0, 5) : null;
  if (!crudos) {
    const cs = getComputedStyle(canvas);
    crudos = VARIABLES.map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
  }
  let rgb = crudos.map((c) => aRGB(c, canvas)).filter(Boolean);
  if (rgb.length < 2) {
    // Sin tokens (o con un solo color): se arma una escala entre el fondo de la página y el texto.
    const cs = getComputedStyle(canvas);
    const fondo = rgb[0] || aRGB(getComputedStyle(document.body).backgroundColor, canvas) || [0, 0, 0];
    const luz = rgb[0] ? (luminancia(fondo) < 0.5 ? [1, 1, 1] : [0, 0, 0]) : aRGB(cs.color, canvas) || [1, 1, 1];
    rgb = [0, 0.25, 0.5, 0.75, 1].map((k) => mezclar(fondo, luz, k));
  }
  const n = rgb.length;
  while (rgb.length < 5) rgb.push(rgb[rgb.length - 1]);   // el uniforme siempre lleva 5; n dice cuántos valen
  const plano = new Float32Array(15);
  rgb.forEach((c, i) => plano.set(c.map((v) => Math.min(1, Math.max(0, v))), i * 3));
  const css = rgb.slice(0, n).map((c) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(" ")})`);
  return { plano, n, css };
}

/* ------------------------------------------------------------------ */
/* Utilidades chicas                                                  */
/* ------------------------------------------------------------------ */

const sinVacios = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
const numero = (v, min, max, porDefecto) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : porDefecto);

function normalizar(o) {
  if (!FAMILIAS.includes(o.familia)) {
    console.warn(`fondoShader: la familia "${o.familia}" no existe (${FAMILIAS.join(", ")}); uso "malla".`);
    o.familia = "malla";
  }
  o.velocidad = numero(o.velocidad, 0, 8, 1);
  o.escala = numero(o.escala, 0.2, 8, 1);
  o.grano = numero(o.grano, 0, 0.5, 0.04);
  o.dprMax = numero(o.dprMax, 0.5, 3, 1.5);
  return o;
}

// La semilla corre el dominio del ruido (no la geometría): otra semilla = otro dibujo con la misma forma.
function offsetSemilla(s) {
  s = Number(s) || 0;
  if (!s) return [0, 0];
  const h = (k) => { const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  return [h(s) * 40, h(s + 0.5) * 40];
}

function gradienteDe(paleta) {
  const c = paleta.css;
  return c.length >= 3
    ? `radial-gradient(120% 100% at 80% 0%, ${c[2]}, ${c[1]} 45%, ${c[0]} 85%)`
    : `radial-gradient(120% 100% at 80% 0%, ${c[1]}, ${c[0]} 80%)`;
}

/* ------------------------------------------------------------------ */
/* La pieza                                                           */
/* ------------------------------------------------------------------ */

export function fondoShader(canvas, opciones = {}) {
  let op = normalizar({ ...POR_DEFECTO, ...sinVacios(opciones) });
  let paleta = resolverPaleta(canvas, op.paleta);

  let gl = null;
  const atributos = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false };
  try { gl = canvas.getContext("webgl", atributos) || canvas.getContext("experimental-webgl", atributos); } catch (_) { gl = null; }

  // Sin WebGL: degradé CSS con la paleta y un objeto que acepta todas las llamadas sin hacer nada.
  if (!gl) {
    canvas.style.background = gradienteDe(paleta);
    canvas.dataset.fondo = "respaldo";
    canvas.classList.add("esta-lista");
    const inerte = {
      pausar() {}, reanudar() {},
      cambiar(nuevas) {
        if (nuevas && "paleta" in nuevas) { paleta = resolverPaleta(canvas, nuevas.paleta); canvas.style.background = gradienteDe(paleta); }
        return inerte;
      },
      foto: () => Promise.resolve(null),
      grabar: () => Promise.resolve(null),
      destruir() { canvas.style.background = ""; delete canvas.dataset.fondo; },
    };
    return inerte;
  }

  let destruido = false, perdido = false, sinGPU = false;
  let pausadoManual = false, visible = true;
  let grabando = 0, grabador = null;
  let t = T_INICIAL, tGrano = 0, ultimo = 0, idRaf = 0;
  let programas = {}, buffer = null, gradienteAplicado = false, yaDibujo = false;
  const mira = { x: 0.5, y: 0.5, fuerza: 0, objX: 0.5, objY: 0.5, objF: 0, cx: 0, cy: 0, hay: false };

  const mqMovimiento = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reducido = () => !!(mqMovimiento && mqMovimiento.matches);   // se lee en vivo

  /* ---------- GL ---------- */

  function prepararGL() {
    // Un solo triángulo que cubre la pantalla (más barato y sin costura que dos).
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  function compilar(tipo, fuente) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log || "no compiló");
    }
    return s;
  }

  // Un programa por familia, compilado la primera vez que se usa.
  function programa(familia) {
    if (programas[familia]) return programas[familia];
    const vs = compilar(gl.VERTEX_SHADER, VERTICE);
    const fs = compilar(gl.FRAGMENT_SHADER, PRELUDIO + FRAGMENTOS[familia] + CIERRE);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(log || "no enlazó");
    }
    const u = {};
    for (const n of ["uT", "uGt", "uRes", "uPal", "uN", "uEsc", "uGrano", "uSem", "uPtr", "uPtrF"]) u[n] = gl.getUniformLocation(p, n);
    return (programas[familia] = { p, u });
  }

  // Si algo no compila no dejamos un canvas negro: cae al degradé CSS.
  function caerAlDegradado(motivo) {
    console.warn("fondoShader: paso al degradé CSS.", motivo);
    sinGPU = true;
    canvas.style.background = gradienteDe(paleta);
    canvas.classList.add("esta-lista");
    gradienteAplicado = true;
    actualizarBucle();
  }

  function dibujar() {
    if (destruido || perdido || sinGPU || gl.isContextLost()) return;
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    if (canvas.width <= 1) medir();
    let prog;
    try { prog = programa(op.familia); } catch (e) { caerAlDegradado(`${op.familia}: ${e.message}`); return; }
    const u = prog.u;
    const sem = offsetSemilla(op.semilla);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog.p);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uGt, tGrano);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform3fv(u.uPal, paleta.plano);
    gl.uniform1f(u.uN, paleta.n);
    gl.uniform1f(u.uEsc, op.escala);
    gl.uniform1f(u.uGrano, op.grano);
    gl.uniform2f(u.uSem, sem[0], sem[1]);
    gl.uniform2f(u.uPtr, mira.x, mira.y);
    gl.uniform1f(u.uPtrF, mira.fuerza);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!yaDibujo) { yaDibujo = true; canvas.classList.add("esta-lista"); }
  }

  // El buffer de dibujo se limita por dprMax; devuelve true si cambió de tamaño (y quedó en blanco).
  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, op.dprMax);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    return true;
  }

  /* ---------- Bucle ---------- */

  const quiereCorrer = () =>
    !destruido && !perdido && !sinGPU && !document.hidden && (grabando > 0 || (visible && !pausadoManual && !reducido()));

  function cuadro(ahora) {
    idRaf = 0;
    if (!quiereCorrer()) return;
    const dt = Math.min(0.1, Math.max(0, (ahora - ultimo) / 1000));   // un tirón (pestaña dormida) no pega un salto
    ultimo = ahora;
    t += dt * op.velocidad;
    tGrano += dt;
    actualizarPuntero(dt);
    dibujar();
    if (quiereCorrer()) idRaf = requestAnimationFrame(cuadro);
  }

  function actualizarBucle() {
    const debe = quiereCorrer();
    if (debe && !idRaf) {
      ultimo = performance.now();
      idRaf = requestAnimationFrame(cuadro);
    } else if (!debe && idRaf) {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
    }
    marcarEstado();
  }

  // data-fondo dice lo que pasa de verdad: activo | pausado (fuera de pantalla, pestaña oculta o pausa) |
  // quieto (reducir movimiento) | respaldo (sin WebGL). Sirve para comprobar la pausa desde fuera.
  function marcarEstado() {
    if (destruido) return;
    const e = sinGPU ? "respaldo" : quiereCorrer() ? "activo" : reducido() ? "quieto" : "pausado";
    if (canvas.dataset.fondo !== e) canvas.dataset.fondo = e;
  }

  // Un cuadro suelto cuando el bucle no está corriendo (reducir movimiento, pausa, cambio de opciones).
  function cuadroQuieto() {
    if (!idRaf && (visible || pausadoManual)) dibujar();
  }

  /* ---------- Puntero: solo mouse. En táctil el fondo queda en su ritmo propio, sin reaccionar. ---------- */

  function alPuntero(e) {
    if (e.pointerType === "touch") return;
    mira.cx = e.clientX;
    mira.cy = e.clientY;
    mira.hay = true;
  }
  function alSalirDeLaVentana() { mira.hay = false; }

  function enlazarPuntero() {
    window.removeEventListener("pointermove", alPuntero);
    document.documentElement.removeEventListener("mouseleave", alSalirDeLaVentana);
    if (!op.puntero) { mira.hay = false; return; }
    window.addEventListener("pointermove", alPuntero, { passive: true });
    document.documentElement.addEventListener("mouseleave", alSalirDeLaVentana);
  }

  function actualizarPuntero(dt) {
    if (op.puntero && mira.hay) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const x = (mira.cx - r.left) / r.width;
        const y = 1 - (mira.cy - r.top) / r.height;
        mira.objX = x;
        mira.objY = y;
        mira.objF = x >= -0.05 && x <= 1.05 && y >= -0.05 && y <= 1.05 ? 1 : 0;
      }
    } else {
      mira.objF = 0;
    }
    if (mira.fuerza < 0.02) { mira.x = mira.objX; mira.y = mira.objY; }   // al entrar no "viaja" desde donde estaba
    else {
      const k = 1 - Math.exp(-dt * 7);
      mira.x += (mira.objX - mira.x) * k;
      mira.y += (mira.objY - mira.y) * k;
    }
    mira.fuerza += (mira.objF - mira.fuerza) * (1 - Math.exp(-dt * 3.5));
  }

  /* ---------- Observadores ---------- */

  let io = null;
  if ("IntersectionObserver" in window) {
    visible = false;   // hasta que alguien lo vea no se compila ni se dibuja nada
    io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      actualizarBucle();
      if (visible) cuadroQuieto();
    }, { rootMargin: "80px" });
    io.observe(canvas);
  }

  let ro = null;
  const alRedimensionar = () => {
    // Al cambiar el tamaño el canvas queda en blanco: se redibuja ya, antes de que se pinte la página.
    if (medir() && (visible || grabando > 0)) dibujar();
  };
  if ("ResizeObserver" in window) { ro = new ResizeObserver(alRedimensionar); ro.observe(canvas); }
  window.addEventListener("resize", alRedimensionar);

  const alCambiarVisibilidad = () => { actualizarBucle(); if (!document.hidden) cuadroQuieto(); };
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  const alCambiarMovimiento = () => { actualizarBucle(); cuadroQuieto(); };
  if (mqMovimiento) {
    if (mqMovimiento.addEventListener) mqMovimiento.addEventListener("change", alCambiarMovimiento);
    else if (mqMovimiento.addListener) mqMovimiento.addListener(alCambiarMovimiento);
  }

  const alPerderContexto = (e) => { e.preventDefault(); perdido = true; programas = {}; actualizarBucle(); };
  const alRecuperarContexto = () => {
    perdido = false;
    prepararGL();
    medir();
    actualizarBucle();
    cuadroQuieto();
  };
  canvas.addEventListener("webglcontextlost", alPerderContexto, false);
  canvas.addEventListener("webglcontextrestored", alRecuperarContexto, false);

  /* ---------- API ---------- */

  function cambiar(nuevas = {}) {
    if (destruido) return api;
    const dprAntes = op.dprMax;
    op = normalizar({ ...op, ...sinVacios(nuevas) });
    if ("paleta" in nuevas) {
      op.paleta = nuevas.paleta;     // null = volver a leer los tokens (útil al cambiar de tema)
      paleta = resolverPaleta(canvas, op.paleta);
      if (gradienteAplicado) canvas.style.background = gradienteDe(paleta);
    }
    if (op.dprMax !== dprAntes) medir();
    enlazarPuntero();
    cuadroQuieto();
    return api;
  }

  // Dibuja y captura en el mismo tick: así no hace falta preserveDrawingBuffer.
  function foto() {
    if (destruido || perdido || sinGPU) return Promise.resolve(null);
    medir();
    dibujar();
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
  }

  // Graba aunque el fondo esté pausado o fuera de pantalla (si no, el video saldría congelado).
  function grabar(segundos = 6) {
    return new Promise((res, rej) => {
      if (destruido || perdido || sinGPU) return res(null);
      if (!canvas.captureStream || typeof MediaRecorder === "undefined") return rej(new Error("Este navegador no puede grabar un canvas."));
      if (grabador) return rej(new Error("Ya se está grabando."));
      const tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const flujo = canvas.captureStream(30);
      const trozos = [];
      let rec;
      try { rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 }); }
      catch (e) { flujo.getTracks().forEach((p) => p.stop()); return rej(e); }
      grabador = rec;
      grabando++;
      actualizarBucle();
      rec.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
      rec.onerror = (e) => { terminar(); rej(e.error || new Error("Falló la grabación.")); };
      rec.onstop = () => { terminar(); res(new Blob(trozos, { type: "video/webm" })); };
      function terminar() {
        flujo.getTracks().forEach((p) => p.stop());
        if (grabador === rec) { grabador = null; grabando = Math.max(0, grabando - 1); }
        actualizarBucle();
        cuadroQuieto();
      }
      rec.start(250);
      setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, Math.max(0.5, Number(segundos) || 6) * 1000);
    });
  }

  function destruir() {
    if (destruido) return;
    destruido = true;
    if (grabador && grabador.state !== "inactive") { try { grabador.stop(); } catch (_) {} }
    if (idRaf) cancelAnimationFrame(idRaf);
    idRaf = 0;
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    window.removeEventListener("resize", alRedimensionar);
    window.removeEventListener("pointermove", alPuntero);
    document.documentElement.removeEventListener("mouseleave", alSalirDeLaVentana);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    if (mqMovimiento) {
      if (mqMovimiento.removeEventListener) mqMovimiento.removeEventListener("change", alCambiarMovimiento);
      else if (mqMovimiento.removeListener) mqMovimiento.removeListener(alCambiarMovimiento);
    }
    canvas.removeEventListener("webglcontextlost", alPerderContexto, false);
    canvas.removeEventListener("webglcontextrestored", alRecuperarContexto, false);
    try {
      for (const k in programas) gl.deleteProgram(programas[k].p);
      if (buffer) gl.deleteBuffer(buffer);
      // Si el canvas ya salió del DOM, suelta la GPU ya (la página tiene un tope de contextos).
      // Si sigue ahí no: un contexto perdido no se puede reusar y se podría volver a crear el fondo sobre él.
      const ext = !canvas.isConnected && gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    } catch (_) { /* el contexto ya estaba perdido */ }
    programas = {};
    if (gradienteAplicado) canvas.style.background = "";
    canvas.classList.remove("esta-lista");
    delete canvas.dataset.fondo;
  }

  const api = { pausar() { pausadoManual = true; actualizarBucle(); }, reanudar() { pausadoManual = false; actualizarBucle(); cuadroQuieto(); }, cambiar, foto, grabar, destruir };

  prepararGL();
  medir();
  enlazarPuntero();
  marcarEstado();
  if (!io) { actualizarBucle(); cuadroQuieto(); }   // sin IntersectionObserver se asume visible
  return api;
}
