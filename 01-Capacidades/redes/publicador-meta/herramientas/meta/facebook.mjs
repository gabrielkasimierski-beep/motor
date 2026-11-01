// Publicar en la página de Facebook de proyecto (Pages API, graph.facebook.com, token de la página).
//   una foto     = POST /{page}/photos con el archivo (multipart) y caption
//   varias fotos = cada una a /photos sin publicar + POST /{page}/feed con attached_media y message
//   programado   = published=false + scheduled_publish_time + unpublished_content_type=SCHEDULED
//                  (la referencia de Page photos pide los tres; fotos de un posteo programado: temporary=true)
//   reel         = /video_reels: start → subida a rupload → finish → esperar el estado del video
//   historia     = foto sin publicar + /photo_stories, o /video_stories: start → subida → finish → esperar el estado
import { basename } from "node:path";
import { Falla, decir } from "./entorno.mjs";
import { ErrorDudoso } from "./errores.mjs";
import { normalizarTexto } from "./instagram.mjs";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const msPrueba = () => Number(process.env.META_SONDEO_MS) || 0;
// La guía de reels no da un ritmo de consulta: un poco más seguido al principio, 5 min en total.
const ESPERAS = [10_000, 20_000, 30_000, 60_000, 60_000, 60_000, 60_000];
// Valores de la guía "Reels Publishing": cualquiera de estos es una falla, no "todavía no".
const VIDEO_FALLIDO = ["error", "expired", "upload_failed"];
const enlace = (permalink, id) => (permalink ? (permalink.startsWith("/") ? "https://www.facebook.com" + permalink : permalink) : `https://www.facebook.com/${id}`);

// Lo que publica no se repite a ciegas: si no contestó, primero se busca si salió.
async function publicarSeguro(ctx, pedido, buscar) {
  ctx.hooks.antesDePublicar({});
  try {
    const r = await pedido();
    ctx.hooks.seMando();
    return r;
  } catch (e) {
    if (!e.ambiguo) throw e;
    ctx.hooks.seMando(); // pudo haber salido: desde acá ningún error borra el registro
    decir("  Facebook: el pedido de publicar no contestó bien; busco si salió antes de hacer nada…");
    await espera(msPrueba() || 15_000);
    const hallado = await buscar().catch(() => null);
    if (hallado) { decir("  Facebook: salió bien (lo confirmé consultando)."); return hallado; }
    throw new ErrorDudoso("no pude confirmar si salió en Facebook: mirá la página antes de repetir");
  }
}

function buscarEnFeed(ctx) {
  const { cli, pageId, texto, programar, inicio } = ctx;
  return async () => {
    const ruta = programar ? `${pageId}/scheduled_posts` : `${pageId}/feed`;
    const r = await cli.get(ruta, { fields: "id,message,created_time", limit: "10" }, { token: "pagina" });
    const buscado = normalizarTexto(texto);
    const p = (r.data || []).find((x) => normalizarTexto(x.message) === buscado && Date.parse(x.created_time) >= inicio - 120_000);
    return p ? { id: p.id, post_id: p.id } : null;
  };
}

async function permalinkDe(cli, id) {
  try {
    const r = await cli.get(id, { fields: "permalink_url" }, { token: "pagina", simulado: { permalink_url: "<permalink de Facebook>" } });
    return enlace(r.permalink_url, id);
  } catch {
    return enlace(null, id); // formato de la doc: https://www.facebook.com/{page_post_id}
  }
}

async function subirVideo(ctx, tipo) {
  const { cli, pageId, video } = ctx;
  if (!cli.simular) decir(`  Facebook: abro la subida de ${basename(video)}…`);
  const s = await cli.post(`${pageId}/${tipo}`, { upload_phase: "start" }, {
    token: "pagina",
    simulado: { video_id: cli.idFalso("video"), upload_url: "<upload_url de rupload>" },
  });
  if (!s.video_id) throw new Falla(`Meta no devolvió el video_id al abrir la subida (${tipo})`);
  if (!cli.simular) decir(`  Facebook: subo ${basename(video)}…`);
  const r = await cli.subir(`${cli.rupload}/video-upload/${cli.version}/${s.video_id}`, video, { token: "pagina", simulado: { success: true } });
  if (r.success === false) throw new Falla(`la subida de ${basename(video)} a Facebook no terminó bien`);
  return s.video_id;
}

