// Simulador local de la Graph API de Meta: imita las rutas que usa herramientas/meta.mjs, con
// respuestas y errores realistas, para probar sin tocar ninguna cuenta.
//
// Imita los dos hosts en el mismo puerto, cada uno con su propio nombre (la cabecera Host):
//   http://127.0.0.1:<puerto> → graph.facebook.com (+ rupload), para los tokens de Facebook (TOKEN_PRUEBA, TOKEN_PAGINA)
//   http://localhost:<puerto> → graph.instagram.com, para los de Instagram (TOKEN_IG y los de /refresh_access_token)
// Como Meta de verdad, cada token sirve solo en su host: un token de Instagram que llega por el lado de
// Facebook (o al revés) da 190. Así las pruebas notan si un pedido va al host equivocado.
// (herramientas/meta/entorno.mjs arma esas dos direcciones a partir de META_API_BASE.)
//
//   import { iniciarSimulador } from "./simulador-meta.mjs";
//   const sim = await iniciarSimulador({ ...escenario });   // { url, urlIg, pedidos, estado, cerrar() }
//   META_API_BASE=<sim.url> node herramientas/meta.mjs …
//
// A mano: node pruebas/simulador-meta.mjs [--puerto=8787]   (acepta cualquier token)
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const TOKEN_PRUEBA = "EAAprueba-USUARIO-SISTEMA-secreto-0123456789";
export const TOKEN_PAGINA = "EAApagina-DEMO-secreto-9876543210";
export const PAGE_ID = "1111111111";
export const IG_ID = "17841400000000001";
// Inicio de sesión de Instagram (graph.instagram.com).
// Sin palabras de 8 letras: sanear() tapa cualquier pedazo de 8 caracteres de un token ("INSTAGRAM_TOKEN" quedaría tapado).
export const TOKEN_IG = "IGAAqzW7prueba4Kx9Lm2Vb8Nn3Rt6Yp1Hs5Jd0Fg2Tc7";
export const IG_ID_APP = "26000000000000001"; // el "id" de /me (de la app), que NO es el user_id
const TODOS_IG = ["instagram_business_basic", "instagram_business_content_publish"];
// Los nombres de Facebook Login que usa el código común, traducidos a los de Instagram Login.
const PERMISO_IG = { instagram_basic: "instagram_business_basic", instagram_content_publish: "instagram_business_content_publish" };
const TODOS = ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management", "ads_read"];

class Respuesta {
  constructor(http, cuerpo) { this.http = http; this.cuerpo = cuerpo; }
}
const fallar = (http, code, subcode, message, type = "OAuthException") => {
  throw new Respuesta(http, { error: { message, type, code, ...(subcode ? { error_subcode: subcode } : {}), fbtrace_id: "AsimuladorFbtrace01" } });
};

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    const partes = [];
    req.on("data", (c) => partes.push(c));
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", mal);
  });
}

