// Entorno del publicador de Meta: lee .env sin dependencias, config.json y arma las direcciones de
// la Graph API. También guarda los secretos (tokens) para que nunca salgan enteros por pantalla
// ni terminen en un archivo: todo lo que se imprime o se escribe pasa por sanear().
import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync, mkdirSync, realpathSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_PROYECTO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// La versión que muestran los ejemplos de la doc de Meta en oct-2026. Se cambia con META_GRAPH_VERSION.
export const VERSION_POR_DEFECTO = "v26.0";
const GRAPH = "https://graph.facebook.com";
const RUPLOAD = "https://rupload.facebook.com";
// "Instagram API with Instagram Login" (Business Login for Instagram): otro host y otro token.
// developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
export const GRAPH_INSTAGRAM = "https://graph.instagram.com";

// Los tres modos del publicador (los decide .env, ver cargarEntorno):
//   instagram → solo INSTAGRAM_TOKEN: Instagram con inicio de sesión de Instagram; Facebook no está conectado.
//   facebook  → solo META_ACCESS_TOKEN: el camino de antes (usuario del sistema + página), Instagram y Facebook.
//   mixto     → los dos: Instagram va con INSTAGRAM_TOKEN y META_ACCESS_TOKEN queda solo para --red=facebook.
export const SIN_FACEBOOK = "Facebook todavía no está conectado (falta el portfolio); por ahora solo Instagram: --red=instagram";

// Error pensado para el usuario: el mensaje ya está en castellano y se muestra tal cual.
export class Falla extends Error {
  constructor(mensaje, { codigo = 1 } = {}) {
    super(mensaje);
    this.codigo = codigo;
  }
}

// ---------- secretos ----------
const secretos = new Set();
// Un pedazo de 8 caracteres de un token ya es "el token": tapa ecos recortados y textos cortados.
const PEDAZO = 8;
export function registrarSecreto(valor) {
  if (typeof valor === "string" && valor.trim().length >= 6) secretos.add(valor.trim());
}
// La regla de la casa: los primeros 4 caracteres y "…". Nunca más.
export const enmascarar = (valor) => (valor ? String(valor).slice(0, 4) + "…" : "(vacío)");

// Marca cada tramo del texto que coincide con 8 o más caracteres seguidos de un secreto.
function tramosDe(t, s) {
  if (s.length < PEDAZO || t.length < PEDAZO) return [];
  const marcas = new Uint8Array(t.length);
  let hay = false;
  for (let i = 0; i + PEDAZO <= t.length; i++) {
    if (s.includes(t.slice(i, i + PEDAZO))) { marcas.fill(1, i, i + PEDAZO); hay = true; }
  }
  if (!hay) return [];
  const tramos = [];
  for (let i = 0; i < t.length; i++) {
    if (!marcas[i]) continue;
    let j = i;
    while (j < t.length && marcas[j]) j++;
    tramos.push([i, j]);
    i = j;
  }
  return tramos;
}

export function sanear(texto) {
  let t = String(texto);
  for (const s of secretos) {
    if (t.includes(s)) t = t.split(s).join(enmascarar(s));
    // Lo que queda: pedazos sueltos (un eco de Meta recortado, un texto cortado a 60 caracteres).
    const tramos = tramosDe(t, s);
    for (const [i, j] of tramos.reverse()) t = t.slice(0, i) + enmascarar(s) + t.slice(j);
  }
  return t;
}

// ¿El texto trae un token (entero o un pedazo) o la línea del .env? Un texto así no se publica nunca.
// También cualquier cosa con forma de token de Meta ("EAA" + decenas de letras y números), aunque no
// sea el de .env: el de la página, uno viejo, uno de otra app.
// Los de Instagram (inicio de sesión de Instagram) empiezan con "IGAA" (los del panel) o "IGQV" (los viejos).
const PARECE_TOKEN = /EAA[A-Za-z0-9]{30,}|IG(?:AA|QV)[A-Za-z0-9_-]{30,}/;
export function contieneSecreto(texto) {
  const t = String(texto || "");
  if (/META_ACCESS_TOKEN|INSTAGRAM_TOKEN/i.test(t) || PARECE_TOKEN.test(t)) return true;
  for (const s of secretos) if (t.includes(s) || tramosDe(t, s).length) return true;
  return false;
}

