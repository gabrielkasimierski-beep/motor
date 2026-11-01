// De dónde baja Instagram las imágenes: Meta no recibe el archivo, lo va a buscar a una URL pública.
//   estrategia "url"      → config.json medios.baseUrl + la ruta dentro de publicar/ (antes se baja y se
//                           compara con la copia local: tiene que ser la misma imagen).
//   estrategia "facebook" → atajo: subir la foto SIN publicar a la página y usar la URL que devuelve Meta.
//                           Las fotos sin publicar quedan en un estado temporal ~24 h y después Meta las borra.
import { join, relative, resolve, isAbsolute, sep, basename } from "node:path";
import { readFileSync, openSync, readSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
import { Falla } from "./entorno.mjs";

// Nada de Google Drive (en esta compu es la cuenta del trabajo de la persona responsable): ningún *.google.com
// (drive., docs., drive.usercontent.…), googleusercontent.com ni la API de Drive en googleapis.com.
const PROHIBIDOS = /(^|\.)(google\.com|googleusercontent\.com)$/i;
export function esDeDrive(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  // "drive.google.com." (con punto al final) es el mismo servidor: el punto no lo salva.
  const host = u.hostname.replace(/\.+$/, "");
  return PROHIBIDOS.test(host) || (/(^|\.)googleapis\.com$/i.test(host) && /\/drive\//i.test(u.pathname));
}

export function revisarBaseUrl(base) {
  if (!base) return null;
  let u;
  try { u = new URL(base); } catch { throw new Falla(`config.json → medios.baseUrl no es una dirección válida: "${base}"`); }
  if (esDeDrive(base)) throw new Falla("medios.baseUrl apunta a Google (Drive): nunca el Drive (y menos el del trabajo). Usá la web de proyecto o un repositorio público");
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new Falla("medios.baseUrl tiene que empezar con https:// (Meta baja las imágenes de ahí)");
  return base.replace(/\/+$/, "");
}

// La URL pública de un archivo que vive dentro de publicar/ (null si no hay baseUrl o si está afuera).
export function urlPublica(entorno, archivo) {
  const base = revisarBaseUrl(entorno.config.medios?.baseUrl || "");
  if (!base) return null;
  const rel = relative(join(entorno.raiz, "publicar"), resolve(archivo));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return base + "/" + rel.split(sep).map(encodeURIComponent).join("/");
}

// Comprueba que la URL devuelva la imagen sola (200 e image/jpeg) y que sea byte a byte la copia local:
// Instagram baja la de la web y Facebook sube la local, así que tienen que ser la misma. Sin token: es
// nuestro servidor, no Meta. Las imágenes pesan hasta 8 MB y se bajan una sola vez, solo con --de-verdad.
// video: true para el video de un reel o una historia (modo Instagram: va por video_url). Se compara
// con una huella (sha256) mientras se baja, sin cargar el video entero en memoria (hasta 300 MB).
export async function comprobarUrl(url, archivoLocal, { video = false } = {}) {
  let r;
  let web = null;
  let huellaWeb = null;
  let bytesWeb = 0;
  try {
    r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(video ? 15 * 60_000 : 60_000), headers: { "Cache-Control": "no-cache" } });
    if (video) {
      const h = createHash("sha256");
      if (r.body) for await (const trozo of r.body) { h.update(trozo); bytesWeb += trozo.length; }
      huellaWeb = h.digest("hex");
    } else {
      web = Buffer.from(await r.arrayBuffer());
    }
  } catch (e) {
    throw new Falla(`no pude abrir ${url} (${e?.cause?.code || e.message}): ¿subiste el contenido de publicar/ al lugar de medios.baseUrl?`);
  }
  // Si el servidor redirige, lo que importa es adónde termina: tampoco puede ser Drive.
  if (r.url && esDeDrive(r.url)) throw new Falla(`${url} redirige a Google Drive (${new URL(r.url).hostname}): nunca el Drive. Subí el contenido de publicar/ a la web de proyecto o a un repositorio público`);
  const tipo = (r.headers.get("content-type") || "").toLowerCase();
  if (r.status !== 200) throw new Falla(`${url} devuelve ${r.status} (tiene que devolver 200): ¿subiste el contenido de publicar/?`);
  if (video) {
    if (!/^video\/(mp4|quicktime)/.test(tipo)) throw new Falla(`${url} devuelve "${tipo || "sin tipo"}" y tiene que ser video/mp4: tiene que abrir el video solo, no una página`);
    const local = huellaArchivo(archivoLocal);
    if (huellaWeb !== local.huella) {
      throw new Falla(`${basename(archivoLocal)} en la web (${url}, ${bytesWeb} bytes) no es igual a la copia local (${local.bytes} bytes): Instagram publicaría el de la web. Subí la última versión de publicar/ y volvé a correr`);
    }
    return;
  }
  if (!tipo.startsWith("image/jpeg")) throw new Falla(`${url} devuelve "${tipo || "sin tipo"}" y tiene que ser image/jpeg: tiene que abrir la imagen sola, no una página`);
  const local = readFileSync(archivoLocal);
  if (!web.equals(local)) {
    throw new Falla(`${basename(archivoLocal)} en la web (${url}, ${web.length} bytes) no es igual a la copia local (${local.length} bytes): Instagram publicaría la de la web y Facebook la local. Subí la última versión de publicar/ y volvé a correr`);
  }
}

function huellaArchivo(ruta) {
  const h = createHash("sha256");
  const trozo = Buffer.alloc(1 << 20);
  const fd = openSync(ruta, "r");
  let bytes = 0;
  try {
    let n;
    while ((n = readSync(fd, trozo, 0, trozo.length, null)) > 0) { h.update(trozo.subarray(0, n)); bytes += n; }
  } finally {
    closeSync(fd);
  }
  return { huella: h.digest("hex"), bytes };
}

// Atajo: la foto queda sin publicar en la página y Meta da una URL de su CDN.
export async function subirParaInstagram(cli, pageId, archivo) {
  const foto = await cli.postArchivo(`${pageId}/photos`, { published: false }, archivo, {
    token: "pagina",
    simulado: { id: cli.idFalso("foto-para-ig") },
    nota: "foto SIN publicar, solo para que Instagram la baje: Meta la borra sola en ~24 h",
  });
  const datos = await cli.get(foto.id, { fields: "images" }, {
    token: "pagina",
    simulado: { images: [{ source: `<URL de Meta para ${basename(archivo)}>`, width: 1080, height: 1350 }] },
  });
  const mayor = [...(datos.images || [])].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!mayor?.source) throw new Falla(`Meta no devolvió la URL de la foto ${foto.id} (campo images)`);
  return mayor.source;
}
