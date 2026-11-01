// Publicar en Instagram con la API oficial: "Instagram API with Facebook Login" (graph.facebook.com) o,
// en el modo Instagram, "with Instagram Login" (graph.instagram.com, mismo camino; el cliente decide el host).
// El camino de la doc: crear un contenedor → esperar status_code FINISHED → media_publish.
//   imagen   = un contenedor con image_url + caption
//   carrusel = un contenedor por lámina (is_carousel_item) + uno CAROUSEL con children y caption
//   reel     = REELS con carga reanudable desde el archivo (rupload.facebook.com); modo Instagram: video_url
//   historia = STORIES con image_url, o con carga reanudable si es video (modo Instagram: video_url)
import { basename } from "node:path";
import { Falla, decir } from "./entorno.mjs";
import { ErrorDudoso, detalleDeEstado } from "./errores.mjs";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// La doc recomienda consultar el estado una vez por minuto y no más de 5 minutos: una consulta
// enseguida (las imágenes suelen estar listas) y después una por minuto, cinco como mucho.
const ESPERAS = [60_000, 60_000, 60_000, 60_000, 60_000];
const msPrueba = () => Number(process.env.META_SONDEO_MS) || 0; // solo para pruebas

async function crearContenedor(ctx, campos, que) {
  const { cli, igId } = ctx;
  if (!cli.simular) decir(`  Instagram: creo el contenedor para ${que}…`);
  const r = await cli.post(`${igId}/media`, campos, {
    simulado: campos.upload_type ? { id: cli.idFalso("contenedor"), uri: "<uri de rupload>" } : { id: cli.idFalso("contenedor") },
  });
  if (!r.id) throw new Falla(`Meta no devolvió el id del contenedor de ${que}`);
  return r.id;
}

// Espera varios contenedores a la vez (las láminas de un carrusel se procesan en paralelo):
// cada ronda consulta cada uno una sola vez, y entre rondas pasa un minuto.
export async function esperarContenedores(ctx, lista) {
  const { cli } = ctx;
  if (cli.simular) {
    for (const { id } of lista) {
      await cli.get(id, { fields: "status_code" }, { nota: "se repite hasta FINISHED: una vez enseguida y después una por minuto, 5 min como máximo. ERROR o EXPIRED: no se publica" });
    }
    return;
  }
  let pendientes = [...lista];
  for (let i = 0; ; i++) {
    const siguen = [];
    for (const c of pendientes) {
      const r = await cli.get(c.id, { fields: "status_code,status" });
      if (r.status_code === "FINISHED") continue;
      if (r.status_code === "ERROR" || r.status_code === "EXPIRED") {
        // EXPIRED: el contenedor no se publicó en 24 h (doc de content publishing); uno nuevo lo arregla.
        const detalle = detalleDeEstado(r.status) || r.status || (r.status_code === "EXPIRED" ? "venció sin publicarse; volvé a correr el comando: se crea un contenedor nuevo" : "sin detalle");
        throw new Falla(`Instagram no pudo procesar ${c.que}: el contenedor ${c.id} quedó en ${r.status_code} (${detalle}). No se publicó nada.`);
      }
      siguen.push({ ...c, estado: r.status_code });
    }
    if (!siguen.length) return;
    if (i >= ESPERAS.length) {
      const c = siguen[0];
      // Cada corrida crea un contenedor nuevo (y Meta vuelve a bajar el archivo): este no se retoma.
      throw new Falla(`${c.que} sigue en ${c.estado || "sin estado"} después de 5 minutos: no publico y no se publicó nada (la doc de Meta recomienda esperar hasta 5 minutos). Podés volver a correr el comando más tarde: se crea un contenedor nuevo y Meta vuelve a bajar el archivo (el ${c.id} queda sin usar y vence solo en 24 h). Si con un video pasa siempre, probá con uno más liviano.`);
    }
    decir(`  Instagram: ${siguen.map((c) => `${c.que} está en ${c.estado || "sin estado"}`).join("; ")}; espero un minuto…`);
    pendientes = siguen;
    await espera(msPrueba() || ESPERAS[i]);
  }
}
export const esperarContenedor = (ctx, id, que) => esperarContenedores(ctx, [{ id, que }]);