// Después del finish (reels e historias en video): no se da por publicado hasta que Meta lo confirma.
// que: "el reel" o "la historia".
async function esperarVideo(ctx, videoId, que) {
  const { cli } = ctx;
  if (cli.simular) {
    await cli.get(videoId, { fields: "status" }, { token: "pagina", nota: `se repite hasta que Meta dé por listo ${que} (5 min como máximo); error, expired, upload_failed o una fase con error: falla` });
    return;
  }
  for (let i = 0; i <= ESPERAS.length; i++) {
    const { status = {} } = await cli.get(videoId, { fields: "status" }, { token: "pagina" });
    const fases = [status.uploading_phase, status.processing_phase, status.publishing_phase];
    // El ejemplo de error de la doc trae video_status "processing" y la fase en "not_started" con
    // error.message ("Resolution too low…"): una fase con error es una falla aunque no diga "error".
    const fallo = fases.find((f) => f?.status === "error" || f?.error?.message);
    if (VIDEO_FALLIDO.includes(status.video_status) || fallo || status.publishing_phase?.publish_status === "error") {
      throw new Falla(`Meta aceptó ${que} ${videoId} pero falló al procesarlo (${fallo?.error?.message || status.video_status || status.publishing_phase?.publish_status}): así no se publica`);
    }
    const listo = status.video_status === "ready" || ["published", "scheduled"].includes(status.publishing_phase?.publish_status);
    if (listo) return;
    if (i === ESPERAS.length) {
      // No se anota como publicado algo que Meta no confirmó: queda dudoso hasta que alguien lo mire.
      throw new ErrorDudoso(`${que} ${videoId} sigue en "${status.video_status || "proceso"}" a los 5 minutos: puede salir sola cuando Meta termine. Mirá la página en un rato`);
    }
    decir(`  Facebook: ${que} está en ${status.video_status || "proceso"}; espero…`);
    await espera(msPrueba() || ESPERAS[i]);
  }
}

// Fotos ya subidas sin publicar que quedan en la página si el posteo falla a mitad.
function avisarSueltas(fotos, e) {
  if (!fotos.length) return e;
  decir(`  Ojo: quedaron ${fotos.length} foto(s) subidas SIN publicar en la página (ids ${fotos.join(", ")}): no se ven en el muro; si molestan, se borran desde Meta Business Suite.`);
  return e;
}

