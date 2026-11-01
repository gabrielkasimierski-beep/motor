// El comando publicar: arma todo, valida todo y recién entonces habla con Meta.
// Por defecto es una simulación (no manda nada). Con --de-verdad exige que la pieza esté
// "aprobado" en calendario.md, que todo salga de publicar/<tanda>/<id>/ y que no figure ya en
// registro-meta/publicaciones.json. Una sola corrida de verdad a la vez (registro-meta/.candado).
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { Falla, decir, enmascarar, leerJson, contieneSecreto, nombreZona, SIN_FACEBOOK } from "./entorno.mjs";
import { crearCliente, clienteInstagram } from "./graph.mjs";
import { cuentaInstagram, FALTA_TOKEN as FALTA_TOKEN_IG } from "./instagram-login.mjs";
import { renovarSiCorresponde, estadoToken, textoDias, alertaDelToken } from "./token-instagram.mjs";
import { leerJpeg, leerMp4, esDelDriveDelTrabajo, estaDentro, huellaDe } from "./archivos.mjs";
import { validarTexto, validarImagen, validarCarrusel, validarVideo, LIMITES } from "./validar.mjs";
import { horaLocalAUnix, validarProgramacion, unixAHoraLocal } from "./tiempo.mjs";
import { buscarPieza, cerrarPublicacion } from "./calendario.mjs";
import { leerRegistro, previasDe, claveDe, anotar, borrar, tomarCandado, ultimas24h, comoResolver } from "./registro.mjs";
import { resolverCuentas, cupoInstagram, usuarioEsperado, paginaEsperada } from "./cuentas.mjs";
import { revisarBaseUrl, urlPublica, comprobarUrl, subirParaInstagram } from "./medios.mjs";
import { publicarEnInstagram } from "./instagram.mjs";
import { publicarEnFacebook } from "./facebook.mjs";

const FORMATOS = ["auto", "imagen", "carrusel", "reel", "historia"];
const REDES = { instagram: ["instagram"], facebook: ["facebook"], ambas: ["instagram", "facebook"] };
const NOMBRE = { instagram: "Instagram", facebook: "Facebook" };
// Cupos que Meta pide controlar también en la app (guía de reels: 30 cada 24 h; IG User media: 400 contenedores cada 24 h).
const REELS_FB_24H = 30;
const CONTENEDORES_IG_24H = 400;

function describir(red, formato, imagenes, video) {
  if (formato === "carrusel") return red === "instagram" ? `carrusel de ${imagenes.length} láminas` : imagenes.length > 1 ? `${imagenes.length} fotos en un posteo` : "una foto";
  if (formato === "imagen") return red === "instagram" ? "una imagen" : "una foto";
  if (formato === "historia") return video ? "historia en video" : "historia con imagen";
  return "reel";
}

