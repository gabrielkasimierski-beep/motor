// Armado común de las pruebas del publicador de Meta: una copia mínima del proyecto en una carpeta
// temporal (META_RAIZ), archivos JPEG y MP4 de mentira, y el comando corriendo contra el simulador.
// Ningún token puede salir: ni entero ni un pedazo de 8 caracteres, ni por pantalla ni en un archivo.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKEN_PRUEBA, TOKEN_PAGINA, TOKEN_IG, PAGE_ID } from "./simulador-meta.mjs";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CLI = join(RAIZ, "herramientas", "meta.mjs");
export const TANDA = "2099-01-prueba";
export const TEXTO = "Mismo laburo. Mucho menos lío.\nSoluciones con IA para negocios.\n\nEscribinos. #pymes #automatizacion";
const temporales = [];
export const limpiarTemporales = () => { for (const t of temporales) rmSync(t, { recursive: true, force: true }); };
// Archivos que llevan el token a propósito (para probar que se rechazan): la revisión los saltea.
export const conTokenAProposito = new Set();

export function jpeg(ancho, alto, relleno = 3000) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, alto >> 8, alto & 255, ancho >> 8, ancho & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  const sos = [0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00];
  return Buffer.concat([Buffer.from([0xff, 0xd8, ...app0, ...sof0, ...sos]), Buffer.alloc(relleno, 0x55), Buffer.from([0xff, 0xd9])]);
}

// medidas: { ancho, alto } → agrega una pista de video (trak → tkhd) con esas medidas.
export function mp4(segundos, relleno = 40_000, medidas = null) {
  const caja = (tipo, cuerpo) => { const c = Buffer.alloc(8); c.writeUInt32BE(8 + cuerpo.length); c.write(tipo, 4, "latin1"); return Buffer.concat([c, cuerpo]); };
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12); // escala
  mvhd.writeUInt32BE(Math.round(segundos * 1000), 16); // duración
  const partes = [caja("mvhd", mvhd)];
  if (medidas) {
    const tkhd = Buffer.alloc(84);
    tkhd.writeUInt32BE(medidas.ancho * 65536, 76);
    tkhd.writeUInt32BE(medidas.alto * 65536, 80);
    partes.push(caja("trak", caja("tkhd", tkhd)));
  }
  return Buffer.concat([caja("ftyp", Buffer.from("isom\0\0\x02\0isommp41", "latin1")), caja("moov", Buffer.concat(partes)), caja("mdat", Buffer.alloc(relleno, 7))]);
}

// El .env de cada modo: "facebook" (META_ACCESS_TOKEN, el de antes), "instagram" (INSTAGRAM_TOKEN) o "mixto" (los dos).
// Con comentarios y saltos \r\n, como uno escrito en el Bloc de notas (la renovación no los puede tocar).
export function envDe(modo, { token = TOKEN_PRUEBA, tokenIg = TOKEN_IG } = {}) {
  if (modo === "instagram") return `# prueba (modo Instagram)\r\nMETA_ACCESS_TOKEN=\r\n\r\n# Token de Instagram (inicio de sesión de Instagram)\r\nINSTAGRAM_TOKEN=${tokenIg}\r\nMETA_PAGE_ID=\r\nMETA_GRAPH_VERSION=v26.0\r\n`;
  if (modo === "mixto") return `# prueba (los dos)\nMETA_ACCESS_TOKEN=${token}\nINSTAGRAM_TOKEN=${tokenIg}\nMETA_PAGE_ID=${PAGE_ID}\nMETA_GRAPH_VERSION=v26.0\n`;
  return `# prueba\nMETA_ACCESS_TOKEN=${token}\nMETA_PAGE_ID=${PAGE_ID}\nMETA_GRAPH_VERSION=v26.0\n`;
}