export async function publicarEnFacebook(ctx) {
  const { cli, pageId, formato, imagenes, video, texto, programar, ia } = ctx;
  const programacion = programar ? { published: false, scheduled_publish_time: programar, unpublished_content_type: "SCHEDULED" } : {};

  if ((formato === "imagen" || formato === "carrusel") && imagenes.length === 1) {
    if (!cli.simular) decir(`  Facebook: subo ${basename(imagenes[0].archivo)} y ${programar ? "lo programo" : "publico"}…`);
    const r = await publicarSeguro(ctx,
      () => cli.postArchivo(`${pageId}/photos`, { caption: texto, ...programacion }, imagenes[0].archivo, {
        token: "pagina", publica: true, simulado: { id: cli.idFalso("foto"), post_id: cli.idFalso("posteo") },
      }),
      buscarEnFeed(ctx));
    const postId = r.post_id || r.id;
    return { postId, permalink: await permalinkDe(cli, postId) };
  }

  if (formato === "carrusel") {
    const fotos = [];
    try {
      for (const [i, img] of imagenes.entries()) {
        if (!cli.simular) decir(`  Facebook: subo la foto ${i + 1} de ${imagenes.length} (${basename(img.archivo)}) sin publicar…`);
        // temporary=true: lo pide la doc para fotos que van en un posteo programado.
        const f = await cli.postArchivo(`${pageId}/photos`, { published: false, temporary: programar ? true : undefined }, img.archivo, {
          token: "pagina", simulado: { id: cli.idFalso("foto") },
        });
        fotos.push(f.id);
      }
    } catch (e) {
      throw avisarSueltas(fotos, e);
    }
    if (!cli.simular) decir(`  Facebook: ${programar ? "programo" : "publico"} el posteo con las ${fotos.length} fotos…`);
    let r;
    try {
      r = await publicarSeguro(ctx,
        () => cli.post(`${pageId}/feed`, { message: texto, attached_media: fotos.map((id) => ({ media_fbid: id })), ...programacion }, {
          token: "pagina", publica: true, simulado: { id: cli.idFalso("posteo") },
        }),
        buscarEnFeed(ctx));
    } catch (e) {
      throw e.dudoso || e.ambiguo ? e : avisarSueltas(fotos, e);
    }
    return { postId: r.id, permalink: await permalinkDe(cli, r.id) };
  }

  if (formato === "historia" && !video) {
    if (!cli.simular) decir(`  Facebook: subo ${basename(imagenes[0].archivo)} sin publicar para la historia…`);
    const f = await cli.postArchivo(`${pageId}/photos`, { published: false }, imagenes[0].archivo, { token: "pagina", simulado: { id: cli.idFalso("foto") } });
    const r = await publicarSeguro(ctx,
      () => cli.post(`${pageId}/photo_stories`, { photo_id: f.id }, { token: "pagina", publica: true, simulado: { success: true, post_id: cli.idFalso("historia") } }),
      () => buscarHistoria(ctx));
    return { postId: r.post_id, permalink: enlace(null, r.post_id) };
  }

  if (formato === "historia") {
    const videoId = await subirVideo(ctx, "video_stories");
    // La guía de historias de página admite is_ai_generated en el finish de video_stories.
    const campos = { upload_phase: "finish", video_id: videoId };
    if (ia) campos.is_ai_generated = true;
    const r = await publicarSeguro(ctx,
      () => cli.post(`${pageId}/video_stories`, campos, { token: "pagina", publica: true, simulado: { success: true, post_id: cli.idFalso("historia") } }),
      () => buscarHistoria(ctx));
    // La guía de historias de página pide consultar el estado "during upload or publishing": el
    // success del finish no alcanza (Meta todavía puede rechazarla al procesarla).
    await esperarVideo(ctx, videoId, "la historia");
    return { postId: r.post_id || videoId, permalink: enlace(null, r.post_id || videoId) };
  }

  if (formato === "reel") {
    const videoId = await subirVideo(ctx, "video_reels");
    const campos = { upload_phase: "finish", video_id: videoId, video_state: programar ? "SCHEDULED" : "PUBLISHED", description: texto };
    if (programar) campos.scheduled_publish_time = programar;
    if (ia) campos.is_ai_generated = true;
    await publicarSeguro(ctx,
      () => cli.post(`${pageId}/video_reels`, campos, { token: "pagina", publica: true, simulado: { success: true } }),
      async () => {
        const { status = {} } = await cli.get(videoId, { fields: "status" }, { token: "pagina" });
        return ["published", "scheduled"].includes(status.publishing_phase?.publish_status) ? { success: true } : null;
      });
    if (!programar) await esperarVideo(ctx, videoId, "el reel");
    return { postId: videoId, permalink: await permalinkDe(cli, videoId) };
  }

  throw new Falla(`formato desconocido para Facebook: ${formato}`);
}

async function buscarHistoria(ctx) {
  const { cli, pageId, inicio } = ctx;
  const r = await cli.get(`${pageId}/stories`, { since: String(Math.floor((inicio - 120_000) / 1000)) }, { token: "pagina" });
  const h = (r.data || []).find((x) => Number(x.creation_time) * 1000 >= inicio - 120_000 || Date.parse(x.creation_time) >= inicio - 120_000);
  return h ? { success: true, post_id: h.post_id } : null;
}