export const decir = (...partes) => void process.stdout.write(sanear(partes.join(" ")) + "\n");
export const quejarse = (...partes) => void process.stderr.write(sanear(partes.join(" ")) + "\n");

// Escribe saneado y de golpe (archivo temporal + renombrar): un corte a mitad no deja un JSON roto.
export function escribirArchivo(ruta, contenido) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = ruta + ".tmp";
  writeFileSync(tmp, sanear(contenido), "utf8");
  // Si no se puede reemplazar (solo lectura, abierto en otro programa), no queda el .tmp tirado.
  try { renameSync(tmp, ruta); } catch (e) { try { unlinkSync(tmp); } catch { /* ya no estaba */ } throw e; }
}

export function leerJson(ruta) {
  if (!existsSync(ruta)) return null;
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    throw new Falla(`no pude leer ${ruta}: el JSON está roto (${e.message})`);
  }
}

// .env mínimo: CLAVE=valor por línea, # comentarios, comillas opcionales.
export function leerEnv(ruta) {
  if (!existsSync(ruta)) return {};
  const crudo = readFileSync(ruta);
  // Guardado como "Unicode" (UTF-16) en el Bloc de notas: leído como UTF-8 parecería vacío ("falta el token").
  if ((crudo[0] === 0xff && crudo[1] === 0xfe) || (crudo[0] === 0xfe && crudo[1] === 0xff)) {
    throw new Falla(`${ruta} está guardado como "Unicode" (UTF-16): abrilo en el Bloc de notas → "Guardar como" → Codificación "UTF-8" (mismo nombre, Tipo "Todos los archivos")`, { codigo: 2 });
  }
  return parsearEnv(crudo.toString("utf8"));
}