export async function iniciarSimulador(opciones = {}) {
  const esc = {
    token: TOKEN_PRUEBA,
    tokenPagina: TOKEN_PAGINA,
    pageId: PAGE_ID,
    igId: IG_ID,
    usuario: "cuenta_demo",
    cualquierToken: false,
    tokenInvalido: false, // todo responde 190 / 463 (venció)
    permisosFaltantes: [], // sin instagram_content_publish → POST /media da code 10; sin pages_manage_posts → code 200
    cupoUsado: 0,
    cupoTotal: 50,
    sondeosEnCurso: 1, // consultas de estado que dan IN_PROGRESS antes de FINISHED
    contenedorError: false, // los contenedores terminan en ERROR (2207052: no pudo bajar la imagen)
    ecoToken: false, // los errores repiten el token, para probar que el publicador lo enmascara
    caerseEnPublicar: false, // media_publish publica pero corta la conexión sin contestar (una vez)
    limiteEnPublicar: false, // media_publish responde code 9 / 2207042 (cupo de 24 h agotado)
    carpetaMedios: null, // sirve /medios/… desde esta carpeta (para config.json → medios.baseUrl)
    paginaNombre: "proyecto · Soluciones con IA",
    // ---- fallas a propósito (casos de los revisores) ----
    publicarTarde: false, // el primer media_publish se corta sin publicar y Meta lo procesa recién cuando llega el reintento
    captionSinArroba: false, // la API devuelve el caption sin "@" (usuario que no es administrador de la página)
    estadoReelFalla: false, // después del finish, GET ?fields=status del reel da code 100
    videoStatusTrasFinish: null, // después del finish, el video (reel o historia) queda en este video_status (upload_failed, processing…)
    errorDeProcesamiento: null, // después del finish, GET ?fields=status da el ejemplo de error de la doc con este mensaje
    feedFalla500: false, // el primer POST /feed contesta 500 con una página HTML y no crea el posteo
    feedFalla500ConPost: false, // el primer POST /feed crea el posteo y contesta 500 igual
    contenedorEstado: null, // los contenedores de Instagram quedan en este status_code (EXPIRED…)
    igPideAdsManagement: false, // leer la cuenta de Instagram da el error de "missing the ads_management permission"
    subidaFalla: false, // rupload contesta 400 con debug_info (no con error)
    ecoParcial: false, // los errores de token repiten un pedazo del token (30 caracteres + "...")
    demoraMs: 0, // demora cada respuesta (para que dos corridas se pisen)
    fallarFotoN: 0, // la foto número N que llega a /photos da error (carrusel de Facebook cortado a mitad)
    // ---- graph.instagram.com (inicio de sesión de Instagram) ----
    tokenIg: TOKEN_IG,
    permisosFaltantesIg: [], // sin instagram_business_content_publish → content_publishing_limit, /media y media_publish dan code 10
    tipoCuenta: "BUSINESS", // account_type de /me (la doc: Business o Media_Creator)
    meConData: false, // /me contesta dentro de "data": [ … ] (como el ejemplo de la guía "get started")
    renovarFalla: null, // { code, message }: /refresh_access_token contesta ese error
    expiresIn: 5183944, // segundos del token nuevo (el ejemplo de la doc: ~60 días)
    ecoTrasRenovar: false, // el token recién renovado da error 190 y Meta lo repite entero en el mensaje
    meSinTipo: false, // /me no acepta el campo account_type (code 100): se pide sin él
    userIdNoSirve: false, // /<user_id>/… no existe con este token (la doc se contradice sobre qué id usar)
    renovarRedirige: null, // "<url>": /refresh_access_token contesta 307 a esa dirección (con la misma query, o sea con el token)
    renovarCuerpo: null, // { … }: /refresh_access_token contesta 200 con este cuerpo (por ejemplo, sin access_token)
    igConCaption: false, // graph.instagram.com devuelve el caption (la referencia dice que no; el changelog de jul-2026 da a entender que sí)
    ...opciones,
  };
  const concedidos = TODOS.filter((p) => !esc.permisosFaltantes.includes(p));
  const concedidosIg = TODOS_IG.filter((p) => !esc.permisosFaltantesIg.includes(p));
  const pedidos = [];
  const estado = { contenedores: new Map(), medias: [], fotos: new Map(), posts: [], videos: new Map(), historias: [], n: 0, tokensIg: new Set([esc.tokenIg]), tokensNuevos: [] };
  const nuevoId = () => String(900000000 + ++estado.n);
  let base = "";

  function autorizar(p, esquema) {
    const m = p.auth.match(/^(Bearer|OAuth) (.+)$/);
    if (!m || m[1] !== esquema) fallar(400, 190, null, "An active access token must be used to query information.");
    const tok = m[2];
    if (esc.tokenInvalido) fallar(400, 190, 463, `Error validating access token: Session has expired on Sunday, 18-Oct-26.${esc.ecoToken ? " Token: " + tok : ""}${esc.ecoParcial ? " Malformed access token " + tok.slice(0, 30) + "..." : ""}`);
    if (esc.ecoTrasRenovar && estado.tokensNuevos.includes(tok)) fallar(400, 190, 467, "Invalid OAuth access token: " + tok, "IGApiException");
    const ladoIg = p.lado === "instagram";
    if (esc.cualquierToken) return { tok, esPagina: !ladoIg, ig: ladoIg }; // a mano: cualquier token, el host decide
    // Cada token, solo en su host (como Meta): el de Instagram en graph.instagram.com, los de Facebook en graph.facebook.com.
    if (estado.tokensIg.has(tok)) {
      if (!ladoIg) fallar(400, 190, null, `Invalid OAuth access token - Cannot parse access token (un token de Instagram llegó a graph.facebook.com)${esc.ecoToken ? ": " + tok : ""}`);
      return { tok, esPagina: false, ig: true };
    }
    if (ladoIg) fallar(400, 190, null, `Invalid OAuth access token - Cannot parse access token (un token que no es de Instagram llegó a graph.instagram.com)${esc.ecoToken ? ": " + tok : ""}`, "IGApiException");
    if (tok === esc.token) return { tok, esPagina: false };
    if (tok === esc.tokenPagina) return { tok, esPagina: true };
    fallar(400, 190, 467, `Invalid OAuth access token - Cannot parse access token${esc.ecoToken ? ": " + tok : ""}`);
  }
  const exigir = (permiso, code = 10, ig = false) => {
    if (ig) {
      const nombre = PERMISO_IG[permiso] || permiso;
      if (!concedidosIg.includes(nombre)) fallar(403, 10, null, "(#10) Application does not have permission for this action", "IGApiException");
      return;
    }
    if (!concedidos.includes(permiso)) {
      if (code === 10) fallar(403, 10, null, "(#10) Application does not have permission for this action", "OAuthException");
      fallar(403, 200, null, `(#200) The user hasn't authorized the application to perform this action (${permiso})`, "OAuthException");
    }
  };
  const campos = (obj, fields) => {
    if (!fields) return obj;
    const r = {};
    for (const f of fields.split(",").map((x) => x.trim().replace(/\{.*$/, ""))) if (obj[f] !== undefined) r[f] = obj[f];
    if (obj.id && !r.id) r.id = obj.id;
    return r;
  };
  const enRango = (t, min, max) => {
    const dif = Number(t) - Math.floor(Date.now() / 1000);
    return Number.isFinite(dif) && dif >= min && dif <= max;
  };
  const verdad = (v) => v === true || v === "true";
  const usadas = () => esc.cupoUsado + estado.medias.length;

  function estadoContenedor(c) {
    if (c.publicado) return { status_code: "PUBLISHED" };
    if (esc.contenedorError) return { status_code: "ERROR", status: "Error: Media download has failed. The media URI doesn't meet our requirements. (2207052)" };
    if (esc.contenedorEstado) return { status_code: esc.contenedorEstado };
    if (!c.subido) return { status_code: "IN_PROGRESS" };
    c.consultas++;
    return { status_code: c.consultas <= esc.sondeosEnCurso ? "IN_PROGRESS" : "FINISHED" };
  }

  // ---------- rutas ----------
  async function rutear(p, res) {
    // Medios públicos (lo que sería medios.baseUrl): sin token, como cualquier servidor web.
    if (p.ruta.startsWith("/medios/")) {
      const raiz = esc.carpetaMedios && resolve(esc.carpetaMedios);
      const archivo = raiz && resolve(raiz, "." + decodeURIComponent(p.ruta.slice(7)));
      if (!archivo || !archivo.startsWith(raiz + sep) || !existsSync(archivo)) return new Respuesta(404, { error: "no existe" });
      return { crudo: readFileSync(archivo), tipo: archivo.endsWith(".jpg") ? "image/jpeg" : archivo.endsWith(".mp4") ? "video/mp4" : "application/octet-stream" };
    }

    // Renovación del token de Instagram (graph.instagram.com, sin versión): el token va en la URL,
    // que es la única forma que muestra la doc. Nunca acepta cualquier token (aunque cualquierToken esté
    // en true): solo los de Instagram que conoce, para que una prueba no "renueve" un token inventado.
    if (p.ruta === "/refresh_access_token") {
      if (p.lado !== "instagram") fallar(400, 100, null, "(#100) Unknown path components: /refresh_access_token (es de graph.instagram.com, no de graph.facebook.com)");
      if (p.metodo !== "GET") fallar(400, 100, null, "(#100) Unsupported request method");
      if (p.query.grant_type !== "ig_refresh_token") fallar(400, 100, null, "(#100) grant_type must be ig_refresh_token");
      const tok = String(p.query.access_token || "");
      if (esc.tokenInvalido) fallar(400, 190, 463, `Error validating access token: Session has expired.${esc.ecoToken ? " Token: " + tok : ""}`);
      if (!estado.tokensIg.has(tok)) fallar(400, 190, null, `Invalid OAuth access token - Cannot parse access token${esc.ecoToken ? ": " + tok : ""}`, "IGApiException");
      if (esc.renovarFalla) fallar(400, esc.renovarFalla.code ?? 100, esc.renovarFalla.subcode ?? null, `${esc.renovarFalla.message || "(#100) The access token can not be refreshed"}${esc.ecoToken ? " (token " + tok + ")" : ""}`, "IGApiException");
      if (esc.renovarRedirige) return { redirigir: `${esc.renovarRedirige}?${new URLSearchParams(p.query)}` };
      if (esc.renovarCuerpo) return esc.renovarCuerpo;
      const nuevo = `IGAAnv${estado.tokensNuevos.length + 1}Qz8${Math.random().toString(36).slice(2, 12)}Wk5Tp0Lx3Mh7Gc2`;
      estado.tokensIg.add(nuevo); // el anterior sigue sirviendo hasta que vence (la doc no dice lo contrario)
      estado.tokensNuevos.push(nuevo);
      return { access_token: nuevo, token_type: "bearer", expires_in: esc.expiresIn };
    }

    // Carga reanudable (rupload): Authorization: OAuth, offset y file_size.
    let m = p.ruta.match(/^\/(ig-api-upload|video-upload)\/v\d+\.\d+\/(\w+)$/);
    if (m) {
      if (p.lado === "instagram") fallar(400, 100, null, "(#100) Unsupported post request (la carga reanudable es de rupload.facebook.com)", "IGApiException");
      autorizar(p, "OAuth");
      if (esc.subidaFalla) return new Respuesta(400, { debug_info: { retriable: false, type: "ProcessingFailedError", message: "unauthorized user request" } });
      const destino = m[1] === "ig-api-upload" ? estado.contenedores.get(m[2]) : estado.videos.get(m[2]);
      if (!destino) fallar(400, 100, 33, "Unsupported post request. Object does not exist");
      if (p.cabeceras.offset !== "0") fallar(400, 100, null, "Invalid offset");
      if (Number(p.cabeceras.file_size) !== p.bytes) fallar(400, 100, null, `file_size (${p.cabeceras.file_size}) does not match the uploaded bytes (${p.bytes})`);
      destino.subido = true;
      destino.bytes = p.bytes;
      return m[1] === "ig-api-upload" ? { success: true, message: "Upload successful." } : { success: true };
    }

    m = p.ruta.match(/^\/(v\d+\.\d+)\/(.+)$/);
    if (!m) return new Respuesta(404, { error: { message: "Unknown path", code: 803 } });
    const version = m[1];
    const partes = m[2].split("/");
    const { tok, esPagina, ig = false } = autorizar(p, "Bearer");
    const q = p.query;
    const b = p.cuerpo;
    const [a0, a1] = partes;

    // ---- graph.instagram.com (inicio de sesión de Instagram) ----
    if (ig) {
      // Ese host no tiene páginas de Facebook.
      if (a0 === esc.pageId) fallar(400, 100, 33, `Unsupported ${p.metodo.toLowerCase()} request. Object with ID '${a0}' does not exist, cannot be loaded due to missing permissions, or does not support this operation.`, "IGApiException");
      if (p.metodo === "GET" && a0 === "me" && !a1) {
        exigir("instagram_basic", 10, true);
        if (esc.meSinTipo && String(q.fields || "").includes("account_type")) fallar(400, 100, null, "(#100) Tried accessing nonexisting field (account_type) on node type (User)", "IGApiException");
        const yo = campos({ id: IG_ID_APP, user_id: esc.igId, username: esc.usuario || undefined, account_type: esc.tipoCuenta || undefined }, q.fields);
        return esc.meConData ? { data: [yo] } : yo;
      }
      if (a0 === "me") fallar(400, 100, null, `(#100) Unsupported get request to /me/${a1} on graph.instagram.com (simulador)`, "IGApiException");
      // La carga reanudable es "only for apps that have implemented Facebook Login for Business".
      if (p.metodo === "POST" && a1 === "media" && b.upload_type) fallar(400, 100, null, "(#100) upload_type=resumable is only available with Facebook Login for Business", "IGApiException");
      if (esc.userIdNoSirve && a0 === esc.igId) fallar(400, 100, 33, `Unsupported get request. Object with ID '${a0}' does not exist, cannot be loaded due to missing permissions, or does not support this operation.`, "IGApiException");
      // content_publishing_limit pide instagram_business_basic e instagram_business_content_publish.
      if (a0 === esc.igId && a1 === "content_publishing_limit") exigir("instagram_content_publish", 10, true);
    }

    if (p.metodo === "GET") {
      if (a0 === "me" && !a1) return esPagina ? { id: esc.pageId, name: esc.paginaNombre } : { id: "5550001", name: "publicador-proyecto" };
      if (a0 === "me" && a1 === "permissions") return { data: concedidos.map((permission) => ({ permission, status: "granted" })) };
      if (a0 === "me" && a1 === "accounts") return { data: [{ id: esc.pageId, name: "proyecto · Soluciones con IA" }] };
      if (a0 === "debug_token") {
        if (q.input_token !== tok) fallar(400, 100, null, "(#100) The App_id in the input_token did not match the Viewing App");
        return { data: { app_id: "123456789", type: esPagina ? "PAGE" : "SYSTEM_USER", application: "proyecto Publicador", expires_at: 0, is_valid: true, scopes: concedidos } };
      }
      if (a0 === esc.pageId && !a1) {
        exigir("pages_show_list", 200);
        return campos({ id: esc.pageId, name: esc.paginaNombre, instagram_business_account: { id: esc.igId }, access_token: esc.tokenPagina }, q.fields);
      }
      if (a0 === esc.pageId && (a1 === "feed" || a1 === "scheduled_posts")) {
        return { data: estado.posts.filter((x) => (a1 === "feed" ? !x.programado : x.programado)).map((x) => ({ id: x.id, message: x.message, created_time: x.creado })) };
      }
      if (a0 === esc.pageId && a1 === "stories") return { data: estado.historias };
      if (a0 === esc.igId && !a1) {
        exigir("instagram_basic", 10, ig);
        if (esc.igPideAdsManagement) fallar(403, 200, null, "(#200) The calling app is missing the ads_management permission for the target.");
        return campos({ id: esc.igId, username: esc.usuario }, q.fields);
      }
      if (a0 === esc.igId && a1 === "content_publishing_limit") {
        return { data: [{ quota_usage: usadas(), config: { quota_total: esc.cupoTotal, quota_duration: 86400 } }] };
      }
      if (a0 === esc.igId && (a1 === "media" || a1 === "stories")) {
        const cap = (c) => (esc.captionSinArroba ? String(c).replace(/@/g, "") : c);
        // Con inicio de sesión de Instagram, caption es "Available for Instagram API with Facebook Login only"
        // según la referencia de IG Media (igConCaption: el caso en que Meta igual lo devuelve).
        const sinCaption = ig && !esc.igConCaption;
        return { data: estado.medias.filter((x) => (a1 === "stories") === (x.tipo === "STORIES")).map((x) => ({ id: x.id, caption: sinCaption ? undefined : cap(x.caption), timestamp: x.timestamp, permalink: x.permalink })).reverse() };
      }
      if (estado.contenedores.has(a0)) return { id: a0, ...estadoContenedor(estado.contenedores.get(a0)) };
      const media = estado.medias.find((x) => x.id === a0);
      if (media) return campos({ id: media.id, permalink: media.permalink, caption: ig && !esc.igConCaption ? undefined : media.caption }, q.fields);
      if (estado.fotos.has(a0)) {
        const f = estado.fotos.get(a0);
        return campos({ id: f.id, images: [{ source: `${base}/cdn/${f.id}.jpg`, width: 1080, height: 1350 }, { source: `${base}/cdn/${f.id}_s.jpg`, width: 540, height: 675 }] }, q.fields);
      }
      const post = estado.posts.find((x) => x.id === a0);
      if (post) return campos({ id: post.id, permalink_url: `https://www.facebook.com/${esc.pageId}/posts/${post.id.split("_")[1]}` }, q.fields);
      if (estado.videos.has(a0)) {
        const v = estado.videos.get(a0);
        const terminado = v.publicado || v.programado;
        if (esc.estadoReelFalla && terminado && String(q.fields || "").includes("status")) fallar(400, 100, null, "(#100) Tried accessing nonexisting field (status) on node type (Video)");
        const forzado = terminado ? esc.videoStatusTrasFinish : null;
        // El ejemplo de error de procesamiento de la doc (Reels Publishing y Page Stories):
        // video_status "processing" y la fase en "not_started" con error.message.
        if (terminado && esc.errorDeProcesamiento) {
          return campos({
            id: a0,
            status: {
              video_status: "processing",
              uploading_phase: { status: "complete", bytes_transfered: v.bytes || 0 },
              processing_phase: { status: "not_started", error: { message: esc.errorDeProcesamiento } },
              publishing_phase: { status: "not_started", publish_status: "not_published" },
            },
          }, q.fields);
        }
        return campos({
          id: a0,
          permalink_url: `/reel/${a0}`,
          status: {
            video_status: forzado || (v.subido ? "ready" : "uploading"),
            uploading_phase: { status: v.subido ? "complete" : "in_progress", bytes_transfered: v.bytes || 0 },
            processing_phase: { status: v.subido ? "complete" : "not_started" },
            publishing_phase: { status: v.publicado && !forzado ? "complete" : "not_started", publish_status: forzado ? "not_published" : v.programado ? "scheduled" : v.publicado ? "published" : "not_published" },
          },
        }, q.fields);
      }
      fallar(400, 100, 33, `Unsupported get request. Object with ID '${a0}' does not exist, cannot be loaded due to missing permissions, or does not support this operation.`, "GraphMethodException");
    }

    if (p.metodo === "POST") {
      // ---- Instagram ----
      if (a0 === esc.igId && a1 === "media") {
        exigir("instagram_content_publish", 10, ig);
        const tipo = b.media_type || (b.is_carousel_item ? "HIJO" : "IMAGE");
        if (verdad(b.is_carousel_item) && b.caption) fallar(400, 100, null, "(#100) Caption is not supported on carousel items");
        // Guía de publicación: "Setting this parameter on carousel children will result in an error".
        if (verdad(b.is_carousel_item) && b.is_ai_generated !== undefined) fallar(400, 100, null, "(#100) is_ai_generated is not available for carousel children");
        // Referencia de IG User media: caption es "for the image, video, or carousel" (las historias no lo llevan).
        if (tipo === "STORIES" && b.caption !== undefined) fallar(400, 100, null, "(#100) Caption is not supported on stories");
        if (tipo === "CAROUSEL") {
          const hijos = String(b.children || "").split(",").filter(Boolean);
          // Tabla de errores de Instagram, 2207028: "Carousels need at least 2 photos/videos and no more than 10".
          if (hijos.length < 2 || hijos.length > 10) fallar(400, 100, 2207028, "Your post won't work as a carousel. Carousels need at least 2 photos/videos and no more than 10 photos/videos.");
          for (const h of hijos) if (!estado.contenedores.get(h)?.params.is_carousel_item) fallar(400, 24, 2207006, `The media with ${h} cannot be found`);
        } else if (b.upload_type === "resumable") {
          if (!["REELS", "STORIES", "VIDEO"].includes(tipo)) fallar(400, 100, null, "(#100) upload_type=resumable is only for video");
        } else if (!b.image_url && !b.video_url) fallar(400, 100, null, "(#100) The parameter image_url is required");
        const id = nuevoId();
        estado.contenedores.set(id, { id, tipo, params: b, consultas: 0, subido: b.upload_type !== "resumable", publicado: false, ig });
        return b.upload_type === "resumable" ? { id, uri: `${base}/ig-api-upload/${version}/${id}` } : { id };
      }
      if (a0 === esc.igId && a1 === "media_publish") {
        exigir("instagram_content_publish", 10, ig);
        if (esc.limiteEnPublicar || usadas() >= esc.cupoTotal) fallar(400, 9, 2207042, "You reached maximum number of posts that is allowed to be published by Content Publishing API.", "OAuthException");
        const c = estado.contenedores.get(String(b.creation_id));
        if (!c) fallar(400, 24, 2207008, `The media builder with creation id = ${b.creation_id} does not exist or has been expired.`);
        const publicarC = (cont) => {
          const id = nuevoId();
          cont.publicado = true;
          estado.medias.push({ id, tipo: cont.tipo, caption: cont.params.caption || "", timestamp: new Date().toISOString(), permalink: cont.tipo === "STORIES" ? `https://www.instagram.com/stories/${esc.usuario}/${id}/` : `https://www.instagram.com/p/SIM${id}/`, contenedor: cont.id });
          return id;
        };
        // El pedido cortado que Meta procesa tarde: sale justo antes de atender el reintento.
        if (estado.retenido) { publicarC(estado.retenido); estado.retenido = null; }
        if (c.publicado) fallar(400, 100, null, "(#100) This media has already been published");
        if (esc.contenedorError || !c.subido || c.consultas <= esc.sondeosEnCurso) fallar(400, 9007, 2207027, "The media is not ready for publishing, please wait for a moment");
        if (esc.publicarTarde) { esc.publicarTarde = false; estado.retenido = c; res.socket.destroy(); return null; }
        const id = publicarC(c);
        if (esc.caerseEnPublicar) { esc.caerseEnPublicar = false; res.socket.destroy(); return null; }
        return { id };
      }

      // ---- Facebook (siempre con el token de la página) ----
      if (a0 === esc.pageId) {
        if (!esPagina) fallar(403, 200, null, "(#200) This endpoint requires a Page access token", "OAuthException");
        exigir("pages_manage_posts", 200);
        if (a1 === "photos") {
          if (!p.archivo && !b.url) fallar(400, 324, null, "(#324) Requires upload file");
          estado.fotosRecibidas = (estado.fotosRecibidas || 0) + 1;
          if (esc.fallarFotoN && estado.fotosRecibidas === esc.fallarFotoN) fallar(400, 324, null, "(#324) Missing or invalid image file");
          const publicada = !(b.published === "false");
          if (b.scheduled_publish_time) {
            if (publicada) fallar(400, 100, null, "(#100) Scheduled posts must be unpublished (published=false)");
            // Referencia de Page photos: published, scheduled_publish_time y unpublished_content_type van los tres.
            if (b.unpublished_content_type !== "SCHEDULED") fallar(400, 100, null, "(#100) unpublished_content_type=SCHEDULED is required for scheduled posts");
            if (!enRango(b.scheduled_publish_time, 600, 30 * 86400)) fallar(400, 100, null, "(#100) The specified scheduled publish time is invalid.");
          }
          const id = nuevoId();
          estado.fotos.set(id, { id, publicada, temporary: verdad(b.temporary), caption: b.caption, bytes: p.archivo?.bytes });
          if (publicada || b.scheduled_publish_time) {
            const post = { id: `${esc.pageId}_${nuevoId()}`, message: b.caption || "", creado: new Date().toISOString(), programado: Boolean(b.scheduled_publish_time), fotos: [id] };
            estado.posts.push(post);
            return { id, post_id: post.id };
          }
          return { id };
        }
        if (a1 === "feed") {
          if (!b.message && !b.link) fallar(400, 100, null, "(#100) Missing message or attachment");
          const adjuntos = (b.attached_media || []).map((x) => x.media_fbid);
          for (const f of adjuntos) if (!estado.fotos.get(f) || estado.fotos.get(f).publicada) fallar(400, 100, null, `(#100) Invalid media_fbid ${f}`);
          const programado = b.scheduled_publish_time !== undefined;
          if (programado) {
            if (b.published !== false && b.published !== "false") fallar(400, 100, null, "(#100) Scheduled posts must be unpublished (published=false)");
            if (b.unpublished_content_type !== "SCHEDULED") fallar(400, 100, null, "(#100) unpublished_content_type=SCHEDULED is required for scheduled posts");
            if (!enRango(b.scheduled_publish_time, 600, 30 * 86400)) fallar(400, 100, null, "(#100) The specified scheduled publish time is invalid.");
            for (const f of adjuntos) if (!estado.fotos.get(f).temporary) fallar(400, 100, null, "(#100) Photos in a scheduled post must be uploaded with temporary=true");
          }
          // Un 500 con una página HTML (sin JSON): Meta no dice si lo creó.
          const html = { crudo: Buffer.from("<html><body>Sorry, something went wrong.</body></html>"), tipo: "text/html", http: 500 };
          if (esc.feedFalla500) { esc.feedFalla500 = false; return html; }
          const post = { id: `${esc.pageId}_${nuevoId()}`, message: b.message, creado: new Date().toISOString(), programado, fotos: adjuntos, scheduled_publish_time: b.scheduled_publish_time };
          estado.posts.push(post);
          if (esc.feedFalla500ConPost) { esc.feedFalla500ConPost = false; return html; }
          return { id: post.id };
        }
        if (a1 === "video_reels" || a1 === "video_stories") {
          if (b.upload_phase === "start") {
            const id = nuevoId();
            estado.videos.set(id, { id, tipo: a1, subido: false, publicado: false });
            return { video_id: id, upload_url: `${base}/video-upload/${version}/${id}` };
          }
          if (b.upload_phase === "finish") {
            const v = estado.videos.get(String(b.video_id));
            if (!v || v.tipo !== a1) fallar(400, 100, null, "(#100) Invalid video_id");
            if (!v.subido) fallar(400, 6000, null, "There was a problem uploading your video file. Please try again.");
            if (b.video_state === "SCHEDULED" && !enRango(b.scheduled_publish_time, 600, 29 * 86400)) fallar(400, 100, null, "(#100) The specified scheduled publish time is invalid.");
            v.publicado = b.video_state !== "SCHEDULED";
            v.programado = b.video_state === "SCHEDULED";
            v.description = b.description;
            if (a1 === "video_stories") {
              const post_id = nuevoId();
              estado.historias.push({ post_id, status: "PUBLISHED", creation_time: String(Math.floor(Date.now() / 1000)), media_type: "video", media_id: v.id });
              return { success: true, post_id };
            }
            return { success: true };
          }
          fallar(400, 100, null, "(#100) upload_phase must be start or finish");
        }
        if (a1 === "photo_stories") {
          const f = estado.fotos.get(String(b.photo_id));
          if (!f || f.publicada) fallar(400, 100, null, "(#100) Invalid photo_id: it must be an unpublished photo");
          const post_id = nuevoId();
          estado.historias.push({ post_id, status: "PUBLISHED", creation_time: String(Math.floor(Date.now() / 1000)), media_type: "photo", media_id: f.id });
          return { success: true, post_id };
        }
      }
    }
    fallar(400, 100, null, `(#100) Unsupported ${p.metodo.toLowerCase()} request to ${p.ruta}`, "GraphMethodException");
  }

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, base || "http://127.0.0.1");
    const crudo = await leerCuerpo(req);
    const tipo = req.headers["content-type"] || "";
    const p = {
      metodo: req.method,
      ruta: url.pathname,
      query: Object.fromEntries(url.searchParams),
      cuerpo: {},
      archivo: null,
      auth: req.headers.authorization || "",
      cabeceras: { offset: req.headers.offset, file_size: req.headers.file_size },
      bytes: crudo.length,
      // Por qué nombre llegó: localhost hace de graph.instagram.com; 127.0.0.1, de graph.facebook.com (y rupload).
      host: req.headers.host || "",
      lado: /^localhost(:\d+)?$/i.test(req.headers.host || "") ? "instagram" : "facebook",
    };
    try {
      if (tipo.startsWith("application/json")) p.cuerpo = JSON.parse(crudo.toString("utf8") || "{}");
      else if (tipo.startsWith("multipart/form-data")) {
        const datos = await new Response(crudo, { headers: { "content-type": tipo } }).formData();
        for (const [k, v] of datos) {
          if (typeof v === "string") p.cuerpo[k] = v;
          else p.archivo = { campo: k, nombre: v.name, bytes: v.size, tipo: v.type };
        }
      } else if (tipo.startsWith("application/x-www-form-urlencoded")) p.cuerpo = Object.fromEntries(new URLSearchParams(crudo.toString("utf8")));
    } catch {
      p.cuerpo = { ilegible: true };
    }
    pedidos.push(p);
    if (esc.demoraMs) await new Promise((ok) => setTimeout(ok, esc.demoraMs));
    let r;
    try {
      r = await rutear(p, res);
    } catch (e) {
      r = e instanceof Respuesta ? e : new Respuesta(500, { error: { message: String(e?.message || e), code: 1 } });
    }
    if (r === null) return; // conexión cortada a propósito
    if (r.redirigir) {
      res.writeHead(307, { Location: r.redirigir });
      return res.end();
    }
    if (r.crudo) {
      res.writeHead(r.http || 200, { "Content-Type": r.tipo, "Content-Length": r.crudo.length });
      return res.end(req.method === "HEAD" ? undefined : r.crudo);
    }
    const http = r instanceof Respuesta ? r.http : 200;
    const cuerpo = r instanceof Respuesta ? r.cuerpo : r;
    res.writeHead(http, { "Content-Type": "application/json; charset=UTF-8" });
    res.end(JSON.stringify(cuerpo));
  });

  await new Promise((ok) => servidor.listen(esc.puerto || 0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    url: base,
    urlIg: `http://localhost:${servidor.address().port}`, // el "graph.instagram.com" del simulador
    puerto: servidor.address().port,
    pedidos,
    estado,
    escenario: esc,
    // Los pedidos a Meta (sin contar los HEAD/GET a /medios, que son "nuestro servidor").
    pedidosAMeta: () => pedidos.filter((x) => !x.ruta.startsWith("/medios/")),
    cerrar: () => new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(() => ok()); }),
  };
}

// A mano: levanta el simulador y deja la URL para META_API_BASE.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const puerto = Number((process.argv.find((a) => a.startsWith("--puerto=")) || "").slice(9)) || 8787;
  const sim = await iniciarSimulador({ puerto, cualquierToken: true, sondeosEnCurso: 1 });
  console.log(`Simulador de Meta escuchando en ${sim.url} (acepta cualquier token; Ctrl+C para cortar).`);
  console.log(`Probalo con: META_API_BASE=${sim.url} META_RAIZ=<copia de la carpeta> node herramientas/meta.mjs publicar … --de-verdad`);
  console.log(`Ojo: con cualquier token, la página es ${PAGE_ID} y el Instagram ${IG_ID} (@cuenta_demo): poné META_PAGE_ID=${PAGE_ID} en el .env de la copia y "paginaFacebook": "${PAGE_ID}" en su config.json.`);
}
