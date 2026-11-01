// El token de Instagram (INSTAGRAM_TOKEN, inicio de sesión de Instagram): cuánto le queda y su renovación.
//
// Lo que dice la doc de Meta (oct-2026):
//   - el token que se genera en el panel de la app dura 60 días ("Access tokens from the App Dashboard
//     are long-lived and are valid for 60 days"): .../instagram-api-with-instagram-login/get-started
//   - se renueva con GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…
//     si tiene al menos 24 h y no venció; el nuevo dura 60 días desde la renovación, y uno que no se
//     renueva en 60 días vence y ya no se puede renovar: .../instagram-platform/reference/refresh_access_token
//     y .../instagram-api-with-instagram-login/business-login
//
// OJO, la única excepción a "el token nunca va en una URL": la doc documenta la renovación SOLO con el
// token en la URL (access_token=…), sin cabecera. Para achicar el riesgo: el pedido va únicamente a
// graph.instagram.com (o al simulador local), por https, sin seguir redirecciones, sin reintentos, la
// URL no se muestra ni se guarda nunca, y todo lo que se imprime pasa por sanear().
//
// registro-meta/token-instagram.json guarda SOLO fechas (nunca el token):
//   emitido       → cuándo salió el token que está en .env (hasta la primera renovación: la primera vez que se vio)
//   renovado      → la última renovación hecha por este publicador (null si todavía no hubo)
//   vence         → cuándo vence según Meta (null hasta la primera renovación)
//   envModificado → la fecha de .env después de que el publicador lo guardó: si cambia, alguien editó .env
//                   (quizá pegó otro token) y las fechas dejan de valer
import { readFileSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, statSync, accessSync, constants } from "node:fs";
import { join } from "node:path";
import { Falla, decir, leerJson, escribirArchivo, parsearEnv, registrarSecreto, GRAPH_INSTAGRAM } from "./entorno.mjs";
import { ErrorMeta, ErrorRed, explicarError, TOKEN_IG_NO_SIRVE } from "./errores.mjs";
import { tomarCandado } from "./registro.mjs";
import { unixAHoraLocal } from "./tiempo.mjs";

const HORA = 3_600_000;
const DIA = 24 * HORA;
// Los del panel y los renovados duran 60 días (doc: get-started y refresh_access_token).
const VIDA = 60 * DIA;
// Meta pide que el token tenga al menos 24 h: se deja una hora de margen.
// Renovación automática: si pasó más de una semana desde la última, o si le quedan menos de 20 días.
export const REGLAS = { minimo: 25 * HORA, cada: 7 * DIA, quedanPocos: 20 * DIA };

const NOTA = "Lo escribe herramientas/meta.mjs. Solo fechas del token de Instagram, NUNCA el token: emitido = cuándo salió el token que está en .env (aproximado hasta la primera renovación), renovado = última renovación, vence = cuándo vence según Meta, envModificado = la fecha de .env cuando lo guardó el publicador (si no coincide, alguien editó .env y las fechas no valen).";

export const archivoFechas = (raiz) => join(raiz, "registro-meta", "token-instagram.json");
const archivoEnv = (raiz) => join(raiz, ".env");
const iso = (ms) => new Date(ms).toISOString();
const fechaLocal = (ms, zona) => unixAHoraLocal(Math.floor(ms / 1000), zona);

function mtimeEnv(raiz) {
  try { return statSync(archivoEnv(raiz)).mtimeMs; } catch { return null; }
}

function leerFechas(raiz) {
  let f;
  try { f = leerJson(archivoFechas(raiz)); } catch { return null; } // roto: se toma como "no sé" y se reescribe
  if (!f || typeof f !== "object" || Number.isNaN(Date.parse(f.emitido))) return null;
  return f;
}

function guardarFechas(raiz, { emitido, renovado = null, vence = null }) {
  const m = mtimeEnv(raiz);
  escribirArchivo(archivoFechas(raiz), JSON.stringify({
    nota: NOTA,
    emitido: iso(emitido),
    renovado: renovado ? iso(renovado) : null,
    vence: vence ? iso(vence) : null,
    envModificado: m != null ? iso(m) : null,
  }, null, 2) + "\n");
}