async function subirVideo(ctx, contenedor, archivo) {
  const { cli } = ctx;
  if (!cli.simular) decir(`  Instagram: subo ${basename(archivo)} (carga reanudable)…`);
  const r = await cli.subir(`${cli.rupload}/ig-api-upload/${cli.version}/${contenedor}`, archivo, {
    simulado: { success: true, message: "Upload successful." },
  });
  if (r.success === false) throw new Falla(`la subida de ${basename(archivo)} no terminó bien: ${r.message || "sin detalle"}`);
}

// Para comparar textos: la API devuelve el caption sin "@" si el usuario no es administrador
// de la página (doc de IG Media), y los saltos de línea pueden venir distintos.
export const normalizarTexto = (t) => String(t || "").replace(/@/g, "").replace(/\s+/g, " ").trim();

// Busca lo que se acaba de publicar, para cuando media_publish no contestó pero el contenedor dice PUBLISHED.
async function buscarPublicado(ctx) {
  const { cli, igId, formato, texto, inicio } = ctx;
  const ruta = formato === "historia" ? `${igId}/stories` : `${igId}/media`;
  const r = await cli.get(ruta, { fields: "id,caption,timestamp,permalink", limit: "10" });
  const buscado = normalizarTexto(texto);
  return (r.data || []).find((m) => Date.parse(m.timestamp) >= inicio - 120_000 && (formato === "historia" || normalizarTexto(m.caption) === buscado));
}

async function estadoDe(cli, contenedor) {
  try { return (await cli.get(contenedor, { fields: "status_code" })).status_code || null; } catch { return null; }
}

// El contenedor figura PUBLISHED: se busca el posteo; si no aparece, queda dudoso (nunca se repite).
async function confirmarPublicado(ctx, contenedor) {
  const media = await buscarPublicado(ctx).catch(() => null);
  if (media) { decir("  Instagram: salió bien (lo confirmé consultando)."); return { id: media.id, permalink: media.permalink }; }
  throw new ErrorDudoso(`el contenedor ${contenedor} figura publicado pero no encuentro el posteo: mirá la cuenta antes de repetir`);
}

// media_publish nunca se reintenta a ciegas: si no hubo respuesta, primero se pregunta si salió.
async function publicarContenedor(ctx, contenedor) {
  const { cli, igId, hooks } = ctx;
  hooks.antesDePublicar({ contenedor });
  const pedido = () => cli.post(`${igId}/media_publish`, { creation_id: contenedor }, { publica: true, simulado: { id: cli.idFalso("media") } });
  try {
    const r = await pedido();
    hooks.seMando();
    return r;
  } catch (e) {
    if (!e.ambiguo) throw e; // Meta contestó que no: no salió nada
  }
  // Desde acá el primer pedido pudo haber salido (aunque sea tarde): ningún error borra el registro.
  hooks.seMando();
  decir("  Instagram: media_publish no contestó bien; consulto si salió antes de volver a pedirlo…");
  let terminados = 0;
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    await espera(msPrueba() || 15_000);
    const estado = await estadoDe(cli, contenedor);
    if (estado === "PUBLISHED") return confirmarPublicado(ctx, contenedor);
    if (estado === "FINISHED" && ++terminados >= 2) {
      // Dos consultas seguidas dicen que todavía no salió: se pide una sola vez más.
      decir("  Instagram: dos consultas seguidas dicen que todavía no salió; lo pido una vez más.");
      try {
        return await pedido();
      } catch (e2) {
        // El primer pedido puede haber llegado tarde (Meta contesta "ya publicado"): se vuelve a mirar.
        await espera(msPrueba() || 15_000);
        if ((await estadoDe(cli, contenedor)) === "PUBLISHED") return confirmarPublicado(ctx, contenedor);
        throw new ErrorDudoso(`el segundo media_publish falló (${e2.message}) y no puedo confirmar qué pasó con el primero (contenedor ${contenedor}): mirá la cuenta antes de repetir`);
      }
    }
  }
  throw new ErrorDudoso(`no pude confirmar si salió (contenedor ${contenedor}): mirá la cuenta de Instagram antes de repetir`);
}