// Si una clave aparece dos veces, vale la última (como cualquier dotenv).
// Saltos de línea de Windows (\r\n), de Linux (\n) o sueltos (\r): con un \r suelto, la línea del token
// quedaría pegada como valor de la anterior.
export function parsearEnv(texto) {
  const vars = {};
  for (const linea of String(texto).split(/\r\n|\r|\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valor = m[2];
    // Entre comillas, con o sin un comentario después: INSTAGRAM_TOKEN="IGAA…"  # el de proyecto
    const comillas = valor.match(/^(["'])(.*?)\1(?:\s+#.*)?$/);
    if (comillas) valor = comillas[2];
    else valor = valor.replace(/\s+#.*$/, "");
    vars[m[1]] = valor;
  }
  return vars;
}

// Misma carpeta aunque cambien las mayúsculas o haya un atajo de por medio (Windows no distingue).
function mismaCarpeta(a, b) {
  const normal = (p) => {
    let r = resolve(p);
    try { r = realpathSync.native(r); } catch { /* si no existe, se compara como vino */ }
    return process.platform === "win32" ? r.toLowerCase() : r;
  };
  return normal(a) === normal(b);
}

// La zona de config.json dicha en castellano para los mensajes ("hora de Buenos Aires").
export function nombreZona(zona) {
  if (zona === "America/Argentina/Buenos_Aires") return "hora de Buenos Aires";
  return `hora de ${String(zona).split("/").pop().replace(/_/g, " ")} (${zona})`;
}

export function cargarEntorno() {
  // META_API_BASE y META_RAIZ son solo para las pruebas: van juntas y solo por variable de entorno.
  const base = String(process.env.META_API_BASE || "").trim();
  if (process.env.META_RAIZ && !base) {
    throw new Falla("META_RAIZ es solo para las pruebas contra el simulador (va junto con META_API_BASE): sacala para publicar de verdad", { codigo: 2 });
  }
  const raiz = process.env.META_RAIZ ? resolve(process.env.META_RAIZ) : RAIZ_PROYECTO;
  const delArchivo = leerEnv(join(raiz, ".env"));
  // Un .env que apunte al simulador se ignoraría en silencio y --de-verdad iría a Meta: se corta acá.
  if (delArchivo.META_API_BASE !== undefined) {
    throw new Falla("META_API_BASE no va en .env (es solo para las pruebas, por variable de entorno): borrá esa línea de maquina-de-contenido/.env", { codigo: 2 });
  }
  const avisos = [];
  // El Bloc de notas suele guardar ".env.txt": ese archivo no se lee (git lo ignora por .env*, pero queda suelto).
  for (const parecido of [".env.txt", ".env.bak", ".env - copia", ".env.local"]) {
    if (existsSync(join(raiz, parecido))) avisos.push(`hay un archivo "${parecido}" en ${raiz}: no se lee y puede terminar en el repositorio. El token va solo en ".env" (sin extensión); borralo`);
  }
  // Una renovación del token cortada a la mitad (se cortó la luz justo ahí) puede dejar el temporal con el token.
  // Si el proceso del nombre sigue vivo, es otra corrida renovando ahora mismo: no se toca.
  for (const suelto of listarTemporalesDeEnv(raiz)) {
    if (procesoVivo(Number(suelto.match(/\d+/)[0]))) continue;
    let bytes = 0;
    try { bytes = statSync(join(raiz, suelto)).size; } catch { continue; } // ya no está
    avisos.push(bytes === 0
      ? `quedó "${suelto}" en ${raiz} de una renovación del token que se cortó: está vacío. Borralo`
      : `quedó "${suelto}" en ${raiz} de una renovación del token que se cortó: es una copia de .env que puede tener el token nuevo. No lo abras ni lo copies. Corré node herramientas/meta.mjs verificar: si el token anda, borralo; si dice que el token no sirve, cerrá todo y renombralo a ".env" (reemplazando el que está) y volvé a verificar`);
  }
  // .env.ejemplo es el único .env* que SÍ va al repositorio: si alguien pegó el token ahí, se frena.
  const ejemplo = leerEnv(join(raiz, ".env.ejemplo"));
  for (const clave of ["META_ACCESS_TOKEN", "INSTAGRAM_TOKEN"]) {
    if (String(ejemplo[clave] ?? "").trim()) {
      throw new Falla(`.env.ejemplo tiene un ${clave} y ese archivo va al repositorio: pasá el token a ".env" y dejá en .env.ejemplo la línea "${clave}=" vacía`, { codigo: 2 });
    }
  }
  // Lo que ya está en el entorno gana sobre .env (como cualquier dotenv).
  const v = (clave) => String(process.env[clave] ?? delArchivo[clave] ?? "").trim();

  const token = v("META_ACCESS_TOKEN");
  // Un token de Meta tiene cientos de caracteres: uno corto está mal copiado (y no se podría tapar bien).
  if (token && token.length < 20) throw new Falla("META_ACCESS_TOKEN es demasiado corto: ¿lo pegaste entero? (README.md)", { codigo: 2 });
  registrarSecreto(token);
  const igToken = v("INSTAGRAM_TOKEN");
  if (igToken && igToken.length < 20) throw new Falla("INSTAGRAM_TOKEN es demasiado corto: ¿lo pegaste entero? (README.md)", { codigo: 2 });
  registrarSecreto(igToken);
  // Un token es una sola tira de letras, números y signos: un espacio o un carácter invisible (se pega
  // al copiar de una página web) haría que el pedido no salga y parecería un problema de internet.
  for (const [clave, valor] of [["META_ACCESS_TOKEN", token], ["INSTAGRAM_TOKEN", igToken]]) {
    if (valor && /[^\x21-\x7e]/.test(valor)) throw new Falla(`${clave} tiene un espacio o un carácter invisible en el medio (pasa al copiar de una página web): borrá lo que hay después del "=" en esa línea de maquina-de-contenido/.env y pegalo de nuevo, sin comillas ni espacios`, { codigo: 2 });
  }
  // Cada token va en su línea. Si quedan cruzados, el publicador elegiría el camino equivocado y mandaría
  // el token a un host que no es el suyo. Meta no documenta los prefijos: solo se frena cuando el comienzo
  // dice claramente que es del otro tipo (los de Instagram empiezan con IGAA o IGQV; los de Facebook, con EAA).
  if (/^IG(AA|QV)/.test(token)) throw new Falla("el token de META_ACCESS_TOKEN es de Instagram (empieza con IG): va en la línea INSTAGRAM_TOKEN= de maquina-de-contenido/.env. Movelo ahí y dejá META_ACCESS_TOKEN= vacío (no hace falta generar otro token)", { codigo: 2 });
  if (/^EAA/.test(igToken)) throw new Falla("el token de INSTAGRAM_TOKEN es de Facebook (empieza con EAA): ese va en la línea META_ACCESS_TOKEN=. En INSTAGRAM_TOKEN= va el que da \"Generar token\" en el panel de la app (empieza con IG; README.md)", { codigo: 2 });
  // Si el token viene de una variable de entorno (y no de .env), renovarlo en .env no serviría de nada.
  const igTokenDeVariable = Boolean(String(process.env.INSTAGRAM_TOKEN ?? "").trim());

  // El modo sale de qué tokens hay. Sin ninguno, el camino actual: Instagram con inicio de sesión de Instagram.
  const modo = token && !igToken ? "facebook" : token && igToken ? "mixto" : "instagram";
  if (modo === "mixto") {
    avisos.push("en .env están INSTAGRAM_TOKEN y META_ACCESS_TOKEN: Instagram va con INSTAGRAM_TOKEN (inicio de sesión de Instagram) y META_ACCESS_TOKEN se usa solo para --red=facebook. Se publica de a una red por vez");
  }

  const version = v("META_GRAPH_VERSION") || VERSION_POR_DEFECTO;
  // Sin repetir lo que dice: si el token quedó pegado al final de esa línea, saldría entero por pantalla.
  if (!/^v\d+\.\d+$/.test(version)) throw new Falla('META_GRAPH_VERSION tiene que ser como "v26.0" (o quedar vacía). Revisá esa línea de maquina-de-contenido/.env: si quedó el token pegado ahí, pasalo a su línea (INSTAGRAM_TOKEN= o META_ACCESS_TOKEN=)', { codigo: 2 });

  const pageId = v("META_PAGE_ID");
  const igUserId = v("META_IG_USER_ID");
  if (pageId && !/^\d+$/.test(pageId)) throw new Falla("META_PAGE_ID tiene que ser el número de la página de Facebook (solo dígitos)", { codigo: 2 });
  if (igUserId && !/^\d+$/.test(igUserId)) throw new Falla("META_IG_USER_ID tiene que ser el número de la cuenta de Instagram (solo dígitos), o quedar vacío", { codigo: 2 });

  // El simulador se elige solo por variable de entorno (no por .env) y solo en esta compu:
  // así un .env olvidado no puede mandar el token a otro lado.
  let graph = GRAPH;
  let rupload = RUPLOAD;
  let igGraph = GRAPH_INSTAGRAM;
  let simulador = false;
  if (base) {
    let u;
    try { u = new URL(base); } catch { u = null; }
    if (!u || u.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(u.hostname) || !u.port) {
      throw new Falla("META_API_BASE solo acepta http://localhost:<puerto> o http://127.0.0.1:<puerto> (es para el simulador de pruebas)", { codigo: 2 });
    }
    // El mismo simulador con dos nombres, para que distinga los hosts como Meta: 127.0.0.1 hace de
    // graph.facebook.com (y rupload) y localhost de graph.instagram.com. Así, un token que fuera al host
    // equivocado lo rechaza, como lo haría Meta.
    graph = rupload = `http://127.0.0.1:${u.port}`;
    igGraph = `http://localhost:${u.port}`;
    simulador = true;
  }

  const config = leerJson(join(raiz, "config.json")) ?? {};
  return {
    raiz,
    esProyectoReal: mismaCarpeta(raiz, RAIZ_PROYECTO),
    modo,
    token,
    igToken,
    igTokenDeVariable,
    pageId,
    igUserId,
    version,
    graph,
    rupload,
    igGraph,
    simulador,
    config,
    avisos,
    zona: config.zonaHoraria || "America/Argentina/Buenos_Aires",
  };
}

// ¿Sigue corriendo ese proceso? (kill con señal 0 no mata nada: solo pregunta)
function procesoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

// Temporales de una renovación del token (.env.renovando-<proceso>.tmp): si quedó alguno, tiene un token.
export function listarTemporalesDeEnv(raiz) {
  try {
    return readdirSync(raiz).filter((n) => /^\.env\.renovando-\d+\.tmp$/.test(n));
  } catch {
    return [];
  }
}