// Lo que se sabe del token hoy (solo lee). conocido=false: no hay fechas o .env cambió desde la última vez.
// Antes de la primera renovación no se sabe el día exacto en que vence, pero hay un tope seguro (estimado):
// el token salió el día en que se vio por primera vez o antes, y dura 60 días, así que vence ese día + 60
// o antes. Con ese tope se avisa igual cuando se está por vencer (o ya venció).
export function estadoToken(entorno, ahora = Date.now()) {
  const f = leerFechas(entorno.raiz);
  if (!f) return { conocido: false, motivo: "sin-fechas" };
  const m = mtimeEnv(entorno.raiz);
  if (f.envModificado && m != null && Math.abs(m - Date.parse(f.envModificado)) > 2000) return { conocido: false, motivo: "env-cambio" };
  const emitido = Date.parse(f.emitido);
  const renovado = f.renovado ? Date.parse(f.renovado) : null;
  const vence = f.vence ? Date.parse(f.vence) : null;
  if (vence != null) return { conocido: true, emitido, renovado, vence, estimado: false, dias: Math.floor((vence - ahora) / DIA), vencido: vence <= ahora };
  const tope = emitido + VIDA;
  return { conocido: true, emitido, renovado, vence: null, estimado: true, tope, dias: Math.floor((tope - ahora) / DIA), vencido: tope <= ahora };
}

const nDias = (n) => (n <= 0 ? "menos de un día" : n === 1 ? "1 día" : `${n} días`);
// "le queda 1 día" / "le queda menos de un día" / "le quedan 5 días": el verbo concuerda.
const leQueda = (n) => (n <= 1 ? "le queda" : "le quedan");
const GENERAR = 'hay que generar uno nuevo en el panel de la app y pegarlo en la línea INSTAGRAM_TOKEN= de .env (README.md)';

// En castellano: cuánto le queda al token.
export function textoDias(estado, zona) {
  if (!estado.conocido) return "no sé cuántos días le quedan (no tengo la fecha en que salió): lo voy a saber en la primera renovación";
  const dia = (ms) => fechaLocal(ms, zona).slice(0, 10);
  if (estado.estimado) {
    if (estado.vencido) return `venció a más tardar el ${dia(estado.tope)} (60 días después del ${dia(estado.emitido)}, cuando lo vi por primera vez) y no se renovó a tiempo: Meta no deja renovar un token vencido, ${GENERAR}`;
    const desde = estado.emitido + REGLAS.minimo;
    return `${leQueda(estado.dias)} como mucho ${nDias(estado.dias)} (vence a más tardar el ${dia(estado.tope)}; lo voy a saber exacto en la primera renovación${desde > Date.now() ? `, que se puede desde el ${fechaLocal(desde, zona)}` : ""})`;
  }
  if (estado.vencido) return `venció el ${dia(estado.vence)}: Meta no deja renovar un token vencido, ${GENERAR}`;
  return `${leQueda(estado.dias)} ${nDias(estado.dias)} (vence el ${dia(estado.vence)})`;
}

// Lo que hay que avisar del token después de intentar renovarlo (verificar y publicar --de-verdad), o null.
//   vencido: true → no sirve más: hay que generar otro (verificar lo pone en "Qué falta"; publicar no publica).
//   ojo: true     → la renovación anduvo pero Meta le dio poca vida (solo un aviso).
//   si no         → vence en menos de una semana y no se pudo renovar: va a "Qué falta".
export function alertaDelToken(estado, zona) {
  if (!estado?.conocido) return null;
  if (estado.vencido) return { vencido: true, texto: `el token de Instagram ${textoDias(estado, zona)}` };
  if (estado.dias == null || estado.dias >= 7) return null;
  const cuando = `${estado.dias <= 0 ? "vence en menos de un día" : `vence en ${nDias(estado.dias)}`}${estado.estimado ? " (o antes)" : ""}`;
  if (estado.renovadoAhora) return { ojo: true, texto: `Meta renovó el token, pero el nuevo ${cuando}: si la próxima renovación da lo mismo, generá uno nuevo en el panel de la app` };
  if (estado.renovacionFallo === "no-guardado") return { texto: `el token de .env ${cuando} y el nuevo que dio Meta no lo pude guardar (.env estaba abierto en otro programa): cerrá lo que tenga abierto .env y corré node herramientas/meta.mjs renovar` };
  return { texto: `el token de Instagram ${cuando} y no lo pude renovar: generá uno nuevo en el panel de la app y pegalo en .env, en la línea INSTAGRAM_TOKEN= (README.md)` };
}