// ctx.videoUrl (modo Instagram, inicio de sesión de Instagram): el video va por URL pública (video_url),
// porque la carga reanudable es "only for apps that have implemented Facebook Login for Business".
export async function publicarEnInstagram(ctx) {
  const { cli, formato, imagenes, video, videoUrl, portadaUrl, texto, ia } = ctx;
  const extra = ia ? { is_ai_generated: true } : {};
  let contenedor;

  if (formato === "imagen") {
    contenedor = await crearContenedor(ctx, { image_url: imagenes[0].url, caption: texto, ...extra }, "la imagen");
  } else if (formato === "carrusel") {
    const hijos = [];
    for (const [i, img] of imagenes.entries()) {
      // Las láminas van sin caption ni is_ai_generated (la doc no los admite en los hijos): van en el CAROUSEL.
      const id = await crearContenedor(ctx, { image_url: img.url, is_carousel_item: true }, `la lámina ${i + 1} de ${imagenes.length} (${basename(img.archivo)})`);
      hijos.push({ id, que: `la lámina ${i + 1}` });
    }
    await esperarContenedores(ctx, hijos);
    contenedor = await crearContenedor(ctx, { media_type: "CAROUSEL", children: hijos.map((h) => h.id).join(","), caption: texto, ...extra }, "el carrusel");
  } else if (formato === "historia" && !video) {
    // is_ai_generated no figura entre los parámetros de STORIES en la referencia: no se manda (publicar.mjs avisa).
    contenedor = await crearContenedor(ctx, { media_type: "STORIES", image_url: imagenes[0].url }, "la historia");
  } else if (formato === "historia" && videoUrl) {
    contenedor = await crearContenedor(ctx, { media_type: "STORIES", video_url: videoUrl }, "la historia en video");
  } else if (formato === "historia") {
    contenedor = await crearContenedor(ctx, { media_type: "STORIES", upload_type: "resumable" }, "la historia en video");
    await subirVideo(ctx, contenedor, video);
  } else if (formato === "reel") {
    const campos = videoUrl
      ? { media_type: "REELS", video_url: videoUrl, caption: texto, share_to_feed: true, ...extra }
      : { media_type: "REELS", upload_type: "resumable", caption: texto, share_to_feed: true, ...extra };
    if (portadaUrl) campos.cover_url = portadaUrl;
    contenedor = await crearContenedor(ctx, campos, "el reel");
    if (!videoUrl) await subirVideo(ctx, contenedor, video);
  } else {
    throw new Falla(`formato desconocido para Instagram: ${formato}`);
  }

  const nombre = { imagen: "la imagen", carrusel: "el carrusel", reel: "el reel", historia: "la historia" }[formato];
  await esperarContenedor(ctx, contenedor, nombre);
  if (!cli.simular) decir("  Instagram: publico…");
  const publicado = await publicarContenedor(ctx, contenedor);
  if (publicado.config_issue) decir(`  ojo: Meta publicó pero avisa "${publicado.config_issue}" (por ejemplo, que no pegó el texto): revisalo en la app`);

  let permalink = publicado.permalink || null;
  if (!permalink) {
    try {
      permalink = (await cli.get(publicado.id, { fields: "permalink" }, { simulado: { permalink: "<permalink de Instagram>" } })).permalink || null;
    } catch {
      permalink = null; // salió igual: el link se puede buscar después en la app
    }
  }
  return { mediaId: publicado.id, permalink, contenedor, contenedores: formato === "carrusel" ? imagenes.length + 1 : 1 };
}
