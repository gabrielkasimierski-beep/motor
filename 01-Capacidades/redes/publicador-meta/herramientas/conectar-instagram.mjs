// Conexión local de Instagram. Sin dependencias ni publicación de contenido.
// Destino final: maquina-de-contenido/herramientas/conectar-instagram.mjs
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ME_URL = "https://graph.instagram.com/v26.0/me?fields=user_id,username";
const MAX_BODY = 8_192;
const LIFETIME = 10 * 60_000;

class SetupError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const equal = (a, b) => typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const validToken = (token) => /^[A-Za-z0-9._~+/-]{20,4096}={0,2}$/.test(token);

function expectedUsername(root) {
  let config;
  try { config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")); }
  catch { throw new SetupError("config", "No pude leer config.json. Abrí este asistente desde una copia completa del proyecto."); }
  const username = config?.meta?.usuarioInstagram;
  if (typeof username !== "string" || !/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    throw new SetupError("config", "Falta config.json → meta.usuarioInstagram o su formato no es válido.");
  }
  return username;
}

// Inyección de fetch solo para pruebas mediante la API exportada; la CLI siempre usa el host oficial.
export async function verifyInstagramToken(token, expected, fetchImpl = globalThis.fetch) {
  if (!validToken(token)) throw new SetupError("token", "El token tiene un formato incorrecto. Copialo completo, sin espacios.");
  let response;
  try {
    response = await fetchImpl(ME_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new SetupError("meta", "No pude verificar la cuenta con Instagram. Revisá la conexión y probá otra vez."); }
  if (!response.ok) {
    // No leer ni repetir el mensaje de Meta: podría incluir el token o parte de él.
    try { await response.body?.cancel(); } catch { /* sin eco de errores externos */ }
    throw new SetupError("meta", "Instagram rechazó el token. Generá uno para la cuenta de proyecto y volvé a intentar.");
  }
  let account;
  try {
    const payload = await response.json();
    // /me está documentado tanto plano como dentro de data:[cuenta]. No elegir una
    // cuenta arbitraria si alguna respuesta inesperada contiene más de una.
    account = Array.isArray(payload?.data) ? (payload.data.length === 1 ? payload.data[0] : null) : payload;
  }
  catch { throw new SetupError("meta", "Instagram no devolvió una cuenta válida. Probá otra vez."); }
  if (typeof account?.username !== "string" || !/^\d+$/.test(String(account?.user_id ?? ""))) {
    throw new SetupError("meta", "Instagram no devolvió una cuenta válida. Probá otra vez.");
  }
  if (account.username.toLowerCase() !== expected.toLowerCase()) {
    throw new SetupError("account", "El token pertenece a otra cuenta. No guardé nada. Generá el token entrando con la cuenta de proyecto.");
  }
  return { username: expected, userId: String(account.user_id) };
}

// Mismas reglas mínimas que meta/entorno.mjs, sin importar módulos del proyecto en este asistente.
function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r\n|\r|\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const quoted = match[2].match(/^(["'])(.*?)\1(?:\s+#.*)?$/);
    values[match[1]] = quoted ? quoted[2] : match[2].replace(/\s+#.*$/, "");
  }
  return values;
}

export function updateEnvAtomically(root, token) {
  if (!validToken(token)) throw new SetupError("token", "El token tiene un formato incorrecto.");
  const path = join(root, ".env");
  let previous;
  try {
    if (existsSync(path) && !lstatSync(path).isFile()) throw new Error("not regular");
    previous = existsSync(path) ? readFileSync(path) : null;
  } catch { throw new SetupError("save", "No pude leer el archivo .env local. Revisá los permisos de esta carpeta."); }
  if (previous && ((previous[0] === 0xff && previous[1] === 0xfe) || (previous[0] === 0xfe && previous[1] === 0xff))) {
    throw new SetupError("save", ".env está en UTF-16. Guardalo como UTF-8 antes de conectar Instagram.");
  }
  const text = previous?.toString("utf8") ?? "";
  // Capturar los separadores conserva incluso mezclas de CRLF/LF y el salto final original.
  const parts = text.split(/(\r\n|\r|\n)/);
  let last = -1;
  for (let i = 0; i < parts.length; i += 2) if (/^\s*(?:export\s+)?INSTAGRAM_TOKEN\s*=/.test(parts[i])) last = i;
  let next;
  if (last >= 0) {
    parts[last] = parts[last].replace(/^(\s*(?:export\s+)?INSTAGRAM_TOKEN\s*=\s*).*$/, (_line, prefix) => prefix + token);
    next = parts.join("");
  } else {
    const newline = text.match(/\r\n|\r|\n/)?.[0] ?? "\n";
    next = text + (text && !/[\r\n]$/.test(text) ? newline : "") + `INSTAGRAM_TOKEN=${token}${newline}`;
  }
  const before = parseEnv(text), after = parseEnv(next);
  if (after.INSTAGRAM_TOKEN !== token || Object.keys(before).some((key) => key !== "INSTAGRAM_TOKEN" && before[key] !== after[key])) {
    throw new SetupError("save", "No pude actualizar únicamente INSTAGRAM_TOKEN. No cambié .env.");
  }
  const temporary = join(root, `.env.conectar-${process.pid}-${randomBytes(8).toString("hex")}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, next, "utf8");
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    const current = existsSync(path) ? readFileSync(path) : null;
    if ((previous === null) !== (current === null) || (previous && !previous.equals(current))) {
      throw new Error("changed during update");
    }
    if (existsSync(path) && !lstatSync(path).isFile()) throw new Error("not regular");
    renameSync(temporary, path);
  } catch {
    throw new SetupError("save", "No pude guardar .env. Cerrá otros publicadores o editores, revisá los permisos y volvé a intentar.");
  } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { /* sin eco de errores */ } }
    try { unlinkSync(temporary); } catch { /* ya se renombró o nunca se creó */ }
  }
}

function page(username, path, nonce, message = "", success = false) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectar Instagram · proyecto</title>
<style>body{font:17px/1.5 system-ui,sans-serif;background:#f5f5ef;color:#15332d;max-width:560px;margin:8vh auto;padding:24px}h1{line-height:1.15}label{display:block;margin-top:24px}input{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #777;border-radius:6px}button{margin-top:16px;background:#15332d;color:white;border:0;border-radius:6px;padding:12px 20px;font:inherit}small{display:block;margin-top:20px}.resultado{padding:14px;background:#def4e8;border-radius:6px}a{color:inherit}</style>
<h1>${success ? "Instagram conectado" : "Conectar Instagram"}</h1><p>Cuenta del proyecto: <strong>@${escapeHtml(username)}</strong></p>
${message ? `<p class="resultado" role="status">${escapeHtml(message)}</p>` : ""}
${success ? "<p>Podés cerrar esta pestaña. El asistente local terminó.</p>" : `<p>Pegá el token que generaste en el panel oficial de Meta. El asistente verifica la cuenta antes de guardarlo.</p>
<form method="post" action="${escapeHtml(path)}" autocomplete="off"><input type="hidden" name="nonce" value="${escapeHtml(nonce)}"><label for="token">Token de Instagram</label><input id="token" name="token" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" maxlength="4098" required><button type="submit">Verificar y guardar en esta PC</button></form>
<small>El token se envía únicamente a Instagram para verificarlo y se guarda en el archivo .env de esta PC, fuera de Git. No lo pegues en el chat. Este asistente no publica contenido. El enlace vence a los 10 minutos.</small>`}</html>`;
}

function respond(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type, "Cache-Control": "no-store", Pragma: "no-cache",
    // no-referrer también vuelve Origin:null en formularios POST de Chrome.
    // same-origin conserva Origin para el formulario local y no envía referencias a otros sitios.
    "Referrer-Policy": "same-origin", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    Connection: "close",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0, data = "", rejected = false;
    const fail = () => { if (!rejected) { rejected = true; reject(new SetupError("body", "Formulario demasiado grande.")); } };
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY) { data = ""; fail(); }
      else if (!rejected) data += chunk;
    });
    req.on("end", () => { if (!rejected) resolveBody(data); });
    req.on("error", () => { if (!rejected) { rejected = true; reject(new SetupError("body", "No pude leer el formulario.")); } });
    req.on("aborted", () => { if (!rejected) { rejected = true; reject(new SetupError("body", "El formulario se interrumpió.")); } });
  });
}