// piezas: [{ id, laminas, estado, ancho, alto, texto, clave }]; historias: [{ id, estado }]; reels: [{ id, estado }]
export function crearProyecto(sim, { piezas = [], historias = [], reels = [], conBase = true, usuario = "cuenta_demo", pagina = PAGE_ID, token = TOKEN_PRUEBA, modo = "facebook" } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "meta-prueba-"));
  temporales.push(raiz);
  writeFileSync(join(raiz, "config.json"), JSON.stringify({
    redes: ["instagram", "facebook"],
    zonaHoraria: "America/Argentina/Buenos_Aires",
    meta: { usuarioInstagram: usuario, paginaFacebook: pagina },
    medios: { baseUrl: conBase ? `${sim.url}/medios` : "" },
  }, null, 2));
  writeFileSync(join(raiz, ".env"), envDe(modo, { token }));
  const filas = piezas.map((p, i) => `| ${i + 1} | {completar} | ${p.id.toUpperCase()} · Prueba | servicio | ${p.clave || "—"} | ${p.estado || "aprobado"} | \`salidas/${TANDA}/${p.id}/\` |`);
  const filasH = historias.map((h, i) => `| ${i + 1} | \`perfil/${h.id}.png\` + compartir el post 01 | ${h.estado || "aprobado"} |`);
  const filasR = reels.map((r, i) => `| ${i + 1} | \`guiones/${r.id}.md\` (grabar) | ${r.estado || "aprobado"} |`);
  writeFileSync(join(raiz, "calendario.md"), [
    "# Calendario", "",
    "| Día | Fecha | Pieza | Pilar | Palabra clave | Estado | Carpeta |",
    "|---|---|---|---|---|---|---|",
    ...filas, "",
    "## Historias (lunes a viernes)",
    "| Día | Historia | Estado |",
    "|---|---|---|",
    ...filasH, "",
    "## Reels",
    "| Semana | Guion | Estado |",
    "|---|---|---|",
    ...filasR, "",
  ].join("\n"));
  writeFileSync(join(raiz, "registro.md"), [
    "# Registro", "",
    "| Fecha | Pieza | Red | Link | Alcance | Guardados | Compartidos | Mensajes | Palabra clave | Notas |",
    "|---|---|---|---|---|---|---|---|---|---|", "",
    "## Gastos", "| Fecha | Qué | Cuánto | Aprobó |", "|---|---|---|---|", "",
  ].join("\n"));
  for (const p of piezas) {
    const carpeta = join(raiz, "publicar", TANDA, p.id);
    mkdirSync(carpeta, { recursive: true });
    if (!p.laminas) continue;
    const laminas = [];
    for (let i = 1; i <= p.laminas; i++) {
      const archivo = String(i).padStart(2, "0") + ".jpg";
      writeFileSync(join(carpeta, archivo), jpeg(p.ancho || 1080, p.alto || 1350, 3000 + i));
      laminas.push({ orden: i, archivo, url: null });
    }
    writeFileSync(join(carpeta, "publicacion.json"), JSON.stringify({ tanda: TANDA, id: p.id, formato: p.laminas > 1 ? "carrusel" : "imagen", redes: ["instagram", "facebook"], texto: p.texto ?? TEXTO, laminas }, null, 2));
  }
  for (const x of [...historias, ...reels]) mkdirSync(join(raiz, "publicar", TANDA, x.id), { recursive: true });
  sim.escenario.carpetaMedios = join(raiz, "publicar");
  return raiz;
}

// Un archivo dentro de la carpeta de la pieza (lo único que acepta --de-verdad).
export function enPieza(raiz, id, nombre, contenido) {
  const ruta = join(raiz, "publicar", TANDA, id, nombre);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
  return ruta;
}

const pedazos = (s) => Array.from({ length: s.length - 7 }, (_, i) => s.slice(i, i + 8));
// Todos los tokens que existen en las pruebas: los de Facebook, el de Instagram y los que salieron de
// una renovación en el simulador.
const tokensDe = (sim) => [TOKEN_PRUEBA, TOKEN_PAGINA, TOKEN_IG, ...(sim?.estado?.tokensNuevos || [])];
export function sinToken(texto, donde, tokens = tokensDe(null)) {
  for (const s of tokens) {
    const visto = pedazos(s).find((p) => texto.includes(p));
    assert.ok(!visto, `un pedazo del token ("${visto}") apareció en ${donde}:\n${texto}`);
  }
}

// extra: variables de entorno de más (undefined borra una, por ejemplo META_RAIZ).
// cli / nodeArgs: otro meta.mjs (una copia del código en una carpeta temporal) y opciones para node.
export function correr(raiz, sim, args, extra = {}, { cli = CLI, nodeArgs = [], cwd = RAIZ } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("META_") && k !== "INSTAGRAM_TOKEN"));
  Object.assign(env, { META_RAIZ: raiz, META_API_BASE: sim?.url, META_SONDEO_MS: "5", META_REINTENTO_MS: "5" }, extra);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [...nodeArgs, cli, ...args], { cwd, env });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("close", (codigo) => ok({ codigo, salida, error, todo: salida + error }));
  }).then((r) => {
    // Regla de oro: ningún token sale, ni por pantalla ni en un archivo.
    sinToken(r.todo, "la salida", tokensDe(sim));
    revisarArchivos(raiz, tokensDe(sim));
    return r;
  });
}

export function revisarArchivos(carpeta, tokens = tokensDe(null)) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) { revisarArchivos(ruta, tokens); continue; }
    if (nombre === ".env" || conTokenAProposito.has(ruta)) continue; // el único lugar donde puede estar
    sinToken(readFileSync(ruta, "latin1"), ruta, tokens);
  }
}

export const args = (id, red, ...mas) => ["publicar", `--tanda=${TANDA}`, `--id=${id}`, `--red=${red}`, ...mas];
export const posts = (sim, sufijo) => sim.pedidosAMeta().filter((p) => p.metodo === "POST" && p.ruta.endsWith(sufijo));
export const leer = (raiz, ...r) => readFileSync(join(raiz, ...r), "utf8");
export const registro = (raiz) => (existsSync(join(raiz, "registro-meta", "publicaciones.json")) ? JSON.parse(leer(raiz, "registro-meta", "publicaciones.json")).publicaciones : []);
export function horaBA(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