export async function publicar(op, entorno) {
  // ---------- 1. opciones ----------
  const { tanda, id } = op;
  if (!tanda || !id) throw new Falla("faltan --tanda=<tanda> y --id=<pieza>", { codigo: 2 });
  // Sin barras ni ".." al principio: --tanda e --id no pueden salir de publicar/.
  const nombreSano = (s) => /^\w[\w.-]*$/.test(s) && !s.includes("..");
  if (!nombreSano(tanda) || !nombreSano(id)) throw new Falla("--tanda e --id solo llevan letras, números, puntos y guiones (y empiezan con letra o número)", { codigo: 2 });
  if (op.salio || op.link) throw new Falla("--salio y --link son del comando resolver, no de publicar", { codigo: 2 });
  // En el modo Instagram (INSTAGRAM_TOKEN) la red por defecto es Instagram; en el de Facebook hay que decirla.
  const modo = entorno.modo || "facebook";
  if (!op.red && modo === "facebook") throw new Falla("falta --red=instagram|facebook|ambas", { codigo: 2 });
  const redPedida = op.red || "instagram";
  const redes = REDES[redPedida];
  if (!redes) throw new Falla(`--red=${redPedida} no vale: tiene que ser instagram, facebook o ambas (en minúscula)`, { codigo: 2 });
  if (modo === "instagram" && redes.includes("facebook")) throw new Falla(SIN_FACEBOOK, { codigo: 2 });
  // Con los dos tokens, una corrida usa uno solo: así cada red tiene su propio candado de errores y de registro.
  if (modo === "mixto" && redes.length > 1) throw new Falla("en .env están INSTAGRAM_TOKEN y META_ACCESS_TOKEN: se publica de a una red por vez (--red=instagram y después --red=facebook)", { codigo: 2 });
  // Instagram con inicio de sesión de Instagram (graph.instagram.com, INSTAGRAM_TOKEN).
  const igLogin = modo !== "facebook" && redes.includes("instagram");
  const formatoPedido = op.formato || "auto";
  if (!FORMATOS.includes(formatoPedido)) throw new Falla(`--formato tiene que ser uno de: ${FORMATOS.join(", ")}`, { codigo: 2 });
  if (op.medios && !["url", "facebook"].includes(op.medios)) throw new Falla("--medios tiene que ser url o facebook", { codigo: 2 });
  if (op.medios === "facebook" && modo !== "facebook") {
    throw new Falla("--medios=facebook no está disponible en el modo Instagram: necesita la página de Facebook conectada (falta el portfolio). Las imágenes y los videos van por config.json → medios.baseUrl", { codigo: 2 });
  }
  const deVerdad = Boolean(op.deVerdad);
  const simular = !deVerdad;
  const raiz = entorno.raiz;
  const rel = (p) => {
    const r = relative(raiz, p).replace(/\\/g, "/");
    return r.startsWith("..") ? p : r; // fuera del proyecto se muestra la ruta entera
  };
  // Contra el simulador y con la carpeta real no se tocan el calendario ni los registros de verdad.
  const escribir = deVerdad && !(entorno.simulador && entorno.esProyectoReal);

  // ---------- 2. la pieza ----------
  const carpeta = join(raiz, "publicar", tanda, id);
  // Rutas que pasa el usuario (--video, --imagen, --texto…): relativas a donde se corre el comando.
  // Con --de-verdad tienen que estar en la carpeta de la pieza: se publica lo aprobado, no cualquier archivo.
  const archivoUsuario = (ruta, que) => {
    const r = resolve(String(ruta));
    if (esDelDriveDelTrabajo(r)) throw new Falla(`${que} está en G: (el Drive del trabajo): nunca va nada de proyecto ahí`, { codigo: 2 });
    if (/^\.env/i.test(basename(r))) throw new Falla(`${que} es un archivo .env: ahí vive el token y nunca se publica`, { codigo: 2 });
    if (!existsSync(r)) throw new Falla(`no existe ${que}: ${r}`, { codigo: 2 });
    if (deVerdad && !estaDentro(carpeta, r)) {
      throw new Falla(`con --de-verdad, ${que} tiene que estar en ${rel(carpeta)}/ (lo que se aprobó de esa pieza): copialo ahí y volvé a correr`, { codigo: 2 });
    }
    return r;
  };
  const ficha = leerJson(join(carpeta, "publicacion.json"));
  const comoPreparar = `prepará los archivos y publicacion.json en publicar/${tanda}/${id}/ según README.md`;
  if (ficha && (ficha.tanda !== tanda || ficha.id !== id)) throw new Falla(`${rel(join(carpeta, "publicacion.json"))} dice ser ${ficha.tanda}/${ficha.id}: volvé a prepararla`);
  const laminas = () => {
    if (!ficha) throw new Falla(`no está ${rel(carpeta)}/publicacion.json: ${comoPreparar}`);
    return [...ficha.laminas].sort((a, b) => a.orden - b.orden).map((l) => {
      const archivo = join(carpeta, l.archivo);
      if (!estaDentro(carpeta, archivo)) throw new Falla(`publicacion.json nombra ${l.archivo}, que está fuera de ${rel(carpeta)}/: volvé a prepararla`);
      if (!existsSync(archivo)) throw new Falla(`falta ${rel(archivo)}: ${comoPreparar}`);
      return { archivo };
    });
  };

  let formato = formatoPedido;
  let imagenes = [];
  let video = null;
  let portada = null;
  if (formato === "auto") {
    if (op.video) formato = "reel";
    else if (op.imagen) {
      const info = leerJpeg(archivoUsuario(op.imagen, "--imagen"));
      formato = Math.abs(info.ancho / info.alto - LIMITES.historia) <= 0.01 ? "historia" : "imagen";
    } else formato = laminas().length > 1 ? "carrusel" : "imagen";
  }
  // Que ninguna opción quede ignorada en silencio.
  if (op.video && !["reel", "historia"].includes(formato)) throw new Falla("--video solo sirve para --formato=reel o --formato=historia", { codigo: 2 });
  if (op.portada && formato !== "reel") throw new Falla("--portada solo sirve para reels", { codigo: 2 });
  if (formato === "imagen" || formato === "carrusel") {
    imagenes = op.imagen && formato === "imagen" ? [{ archivo: archivoUsuario(op.imagen, "--imagen") }] : laminas();
    if (formato === "imagen" && imagenes.length > 1) throw new Falla(`la pieza tiene ${imagenes.length} láminas: es un carrusel (--formato=carrusel o auto)`, { codigo: 2 });
  } else if (formato === "historia") {
    if (op.video) video = archivoUsuario(op.video, "--video");
    else if (op.imagen) imagenes = [{ archivo: archivoUsuario(op.imagen, "--imagen") }];
    else if (ficha && ficha.laminas.length === 1) imagenes = laminas();
    else throw new Falla("para una historia pasá --imagen=<archivo.jpg> (1080×1920) o --video=<archivo.mp4>", { codigo: 2 });
  } else if (formato === "reel") {
    if (!op.video) throw new Falla("para un reel pasá --video=<archivo.mp4>", { codigo: 2 });
    video = archivoUsuario(op.video, "--video");
    if (op.portada) portada = archivoUsuario(op.portada, "--portada");
  }

  // ---------- 3. el texto ----------
  const avisos = [...(entorno.avisos || [])];
  let texto = null;
  if (formato === "historia") {
    if (op.texto) avisos.push("las historias no llevan texto: ignoro --texto");
  } else if (op.texto) {
    const archivo = archivoUsuario(op.texto, "--texto");
    if (!estaDentro(raiz, archivo)) throw new Falla(`--texto tiene que ser un archivo de la carpeta del proyecto (${raiz})`, { codigo: 2 });
    texto = readFileSync(archivo, "utf8").trim();
  } else if (ficha?.texto) texto = ficha.texto;
  else if (formato === "reel") { texto = ""; avisos.push("el reel va sin texto (no hay publicacion.json ni --texto)"); }
  else throw new Falla(`falta el texto de la pieza: ${comoPreparar}`);
  // Antes de mostrar nada: un texto con el token (o un pedazo) no se muestra ni se publica nunca.
  const conToken = "el texto de la pieza trae el token de Meta (o un pedazo, algo con forma de token o la línea META_ACCESS_TOKEN o INSTAGRAM_TOKEN): no lo muestro ni lo publico. Revisá de dónde sale el texto";
  if (texto && contieneSecreto(texto)) throw new Falla(conToken, { codigo: 2 });

  // ---------- 4. validar todo antes de hablar con Meta ----------
  const errores = [];
  const uso = formato === "historia" ? "historia" : "feed";
  // Toda foto que pasa por /{page}/photos tiene el tope de 4 MB: Facebook, o Instagram con el atajo --medios=facebook.
  const porPhotos = redes.includes("facebook") || op.medios === "facebook";
  const infos = imagenes.map((img) => (img.info = leerJpeg(img.archivo)));
  for (const info of infos) {
    const v = validarImagen(info, { uso, redes, porPhotos });
    errores.push(...v.errores);
    avisos.push(...v.avisos);
  }
  if (formato === "carrusel") {
    const v = validarCarrusel(infos, { redes });
    errores.push(...v.errores);
    avisos.push(...v.avisos);
  }
  let infoVideo = null;
  if (video) {
    infoVideo = leerMp4(video);
    const v = validarVideo(infoVideo, { uso: formato === "reel" ? "reel" : "historia", redes });
    errores.push(...v.errores);
    avisos.push(...v.avisos);
  }
  if (portada) {
    if (!redes.includes("instagram")) avisos.push("la portada solo se usa en Instagram: en Facebook la ignoro");
    const info = leerJpeg(portada);
    if (info.bytes > LIMITES.igImagen) errores.push(`${basename(portada)} pesa más de 8 MB`);
    if (op.medios === "facebook" && info.bytes > LIMITES.fbFoto) errores.push(`${basename(portada)} pesa más de 4 MB (con --medios=facebook pasa por /photos)`);
  }
  const t = texto !== null ? validarTexto(texto) : null;
  if (t && redes.includes("instagram")) errores.push(...t.errores);
  // Solo Facebook: no frena, pero si después va a Instagram, el mismo texto no va a pasar (y otro
  // texto cambia la huella y pide aprobación nueva).
  else if (t?.errores.length) avisos.push(`el texto no pasa los límites de Instagram (${t.errores.join("; ")}): en Facebook sale, pero después no se va a poder publicar igual en Instagram`);
  // La marca de IA: dónde se aplica y dónde no (que no quede ignorada en silencio).
  if (op.ia) {
    if (redes.includes("instagram") && formato === "historia") avisos.push("--hecho-con-ia: la referencia de Instagram no documenta la marca de IA en historias: no se aplica a la historia de Instagram");
    if (redes.includes("facebook") && (formato === "imagen" || formato === "carrusel" || (formato === "historia" && !video))) {
      avisos.push("--hecho-con-ia: Facebook no tiene marca de IA para fotos por API: no se aplica en Facebook");
    }
  }

  let programar = null;
  if (op.programar) {
    if (redes.includes("instagram")) throw new Falla("--programar es solo para Facebook (la API de Instagram publica en el momento): usá --red=facebook", { codigo: 2 });
    if (formato === "historia") throw new Falla("las historias no se pueden programar por la API", { codigo: 2 });
    programar = horaLocalAUnix(op.programar, entorno.zona);
    validarProgramacion(programar, formato === "reel" ? "reel" : "posteo", entorno.zona);
  }
  if (errores.length) throw new Falla(`la pieza no pasa las reglas de Meta:\n  - ${errores.join("\n  - ")}`);

  // ---------- 5. aprobación y registro ----------
  if (igLogin) {
    if (deVerdad && !entorno.igToken) throw new Falla(FALTA_TOKEN_IG);
  } else {
    if (deVerdad && !entorno.token) throw new Falla("falta META_ACCESS_TOKEN en maquina-de-contenido/.env (ver .env.ejemplo y README.md)");
    if (deVerdad && !entorno.pageId) throw new Falla("falta META_PAGE_ID en maquina-de-contenido/.env (el número de la página de Facebook de proyecto)");
  }
  // El candado se toma antes de leer el registro: así dos corridas no pueden ver las dos "no publicado".
  const soltarCandado = escribir ? tomarCandado(raiz) : () => {};
  try {
    return await publicarConCandado();
  } finally {
    soltarCandado();
  }

  async function publicarConCandado() {
    const archivoCal = join(raiz, "calendario.md");
    const md = existsSync(archivoCal) ? readFileSync(archivoCal, "utf8") : null;
    const fila = md ? buscarPieza(md, tanda, id) : null;
    // Historias y reels (fila sin Carpeta): la misma pieza con otra --tanda sigue siendo la misma.
    const cualquierTanda = fila ? !fila.porCarpeta : false;
    const registro = leerRegistro(raiz);
    // La huella ata lo que sale a lo que ya salió: la otra red recibe exactamente lo mismo.
    const huella = huellaDe(texto, [...imagenes.map((i) => i.archivo), video, portada].filter(Boolean));
    const salidas = registro.publicaciones.filter((p) => p.tanda === tanda && p.id === id && ["publicado", "programado"].includes(p.estado));
    // "programado"/"publicado" vienen después de "aprobado": valen solo para el mismo formato y el mismo contenido.
    const yaPasoPorAca = salidas.some((p) => p.formato === formato && p.huella === huella);
    let problemaAprobacion = null;
    if (!md) problemaAprobacion = "no está calendario.md";
    else if (!fila) problemaAprobacion = `no encuentro la pieza en calendario.md (busco la carpeta salidas/${tanda}/${id}/ en la columna Carpeta, o el archivo \`…/${id}.<ext>\` en las tablas de historias y reels)`;
    else if (fila.estado === "aprobado") problemaAprobacion = null;
    else if (["programado", "publicado"].includes(fila.estado)) {
      if (!yaPasoPorAca) problemaAprobacion = `"${fila.nombre}" ya está "${fila.estado}" con otro formato u otro contenido: algo distinto (otro formato, texto o archivo) necesita su propia aprobación en calendario.md`;
    } else {
      const casi = /aprobado/i.test(fila.estado) ? ` (tiene que decir exactamente "aprobado", sin signos, negritas ni agregados)` : "";
      problemaAprobacion = `"${fila.nombre}" está en "${fila.estado || "sin estado"}" en calendario.md y tiene que estar "aprobado"${casi} (nadie publica sin el OK de la persona responsable)`;
    }
    const repetidas = redes.flatMap((red) => previasDe(registro, { tanda, id, red, formato }, { cualquierTanda }).map((p) => ({ red, ...p })));

    // Cupos que Meta pide controlar también en la app (solo cuenta lo que publicó esta herramienta).
    if (redes.includes("facebook") && formato === "reel") {
      const n = ultimas24h(registro, (p) => p.red === "facebook" && p.formato === "reel").length;
      if (n >= REELS_FB_24H) {
        const msg = `ya van ${n} reels de Facebook en las últimas 24 h y Meta permite ${REELS_FB_24H} por API: esperá`;
        if (deVerdad) throw new Falla(msg);
        avisos.push(msg);
      } else if (n >= REELS_FB_24H - 5) avisos.push(`van ${n} de ${REELS_FB_24H} reels de Facebook por API en las últimas 24 h`);
    }
    if (redes.includes("instagram")) {
      const usados = ultimas24h(registro, (p) => p.red === "instagram").reduce((s, p) => s + (p.contenedores || 1), 0);
      const hacen = formato === "carrusel" ? imagenes.length + 1 : 1;
      if (usados + hacen > CONTENEDORES_IG_24H) {
        const msg = `Instagram permite ${CONTENEDORES_IG_24H} contenedores cada 24 h; ya van unos ${usados} y esta pieza usa ${hacen}: esperá`;
        if (deVerdad) throw new Falla(msg);
        avisos.push(msg);
      }
    }

    // ---------- 6. contar qué va a pasar ----------
    decir(simular
      ? "MODO SIMULACIÓN: no se manda nada a Meta. Para publicar de verdad, agregá --de-verdad."
      : `PUBLICAR DE VERDAD${entorno.simulador ? ` (contra el simulador ${igLogin ? entorno.igGraph : entorno.graph})` : ""}`);
    decir(`Pieza: ${tanda} / ${id} · ${formato}${imagenes.length > 1 ? ` de ${imagenes.length} láminas` : ""} · ${redes.map((r) => NOMBRE[r]).join(" y ")}`);
    decir(`Calendario: ${fila ? `"${fila.nombre}" está en "${fila.estado}"` : "no la encuentro"}${problemaAprobacion ? "" : " (OK)"}`);
    if (t) decir(`Texto: ${t.caracteres} caracteres, ${t.hashtags} hashtags, ${t.menciones} menciones (Instagram acepta ${LIMITES.caracteres} / ${LIMITES.hashtags} / ${LIMITES.menciones}): ${t.errores.length ? "NO pasa en Instagram (solo Facebook)" : "OK"}`);
    for (const i of infos) decir(`Imagen: ${rel(i.ruta)} · JPEG ${i.ancho}×${i.alto} · ${Math.round(i.bytes / 1024)} KB: OK`);
    if (infoVideo) decir(`Video: ${basename(video)} · ${(infoVideo.bytes / 1048576).toFixed(1)} MB · ${infoVideo.duracion != null ? infoVideo.duracion.toFixed(1) + " s" : "duración desconocida"}${infoVideo.ancho ? ` · ${infoVideo.ancho}×${infoVideo.alto}` : ""}: OK`);
    if (programar) decir(`Programado para: ${unixAHoraLocal(programar, entorno.zona)} (${nombreZona(entorno.zona)}) = ${programar} UNIX`);
    for (const a of avisos) decir(`Aviso: ${a}`);

    if (problemaAprobacion) {
      if (deVerdad) throw new Falla(`no publico: ${problemaAprobacion}.`);
      decir(`Ojo: con --de-verdad me negaría: ${problemaAprobacion}.`);
    }
    if (repetidas.length) {
      const lista = repetidas.map((p) => `${NOMBRE[p.red]} quedó "${p.estado}" el ${String(p.fecha || p.desde || "").slice(0, 10)}${p.permalink ? " → " + p.permalink : ""}`).join("; ");
      const dudosas = repetidas.some((p) => ["en-curso", "dudoso"].includes(p.estado));
      const red0 = repetidas.find((p) => ["en-curso", "dudoso"].includes(p.estado))?.red;
      const consejo = dudosas ? ` Una corrida anterior no terminó: mirá la cuenta antes de repetir y cerralo así: ${comoResolver({ tanda, id, red: red0 }).join("; ")}.` : "";
      if (deVerdad && !op.repetir) throw new Falla(`no publico dos veces lo mismo: ${lista}.${consejo} Si de verdad hay que repetirla: --repetir${redes.length > 1 ? " (o elegí solo la red que falta con --red)" : ""}.`);
      // --repetir con las dos redes volvería a publicar también donde ya salió: hay que elegir la red.
      const yaSalio = repetidas.filter((p) => ["publicado", "programado"].includes(p.estado));
      if (op.repetir && redes.length > 1 && yaSalio.length) {
        const falta = redes.filter((r) => !yaSalio.some((p) => p.red === r));
        const msg = `con --red=ambas, --repetir publicaría otra vez donde ya salió: ${lista}. ${falta.length ? `Repetí solo ${NOMBRE[falta[0]]}: --red=${falta[0]} --repetir` : "Si de verdad hay que repetir las dos, corré una red por vez"}`;
        if (deVerdad) throw new Falla(`${msg}.`);
        decir(`Ojo: con --de-verdad me negaría: ${msg}.`);
      }
      decir(`${deVerdad ? "Repito (pediste --repetir)" : "Ojo: ya figura en el registro"}: ${lista}.`);
    }
    if (deVerdad && !escribir) decir("Ojo: estás contra el simulador con la carpeta real: no toco calendario.md, registro.md ni registro-meta/.");

    // ---------- 7. imágenes (y, en el modo Instagram, videos) públicas para Instagram ----------
    // En el modo Instagram el video también va por URL (video_url): no hay carga reanudable.
    const necesitanUrl = redes.includes("instagram")
      ? [...(video ? [] : imagenes), ...(video && igLogin ? [{ archivo: video, esVideo: true }] : []), ...(portada ? [{ archivo: portada, esPortada: true }] : [])]
      : [];
    let estrategia = null;
    if (necesitanUrl.length) {
      const base = revisarBaseUrl(entorno.config.medios?.baseUrl || "");
      estrategia = op.medios || (base ? "url" : null);
      if (!estrategia) {
        const msg = igLogin
          ? `Instagram baja ${video ? "el video" : "las imágenes"} de una URL pública y no hay ninguna: completá config.json → medios.baseUrl y subí ahí el contenido de publicar/ (ver README.md)`
          : "Instagram baja las imágenes de una URL pública y no hay ninguna: completá config.json → medios.baseUrl (y subí ahí el contenido de publicar/) o usá --medios=facebook (último recurso, ver README.md). Mientras tanto, Facebook sí se puede: --red=facebook";
        if (deVerdad) throw new Falla(msg);
        decir(`Ojo: ${msg}.`);
        for (const n of necesitanUrl) n.url = `<URL pública de ${basename(n.archivo)}>`;
      } else if (estrategia === "facebook") {
        decir("Aviso: --medios=facebook es el último recurso: Instagram baja la imagen del CDN de Meta, y la doc de historias de página dice que esas URL (fbcdn) se rechazan; para Instagram no está documentado. Si falla, usá medios.baseUrl.");
      } else if (estrategia === "url") {
        for (const n of necesitanUrl) {
          n.url = urlPublica(entorno, n.archivo);
          if (!n.url) {
            const msg = `${basename(n.archivo)} no está dentro de publicar/, así que no tiene URL pública: copiala a ${rel(carpeta)}/ (y subila)${igLogin ? "" : " o usá --medios=facebook"}`;
            if (deVerdad) throw new Falla(msg);
            decir(`Ojo: ${msg}.`);
            n.url = `<URL pública de ${basename(n.archivo)}>`;
          }
        }
        const cuantos = necesitanUrl.length === 1 ? (necesitanUrl[0].esVideo ? "el video" : "la imagen") : `los ${necesitanUrl.length} archivos`;
        if (deVerdad) {
          decir(`Compruebo que Meta pueda bajar ${cuantos} y que ${necesitanUrl.length === 1 ? "sea igual a lo" : "sean iguales a los"} de la carpeta (sin token: es nuestro servidor)…`);
          for (const n of necesitanUrl) await comprobarUrl(n.url, n.archivo, { video: Boolean(n.esVideo) });
        } else {
          decir(`Antes de hablar con Meta comprobaría (sin token, es nuestro servidor) que cada URL dé 200, el tipo justo (image/jpeg${necesitanUrl.some((n) => n.esVideo) ? " o video/mp4" : ""}) y lo mismo que la copia local:`);
          for (const n of necesitanUrl) decir(`  GET  ${n.url}`);
        }
      }
    }

    // ---------- 8. hablar con Meta ----------
    if (igLogin && escribir) {
      // Si toca, el token se renueva antes de usarlo (ya tenemos el candado). Si no se puede, sigue con el que hay,
      // salvo que ya haya vencido; si vence en menos de una semana y no se pudo renovar, se avisa antes de publicar.
      const alerta = alertaDelToken(await renovarSiCorresponde(entorno, { conCandado: true }), entorno.zona);
      if (alerta?.vencido) throw new Falla(`no publico: ${alerta.texto}`);
      if (alerta) decir(`Ojo: ${alerta.texto}.`);
    }
    const cli = igLogin ? clienteInstagram(entorno, { simular }) : crearCliente(entorno, { simular });
    if (simular) {
      if (igLogin) {
        // El host sale del cliente: lo que se muestra es adonde de verdad iría cada pedido.
        decir(`\nPedidos que haría a Instagram (${new URL(cli.base).host}, todos con la cabecera Authorization: Bearer y INSTAGRAM_TOKEN de .env, que no se muestra${entorno.igToken ? `: ${enmascarar(entorno.igToken)}` : "; ahora falta INSTAGRAM_TOKEN"}):`);
        if (entorno.igToken) decir(`Token de Instagram: ${textoDias(estadoToken(entorno), entorno.zona)} (con --de-verdad, si toca, lo renuevo antes de publicar).`);
        decir("Cuenta (solo la de proyecto):");
      } else {
        decir(`\nPedidos que haría a Meta (todos con la cabecera Authorization: Bearer y el token de .env, que no se muestra${entorno.token ? `: ${enmascarar(entorno.token)}` : "; ahora falta META_ACCESS_TOKEN"}):`);
        decir("Cuentas (solo las de proyecto):");
      }
    }
    const cuentas = igLogin ? await cuentaInstagram(cli, entorno) : await resolverCuentas(cli, entorno, { redes });
    if (!simular) {
      decir(igLogin
        ? `Cuenta: Instagram @${cuentas.igUsername} (inicio de sesión de Instagram)`
        : `Cuentas: página ${cuentas.pageName || cuentas.pageId}${cuentas.igUsername ? ` · Instagram @${cuentas.igUsername}` : ""}`);
    }
    // Ahora también se conoce el token de la página: el texto tampoco puede traerlo.
    if (texto && contieneSecreto(texto)) throw new Falla(conToken, { codigo: 2 });

    if (redes.includes("instagram")) {
      const cupo = await cupoInstagram(cli, cuentas.igId);
      if (!simular) {
        decir(`Cupo de Instagram: ${cupo.usadas} de ${cupo.total ?? "?"} publicaciones por API en las últimas 24 h`);
        if (cupo.total && cupo.usadas >= cupo.total) throw new Falla(`Instagram ya llegó al máximo de publicaciones por API (${cupo.usadas} de ${cupo.total} en 24 h): no publico. Probá más tarde.`);
      }
    }
    if (estrategia === "facebook") {
      if (simular) decir("Imágenes para Instagram (atajo --medios=facebook):");
      for (const n of necesitanUrl) n.url = await subirParaInstagram(cli, cuentas.pageId, n.archivo);
    }

    const inicio = Date.now();
    const hechos = [];
    const sinAnotar = [];
    for (const red of redes) {
      const clave = claveDe({ tanda, id, red, formato });
      const ref = `${clave}@${new Date().toISOString()}`;
      let anotado = false;
      let enviado = false;
      const hooks = {
        antesDePublicar: (extra) => {
          if (!escribir) return;
          // Última mirada al registro justo antes del pedido que publica.
          const otras = previasDe(leerRegistro(raiz), { tanda, id, red, formato }, { cualquierTanda }).filter((p) => p.ref !== ref);
          if (otras.length && !op.repetir) throw new Falla(`mientras preparaba ${NOMBRE[red]}, el registro ya tiene "${otras[0].estado}" para esta pieza: no publico dos veces lo mismo`);
          // programadoPara va desde ya: si queda dudoso y salió, resolver lo cierra como "programado".
          anotar(raiz, { ref, clave, tanda, id, red, formato, estado: "en-curso", desde: new Date().toISOString(), huella, programadoPara: programar ? unixAHoraLocal(programar, entorno.zona) : undefined, ...extra });
          anotado = true;
        },
        // El pedido que publica ya llegó a Meta (o pudo llegar): desde acá ningún error borra el registro.
        seMando: () => { enviado = true; },
      };
      if (simular) decir(`\n${NOMBRE[red]} (${describir(red, formato, imagenes, video)}):`);
      else decir(`\n${NOMBRE[red]}: ${describir(red, formato, imagenes, video)}`);
      const base = { cli, formato, imagenes, video, texto, ia: Boolean(op.ia), hooks, inicio, zona: entorno.zona };
      let r;
      try {
        r = red === "instagram"
          ? await publicarEnInstagram({
            ...base,
            igId: cuentas.igId,
            portadaUrl: necesitanUrl.find((n) => n.esPortada)?.url || null,
            videoUrl: igLogin ? necesitanUrl.find((n) => n.esVideo)?.url || null : null,
          })
          : await publicarEnFacebook({ ...base, pageId: cuentas.pageId, programar });
      } catch (e) {
        const pudoSalir = enviado || e.dudoso || e.ambiguo;
        if (anotado) {
          if (pudoSalir) {
            anotar(raiz, { ref, estado: "dudoso", nota: `${enviado ? "Meta recibió el pedido de publicar; " : ""}${e.message}` });
            decir(`\nQuedó anotado como "dudoso" en registro-meta/publicaciones.json. Mirá ${NOMBRE[red]} y cerralo:\n  - ${comoResolver({ tanda, id, red }).join("\n  - ")}`);
          } else {
            borrar(raiz, ref); // Meta rechazó el pedido que publica: no salió nada
          }
        }
        if (!simular && !pudoSalir) decir(`\nNo se publicó nada en ${NOMBRE[red]}.`);
        if (hechos.length) decir(`\nOjo: ${hechos.map((h) => `${NOMBRE[h.red]} ya quedó ${h.estado} → ${h.permalink}`).join("; ")}. Lo que falló fue ${NOMBRE[red]}.`);
        const faltan = redes.slice(redes.indexOf(red) + 1);
        if (faltan.length) decir(`${faltan.map((x) => NOMBRE[x]).join(" y ")} no se intentó: cuando resuelvas ${NOMBRE[red]}, corré lo mismo con --red=${faltan[0]}.`);
        throw e;
      }
      if (simular) continue;

      const estado = programar ? "programado" : "publicado";
      const fecha = new Date().toISOString();
      hechos.push({ red, estado, permalink: r.permalink });
      decir(`${NOMBRE[red]}: ${estado}${programar ? ` para el ${unixAHoraLocal(programar, entorno.zona)}` : ""} → ${r.permalink || "(sin link; buscalo en la app)"}`);
      if (!escribir) continue;
      anotar(raiz, {
        ref, clave, tanda, id, red, formato, estado, fecha, huella,
        id_meta: r.mediaId || r.postId || null,
        contenedor: r.contenedor || undefined,
        contenedores: r.contenedores || undefined,
        permalink: r.permalink || null,
        programadoPara: programar ? unixAHoraLocal(programar, entorno.zona) : undefined,
        cuenta: red === "instagram" ? `@${cuentas.igUsername}` : cuentas.pageName || cuentas.pageId,
      });
      anotado = false;
      // Con --repetir el usuario afirmó que lo anterior no salió: los "dudoso"/"en-curso" viejos de
      // la misma pieza quedan "descartado" (ya no bloquean ni aparecen como pendientes en estado).
      if (op.repetir) {
        for (const p of previasDe(leerRegistro(raiz), { tanda, id, red, formato }, { cualquierTanda })) {
          if (p.ref !== ref && ["dudoso", "en-curso"].includes(p.estado)) anotar(raiz, { ref: p.ref, estado: "descartado", nota: `${p.nota ? p.nota + " · " : ""}descartado: se repitió con --repetir el ${fecha.slice(0, 10)}` });
        }
      }
      // registro.md (una fila por red, con lugar para los números de los 7 días) y calendario.md (la
      // fila pasa a publicado/programado con el link). Si no se pueden escribir, lo publicado ya está
      // en publicaciones.json: se avisa y se sigue con la otra red.
      const respaldo = red === "instagram" ? `https://www.instagram.com/${cuentas.igUsername}/` : `https://www.facebook.com/${r.postId}`;
      try {
        cerrarPublicacion(raiz, {
          zona: entorno.zona, tanda, id, red, formato, estado, fila, respaldo,
          permalink: r.permalink || null,
          programadoPara: programar ? unixAHoraLocal(programar, entorno.zona) : undefined,
          nota: `API de Meta · ${formato} · id ${r.mediaId || r.postId}${programar ? ` · programado para ${unixAHoraLocal(programar, entorno.zona)}` : ""}`,
        });
      } catch (e) {
        const motivo = ["EPERM", "EBUSY", "EACCES"].includes(e.code) ? "el archivo está en solo lectura o abierto en otro programa" : e.message;
        sinAnotar.push(`${NOMBRE[red]} ${estado} → ${r.permalink || respaldo}`);
        decir(`Aviso: ${NOMBRE[red]} ya quedó ${estado}, pero no pude anotarlo en registro.md / calendario.md (${motivo}). Sigo con lo que falta.`);
      }
    }

    if (simular) {
      const necesitaPagina = !igLogin || redes.includes("facebook");
      const faltaConfig = [!usuarioEsperado(entorno) && "config.json → meta.usuarioInstagram", necesitaPagina && !paginaEsperada(entorno) && "config.json → meta.paginaFacebook"].filter(Boolean);
      decir(`\nNada se mandó: ${cli.pedidosSimulados} pedidos armados y mostrados.${faltaConfig.length ? ` Falta ${faltaConfig.join(" y ")}.` : ""}`);
      const comillas = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
      decir(`Para publicar de verdad: node herramientas/meta.mjs ${(op.argv || []).map(comillas).join(" ")} --de-verdad`);
      if (problemaAprobacion) decir("(antes, la pieza tiene que estar \"aprobado\" en calendario.md)");
    } else if (escribir && sinAnotar.length) {
      throw new Falla(`ya quedó todo publicado (${sinAnotar.join("; ")}) y está en registro-meta/publicaciones.json, pero no pude escribir registro.md / calendario.md: cerrá el programa que los tenga abiertos o sacales el "solo lectura" y anotá esos links a mano. No vuelvas a publicar.`);
    } else if (escribir) {
      decir("\nAnotado en registro-meta/publicaciones.json, registro.md y calendario.md.");
    }
    return hechos;
  }
}