// ¿Toca renovar? Devuelve el motivo, o null.
export function motivoParaRenovar(estado, ahora = Date.now()) {
  if (!estado.conocido || estado.vencido) return null;
  if (ahora - estado.emitido < REGLAS.minimo) return null; // muy nuevo: Meta no lo deja
  if (estado.renovado == null) return "todavía no lo había renovado nunca";
  if (ahora - estado.renovado > REGLAS.cada) return "pasó más de una semana desde la última renovación";
  if (estado.vence != null && estado.vence - ahora < REGLAS.quedanPocos) return "le quedan menos de 20 días";
  return null;
}

// Por qué no se puede tocar .env en esta corrida (o null si se puede).
function impedimento(entorno) {
  if (!entorno.igToken) return "falta INSTAGRAM_TOKEN en .env";
  if (entorno.simulador && entorno.esProyectoReal) return "contra el simulador con la carpeta real no toco .env";
  if (entorno.igTokenDeVariable) return "INSTAGRAM_TOKEN viene de una variable de entorno y no de .env: no puedo guardar el nuevo ahí (sacá la variable o renovalo a mano)";
  return null;
}

// ---------- .env ----------
const LINEA = /^(\s*(?:export\s+)?INSTAGRAM_TOKEN\s*=\s*)(.*?)(\s*)$/;