// root/fetchImpl son puntos de inyección para pruebas. La CLI no admite opciones ni variables para cambiarlos.
export async function createSetupServer({ root = ROOT, fetchImpl = globalThis.fetch, lifetimeMs = LIFETIME } = {}) {
  const username = expectedUsername(root);
  const nonce = randomBytes(32).toString("base64url");
  const path = `/conectar/${nonce}`;
  let origin, host, busy = false, finished = false, timer;
  let resolveDone;
  const done = new Promise((resolveValue) => { resolveDone = resolveValue; });
  const server = http.createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    try {
      if (finished || req.headers.host !== host || req.url !== path || req.socket.remoteAddress !== "127.0.0.1") {
        respond(res, 403, "Enlace local inválido.", "text/plain; charset=utf-8"); return;
      }
      if (req.method === "GET") { respond(res, 200, page(username, path, nonce)); return; }
      if (req.method !== "POST") { respond(res, 405, "Método no permitido.", "text/plain; charset=utf-8"); return; }
      if (req.headers.origin !== origin) { respond(res, 403, "Origen del formulario inválido.", "text/plain; charset=utf-8"); return; }
      if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(req.headers["content-type"] ?? "")) {
        respond(res, 415, "Formato del formulario inválido.", "text/plain; charset=utf-8"); return;
      }
      if (Number(req.headers["content-length"]) > MAX_BODY) { respond(res, 413, "Formulario demasiado grande.", "text/plain; charset=utf-8"); return; }
      const form = new URLSearchParams(await readBody(req));
      if (form.getAll("nonce").length !== 1 || !equal(form.get("nonce"), nonce)) {
        respond(res, 403, "Formulario vencido o inválido.", "text/plain; charset=utf-8"); return;
      }
      if (form.getAll("token").length !== 1 || [...form.keys()].some((key) => !["nonce", "token"].includes(key))) {
        respond(res, 400, "Formulario inválido.", "text/plain; charset=utf-8"); return;
      }
      if (busy) { respond(res, 409, "Ya estoy verificando un token. Esperá el resultado.", "text/plain; charset=utf-8"); return; }
      busy = true;
      try {
        const token = form.get("token").trim();
        await verifyInstagramToken(token, username, fetchImpl);
        if (finished) { respond(res, 410, "El asistente venció. Abrilo de nuevo.", "text/plain; charset=utf-8"); return; }
        updateEnvAtomically(root, token);
        respond(res, 200, page(username, path, nonce, "Cuenta verificada. Guardé el token únicamente en .env; las otras líneas siguen iguales.", true));
        close("connected");
      } catch (error) {
        const status = error instanceof SetupError && error.code === "account" ? 422 : error instanceof SetupError && error.code === "token" ? 400 : 502;
        const message = error instanceof SetupError ? error.message : "No pude completar la conexión. Volvé a intentar.";
        respond(res, status, page(username, path, nonce, message));
      } finally { busy = false; }
    } catch {
      if (!res.headersSent) respond(res, 413, "No pude leer el formulario o excede el tamaño permitido.", "text/plain; charset=utf-8");
      else res.end();
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  function close(reason = "closed") {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    server.close();
    server.closeIdleConnections();
    resolveDone(reason);
  }
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  host = `127.0.0.1:${server.address().port}`;
  origin = `http://${host}`;
  timer = setTimeout(() => close("expired"), lifetimeMs);
  timer.unref();
  return { url: `${origin}${path}`, server, done, close };
}

async function main() {
  if (process.argv.length > 2) throw new SetupError("arguments", "Este asistente no acepta opciones. Usá: node herramientas/conectar-instagram.mjs");
  if (Number(process.versions.node.split(".")[0]) < 22) throw new SetupError("node", "Instalá Node.js 22 o posterior.");
  const setup = await createSetupServer();
  process.stdout.write(`Abrí este enlace local para conectar Instagram (vence en 10 minutos):\n${setup.url}\nNo pegues el token en el chat.\n`);
  // Solo la CLI abre el enlace creado por este servidor. Nunca se acepta una URL del usuario.
  // Si el navegador no abre, el enlace de la terminal permite continuar igualmente.
  if (process.platform === "win32") {
    try {
      const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", setup.url], { stdio: "ignore", windowsHide: true });
      browser.on("error", () => {});
      browser.unref();
    } catch { /* el enlace de la terminal es el respaldo */ }
  }
  const stop = () => setup.close();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  const result = await setup.done;
  process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  process.stdout.write(result === "connected" ? "Instagram conectado. .env guardado localmente.\n" : "Asistente cerrado.\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof SetupError ? error.message : "No pude abrir el asistente local. Revisá la carpeta y los permisos."}\n`);
    process.exitCode = 1;
  });
}