// Cambia solo el valor de la (última) línea INSTAGRAM_TOKEN=, y deja todo lo demás igual: comentarios,
// otras claves, saltos de línea (\r\n o \n), un comentario al final de esa línea, comillas.
export function reemplazarToken(texto, viejo, nuevo) {
  const partes = String(texto).split(/(\r\n|\r|\n)/); // [línea, salto, línea, salto, …] (los saltos, como estaban)
  let i = -1;
  for (let k = 0; k < partes.length; k += 2) if (LINEA.test(partes[k])) i = k;
  if (i === -1) throw new Falla("no encuentro la línea INSTAGRAM_TOKEN= en .env: no lo toco");
  const [, antes, crudo, cola] = partes[i].match(LINEA);
  // Entre comillas, con o sin un comentario después (igual que parsearEnv).
  const comillas = crudo.match(/^(["'])(.*?)\1((?:\s+#.*)?)$/);
  const valor = comillas ? comillas[2] : crudo.replace(/\s+#.*$/, "");
  if (valor !== viejo) throw new Falla("la línea INSTAGRAM_TOKEN= de .env no tiene el token que estoy usando (¿lo cambiaste mientras corría?): no la toco");
  const nuevoCrudo = comillas ? comillas[1] + nuevo + comillas[1] + comillas[3] : nuevo + crudo.slice(valor.length);
  partes[i] = antes + nuevoCrudo + cola;
  const resultado = partes.join("");
  // Control antes de escribir: leído de nuevo, solo cambió INSTAGRAM_TOKEN y vale el token nuevo.
  const a = parsearEnv(texto);
  const b = parsearEnv(resultado);
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const c of claves) {
    if (c === "INSTAGRAM_TOKEN" ? b[c] !== nuevo : a[c] !== b[c]) throw new Falla("el .env nuevo no quedaba bien armado: no lo toco");
  }
  return resultado;
}

// ---------- el pedido a Meta ----------
// GET /refresh_access_token con el token en la URL (la doc no muestra otra forma). Sin reintentos.
async function pedirRenovacion(entorno) {
  const origen = new URL(entorno.igGraph).origin;
  if (!entorno.simulador && origen !== GRAPH_INSTAGRAM) throw new Falla("la renovación solo va a graph.instagram.com");
  const donde = "GET /refresh_access_token";
  let respuesta;
  let datos;
  try {
    respuesta = await fetch(`${origen}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(entorno.igToken)}`, {
      method: "GET",
      redirect: "error", // una redirección llevaría la URL (con el token) a otro lado
      signal: AbortSignal.timeout(60_000),
      headers: { "Cache-Control": "no-store" },
    });
    const texto = await respuesta.text();
    try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { crudo: texto.slice(0, 300) }; }
  } catch (e) {
    // Nunca e.message: según el error, podría traer la URL.
    throw new ErrorRed(donde, e?.cause?.code || e?.name || "sin detalle");
  }
  // Lo primero: que el token nuevo quede registrado para taparlo en cualquier mensaje.
  const nuevo = typeof datos?.access_token === "string" ? datos.access_token.trim() : "";
  registrarSecreto(nuevo);
  if (!respuesta.ok || datos.error) {
    const err = new ErrorMeta({ http: respuesta.status, error: datos.error || { message: datos.crudo }, donde });
    if (err.code === 190 || err.code === 102) err.sugerencia = TOKEN_IG_NO_SIRVE;
    throw err;
  }
  if (nuevo.length < 20 || !/^[A-Za-z0-9._~|-]+$/.test(nuevo)) throw new Falla("Meta contestó sin un token nuevo que se pueda usar: no toqué .env");
  const segundos = Number(datos.expires_in);
  return { nuevo, segundos: Number.isFinite(segundos) && segundos > 0 ? segundos : 60 * 86400 };
}

// Meta ya dio el token nuevo, pero no quedó en .env (sigue el anterior). No es "no se renovó": los
// mensajes lo dicen distinto. El token nuevo no se guarda en ningún otro lado (ni .bak ni nada).
export class TokenNoGuardado extends Falla {}

// En Windows, el antivirus, el indexador o un programa con .env abierto lo traban un rato (EBUSY, EPERM,
// EACCES). Se reintenta unos 3 segundos, como hacen graceful-fs y write-file-atomic.
const TRABADO = new Set(["EBUSY", "EPERM", "EACCES"]);
const ESPERAS_TRABADO = [100, 200, 400, 400, 400, 500, 500, 500];
async function insistir(hacer) {
  for (let i = 0; ; i++) {
    try { return hacer(); } catch (e) {
      if (!TRABADO.has(e?.code) || i >= ESPERAS_TRABADO.length) throw e;
      await new Promise((r) => setTimeout(r, ESPERAS_TRABADO[i]));
    }
  }
}
const porQue = (e) => (TRABADO.has(e?.code) ? ".env estaba abierto o trabado por otro programa (el antivirus, el indexador de Windows o un editor)" : `no se pudo (${e?.code || e?.message})`);

// Renueva y guarda. Escritura de golpe: un temporal al lado (.env.renovando-<proceso>.tmp) que se
// renombra encima de .env; si algo falla, el temporal se borra y .env queda como estaba.
// No deja copias del token en ningún lado (ni .bak ni .tmp).
async function renovarAhora(entorno) {
  const ruta = archivoEnv(entorno.raiz);
  // Se reescribe .env como UTF-8: si estuviera en otra codificación (ANSI), las letras con tilde de
  // las otras líneas se romperían. Se frena antes de pedir nada (ignoreBOM: la marca BOM, si hay, queda igual).
  let texto;
  try { texto = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(readFileSync(ruta)); } catch {
    throw new Falla('maquina-de-contenido/.env no está guardado en UTF-8 (alguna letra con tilde está en otra codificación) y al guardar el token nuevo se romperían esas letras: abrilo en el Bloc de notas → "Guardar como" → Codificación "UTF-8". No pedí la renovación');
  }
  const antes = estadoToken(entorno);
  // Antes de pedirle nada a Meta: que .env se pueda escribir (si no, el token nuevo se perdería).
  try { accessSync(ruta, constants.W_OK); } catch {
    throw new Falla("no puedo escribir maquina-de-contenido/.env (está en solo lectura o bloqueado): no pedí la renovación");
  }
  reemplazarToken(texto, entorno.igToken, "X".repeat(40)); // que la línea esté y tenga el token de esta corrida
  const tmp = join(entorno.raiz, `.env.renovando-${process.pid}.tmp`);
  let fd;
  try { fd = openSync(tmp, "wx", 0o600); } catch (e) {
    throw new Falla(`no puedo crear un temporal al lado de .env (${e.code || e.message}): no pedí la renovación`);
  }
  let movido = false;
  try {
    const { nuevo, segundos } = await pedirRenovacion(entorno);
    // Desde acá Meta ya dio el token nuevo: si no se puede guardar, se dice eso (no "no se renovó").
    const noGuardado = (e) => {
      entorno.igToken = nuevo; // lo que queda de esta corrida usa el nuevo; .env sigue con el anterior
      return new TokenNoGuardado(`Meta renovó el token, pero no lo pude guardar en .env: ${porQue(e)}. En .env sigue el anterior, que según lo que se sabe sirve hasta su vencimiento: ${textoDias(antes, entorno.zona)}. La próxima corrida lo vuelve a intentar sola; si querés, cerrá lo que tenga abierto .env y corré node herramientas/meta.mjs renovar`);
    };
    // Si alguien editó .env mientras se esperaba a Meta (quizá pegó otro token), no se pisa su cambio.
    const cambio = () => new TokenNoGuardado(".env cambió mientras renovaba el token: no lo piso. Meta dio uno nuevo, pero en .env queda lo que escribiste vos; corré node herramientas/meta.mjs verificar");
    let actual;
    try { actual = await insistir(() => readFileSync(ruta, "utf8")); } catch (e) { throw noGuardado(e); }
    if (actual !== texto) throw cambio();
    let contenido;
    try { contenido = reemplazarToken(texto, entorno.igToken, nuevo); } catch (e) { throw noGuardado(e); }
    writeSync(fd, contenido);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    try {
      await insistir(() => {
        // Antes de cada intento, que .env siga igual (si no se puede leer, cuenta como trabado y se reintenta).
        if (readFileSync(ruta, "utf8") !== texto) throw cambio();
        renameSync(tmp, ruta);
      });
      movido = true;
    } catch (e) {
      if (e instanceof Falla) throw e;
      throw noGuardado(e);
    }
    const ahora = Date.now();
    entorno.igToken = nuevo; // lo que queda de esta corrida usa el nuevo
    try {
      guardarFechas(entorno.raiz, { emitido: ahora, renovado: ahora, vence: ahora + segundos * 1000 });
    } catch (e) {
      // .env ya tiene el token nuevo: esto no es una falla de la renovación, solo de las fechas.
      decir(`Aviso: el token nuevo ya está en .env, pero no pude anotar las fechas en registro-meta/token-instagram.json (${e.code || e.message}); la próxima corrida lo cuenta desde ese día.`);
    }
    return { ...estadoToken(entorno, ahora), renovadoAhora: true };
  } finally {
    if (fd != null) { try { closeSync(fd); } catch { /* ya cerrado */ } }
    if (!movido) { try { unlinkSync(tmp); } catch { /* ya no estaba */ } }
  }
}

// Meta contestó que el token no sirve: decir "le quedan N días" sería contradecirse.
const tokenMuerto = (e) => e?.code === 190 || e?.code === 102;

// ---------- lo que usan los comandos ----------
// verificar y publicar --de-verdad: anota la fecha la primera vez y renueva cuando toca. Nunca frena:
// si no puede renovar, avisa y sigue con el token que hay.
// conCandado: la corrida ya tiene registro-meta/.candado (publicar); si no, lo toma para renovar.
// Devuelve el estado del token (estadoToken), con renovadoAhora: true si se renovó en esta corrida, o
// renovacionFallo: true / "no-guardado" si se intentó y no se pudo (alertaDelToken lo usa).
export async function renovarSiCorresponde(entorno, { conCandado = false } = {}) {
  const motivoNo = impedimento(entorno);
  if (motivoNo) {
    if (entorno.igToken && entorno.igTokenDeVariable) decir(`Aviso: ${motivoNo}.`);
    return estadoToken(entorno);
  }
  let estado = estadoToken(entorno);
  if (!estado.conocido) {
    guardarFechas(entorno.raiz, { emitido: Date.now() });
    decir(estado.motivo === "env-cambio"
      ? "Token de Instagram: .env cambió desde la última renovación (¿pegaste otro token?): cuento el token desde hoy. Anoté la fecha en registro-meta/token-instagram.json (solo la fecha)."
      : "Token de Instagram: es la primera vez que lo veo. Anoté la fecha en registro-meta/token-instagram.json (solo la fecha, nunca el token).");
    return estadoToken(entorno);
  }
  const motivo = motivoParaRenovar(estado);
  if (!motivo) return estado;

  let soltar = () => {};
  if (!conCandado) {
    try { soltar = tomarCandado(entorno.raiz); } catch (e) {
      if (!(e instanceof Falla)) throw e;
      decir("Aviso: hay otra corrida publicando; no renuevo el token ahora (sigo con el que hay).");
      return estado;
    }
  }
  try {
    decir(`Token de Instagram: lo renuevo (${motivo})…`);
    const nuevo = await renovarAhora(entorno);
    decir(`  Listo: token renovado, ${textoDias(nuevo, entorno.zona)}. Lo guardé en .env (solo esa línea) y las fechas en registro-meta/token-instagram.json.`);
    return nuevo;
  } catch (e) {
    if (e instanceof TokenNoGuardado) {
      decir(`Aviso: ${e.message}.`);
      return { ...estado, renovacionFallo: "no-guardado" };
    }
    decir(`Aviso: no pude renovar el token de Instagram. No toqué .env; ${tokenMuerto(e) ? "Meta contestó que el token no sirve (lo confirmo enseguida con la cuenta)" : textoDias(estado, entorno.zona)}.`);
    decir(explicarError(e).replace(/^/gm, "  "));
    return { ...estado, renovacionFallo: true };
  } finally {
    soltar();
  }
}

// node herramientas/meta.mjs renovar
export async function renovar(entorno) {
  if (entorno.modo === "facebook") throw new Falla("renovar es para INSTAGRAM_TOKEN (inicio de sesión de Instagram) y no está en .env: el token del usuario del sistema de Facebook no se renueva así", { codigo: 2 });
  const motivoNo = impedimento(entorno);
  if (motivoNo) throw new Falla(`no renuevo: ${motivoNo}`, { codigo: 2 });
  const estado = estadoToken(entorno);
  if (estado.conocido && estado.vencido) throw new Falla(`el token ${textoDias(estado, entorno.zona)}`);
  if (estado.conocido && Date.now() - estado.emitido < REGLAS.minimo) {
    decir(`El token es muy nuevo: salió el ${fechaLocal(estado.emitido, entorno.zona)} y Meta pide que tenga al menos 24 h para renovarlo. Se puede desde el ${fechaLocal(estado.emitido + REGLAS.minimo, entorno.zona)}; mientras tanto, ${textoDias(estado, entorno.zona)}. No le pedí nada a Meta ni toqué .env.`);
    return 0;
  }
  const soltar = tomarCandado(entorno.raiz);
  try {
    // Sin fechas no sé su edad: se intenta igual (lo pediste), y si falla queda anotado desde cuándo lo veo.
    if (!estado.conocido) guardarFechas(entorno.raiz, { emitido: Date.now() });
    decir(`Renuevo el token de Instagram (GET ${new URL(entorno.igGraph).host}/refresh_access_token)…`);
    const nuevo = await renovarAhora(entorno);
    decir(`Listo: token renovado, ${textoDias(nuevo, entorno.zona)}. Lo guardé en .env (solo la línea INSTAGRAM_TOKEN) y las fechas en registro-meta/token-instagram.json.`);
    return 0;
  } catch (e) {
    decir(explicarError(e));
    // Meta sí lo renovó pero no quedó en .env (o .env cambió): el mensaje ya dice qué pasó y qué hacer.
    if (e instanceof TokenNoGuardado) return 1;
    const pista = estado.conocido ? "" : " Si el token lo generaste hoy, es normal: Meta pide que tenga al menos 24 h.";
    decir(`\nNo se renovó. No toqué .env: sigue el mismo token${tokenMuerto(e) ? ", pero Meta contestó que no sirve: corré node herramientas/meta.mjs verificar para confirmarlo" : `, y ${textoDias(estado, entorno.zona)}`}.${pista}`);
    return 1;
  } finally {
    soltar();
  }
}
