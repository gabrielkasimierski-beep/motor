// Instagram con inicio de sesión de Instagram ("Instagram API with Instagram Login", graph.instagram.com):
// quién es el token, el seguro contra cuentas ajenas y la verificación de este modo.
//
// Doc (oct-2026):
//   - .../instagram-api-with-instagram-login/get-started: GET /me?fields=user_id,username (también
//     account_type: Business o Media_Creator). "user_id: The Instagram professional account ID, <IG_ID>",
//     y es el <IG_ID> que usan /media y /media_publish. ("id" es otro: el id de la app para ese usuario.)
//   - .../instagram-api-with-instagram-login/content-publishing: mismo camino que con Facebook (contenedor →
//     status_code → media_publish), host graph.instagram.com, token en "Authorization: Bearer".
//   - Permisos de este modo: instagram_business_basic e instagram_business_content_publish.
import { Falla, decir, enmascarar } from "./entorno.mjs";
import { clienteInstagram } from "./graph.mjs";
import { explicarError } from "./errores.mjs";
import { usuarioEsperado, cupoInstagram } from "./cuentas.mjs";
import { revisarBaseUrl } from "./medios.mjs";
import { estadoToken, renovarSiCorresponde, textoDias, alertaDelToken } from "./token-instagram.mjs";

export const CAMPOS_YO = "user_id,username,account_type";
const PROFESIONALES = { BUSINESS: "Empresa", MEDIA_CREATOR: "Creador" };
export const FALTA_TOKEN = "falta INSTAGRAM_TOKEN en maquina-de-contenido/.env: generalo en el panel de la app y pegalo en la línea INSTAGRAM_TOKEN= (README.md)";

// La doc (get-started) muestra la respuesta de /me dentro de "data": [ … ]; la referencia de IG User la
// muestra plana. Se aceptan las dos.
const desenvolver = (r) => (Array.isArray(r?.data) ? r.data[0] || {} : r || {});
const usuarioDe = (yo) => String(yo.username || "").replace(/^@/, "").trim().toLowerCase();

// GET /me. Si Meta no acepta el campo account_type (code 100, campo inválido), se pide sin él: el
// tipo de cuenta es un dato de más; el usuario y el user_id son los que importan.
async function pedirYo(cli) {
  try {
    return desenvolver(await cli.get("me", { fields: CAMPOS_YO }));
  } catch (e) {
    if (e?.code !== 100) throw e;
    return desenvolver(await cli.get("me", { fields: "user_id,username" }));
  }
}

// Quién es INSTAGRAM_TOKEN. Frena si no es la cuenta de config.json (seguro contra cuentas ajenas).
export async function cuentaInstagram(cli, entorno) {
  const esperado = usuarioEsperado(entorno);
  if (cli.simular) {
    await cli.get("me", { fields: CAMPOS_YO }, { nota: `quién es INSTAGRAM_TOKEN: tiene que ser @${esperado || "(falta config.json → meta.usuarioInstagram)"}; se publica en su user_id` });
    return { igId: "<user_id>", igUsername: esperado || null, pageId: null, pageName: null };
  }
  if (!entorno.igToken) throw new Falla(FALTA_TOKEN);
  if (!esperado) throw new Falla("completá config.json → meta.usuarioInstagram con el usuario de proyecto (sin @): es el seguro para no publicar en otra cuenta");
  const yo = await pedirYo(cli);
  const usuario = usuarioDe(yo);
  // Sin usuario no se puede comparar: el seguro no puede quedar abierto.
  if (!usuario) throw new Falla(`Meta no devolvió el usuario de la cuenta de INSTAGRAM_TOKEN: no puedo confirmar que sea @${esperado}, así que no publico. Corré node herramientas/meta.mjs verificar`);
  if (usuario !== esperado) throw new Falla(`INSTAGRAM_TOKEN es de @${usuario} y config.json espera @${esperado}: este publicador es solo para las cuentas de proyecto`);
  const tipo = String(yo.account_type || "").toUpperCase();
  if (tipo && !PROFESIONALES[tipo]) throw new Falla(`@${usuario} es una cuenta de tipo ${yo.account_type}: para publicar por API tiene que ser profesional (Empresa o Creador)`);
  const igId = String(yo.user_id ?? "");
  if (!/^\d+$/.test(igId)) throw new Falla("Meta no devolvió el user_id de la cuenta (el número de la cuenta profesional): sin eso no sé dónde publicar");
  if (entorno.igUserId && entorno.igUserId !== igId) throw new Falla(`META_IG_USER_ID (${entorno.igUserId}) no es la cuenta de INSTAGRAM_TOKEN (${igId}): revisá .env (en el modo Instagram esa línea puede quedar vacía)`);
  return { igId, igUsername: usuario, tipo: tipo || null, pageId: null, pageName: null };
}

// verificar, parte de Instagram: suma a "faltas" lo que impide publicar. Solo lee (y, si toca, renueva el token).
export async function revisarInstagramLogin(entorno, faltas) {
  decir(`Verificando Instagram con inicio de sesión de Instagram (${entorno.simulador ? `simulador ${entorno.igGraph}` : new URL(entorno.igGraph).host}, ${entorno.version})…`);
  if (!entorno.igToken) throw new Falla(FALTA_TOKEN);
  decir(`Token: ${enmascarar(entorno.igToken)} (INSTAGRAM_TOKEN, no se muestra entero)`);
  const token = await renovarSiCorresponde(entorno);
  const cli = clienteInstagram(entorno, { simular: false });

  // 1. ¿Quién es? Si esto falla (190), lo demás no tiene sentido.
  let yo;
  try {
    yo = await pedirYo(cli);
  } catch (e) {
    decir(explicarError(e));
    if (e?.code === 190 || e?.code === 102) throw new Falla("el token de Instagram no sirve: no sigo verificando. Revisá que esté entero en la línea INSTAGRAM_TOKEN= de maquina-de-contenido/.env; si está bien, generá uno nuevo en el panel de la app (README.md)");
    throw new Falla("no pude leer la cuenta de Instagram (GET /me): no sigo verificando. Probá de nuevo en un rato");
  }
  const usuario = usuarioDe(yo);
  const tipo = String(yo.account_type || "").toUpperCase();
  const igId = String(yo.user_id ?? "");
  decir(`Cuenta: @${usuario || "(Meta no devolvió el usuario)"} · tipo ${yo.account_type || "(sin dato)"} · user_id ${igId || "(sin dato)"}`);

  // 2. El seguro contra cuentas ajenas.
  const esperado = usuarioEsperado(entorno);
  if (!esperado) faltas.push("falta config.json → meta.usuarioInstagram (el usuario de proyecto, sin @): es el seguro para no publicar en otra cuenta");
  else if (!usuario) faltas.push("Meta no devolvió el usuario de la cuenta: no puedo confirmar que sea la de proyecto");
  else if (usuario !== esperado) faltas.push(`INSTAGRAM_TOKEN es de @${usuario} y config.json espera @${esperado}: generá el token con la cuenta de proyecto (o, si cambió el usuario, corregí config.json)`);
  else decir(`  coincide con config.json (@${esperado}): OK`);
  if (!tipo) decir("  tipo de cuenta: Meta no lo devolvió (tiene que ser profesional: Empresa o Creador)");
  else if (!PROFESIONALES[tipo]) faltas.push(`la cuenta es de tipo ${yo.account_type}: para publicar por API tiene que ser profesional (Empresa o Creador)`);
  else decir(`  cuenta profesional (${PROFESIONALES[tipo]}): OK`);
  if (!/^\d+$/.test(igId)) faltas.push("Meta no devolvió el user_id de la cuenta: sin eso no se puede publicar");
  else if (entorno.igUserId && entorno.igUserId !== igId) faltas.push(`META_IG_USER_ID (${entorno.igUserId}) no es la cuenta de INSTAGRAM_TOKEN (${igId}): borrá esa línea de .env o corregila`);

  // 3. Permisos (este modo no tiene /me/permissions documentado: se prueban con lo que cada uno habilita)
  //    y el cupo del día. content_publishing_limit pide instagram_business_basic e instagram_business_content_publish.
  let cupo = null;
  let errorCupo = null;
  if (/^\d+$/.test(igId)) {
    try { cupo = await cupoInstagram(cli, igId); } catch (e) { errorCupo = e; }
  }
  decir("Permisos:");
  decir("  OK    instagram_business_basic (leer la cuenta: /me respondió)");
  const sinPermiso = errorCupo && (errorCupo.code === 10 || (errorCupo.code >= 200 && errorCupo.code <= 299));
  if (cupo) decir("  OK    instagram_business_content_publish (el cupo de publicación lo pide y respondió)");
  else if (errorCupo) decir(`  ${sinPermiso ? "FALTA" : "??   "} instagram_business_content_publish (publicar)`);
  decir("  --    instagram_business_manage_insights (opcional: para leer números; el publicador no lo usa)");
  if (cupo) {
    decir(`Cupo de Instagram: ${cupo.usadas} de ${cupo.total ?? "?"} publicaciones por API en las últimas ${Math.round(cupo.duracion / 3600)} h`);
    if (cupo.total && cupo.usadas >= cupo.total) faltas.push("Instagram ya llegó al cupo de publicaciones por API de las últimas 24 h");
  } else if (errorCupo) {
    decir(explicarError(errorCupo));
    // La doc se contradice sobre qué número va en /<id>/media: la guía de inicio dice user_id (<IG_ID>)
    // y la referencia de media_publish, "app-scoped user ID". Si Meta no reconoce el user_id, se dice claro.
    const idRaro = errorCupo.code === 100 && (errorCupo.subcode === 33 || /does not exist|nonexist/i.test(String(errorCupo.original || "")));
    faltas.push(sinPermiso
      ? "falta el permiso instagram_business_content_publish: sumalo en el panel de la app y generá el token de nuevo (README.md)"
      : idRaro
        ? `Meta no reconoce el user_id ${igId} para publicar (la doc dice dos cosas distintas sobre qué número usar): no publiques y avisale a Claude con este mensaje`
        : "no pude leer el cupo de publicaciones (content_publishing_limit)");
  }

  // 4. El token: cuánto le queda. Vencido, o a menos de una semana sin poder renovarlo: "Qué falta".
  //    (antes de la primera renovación, con el tope seguro de 60 días desde que se vio por primera vez)
  const est = token || estadoToken(entorno);
  decir(`Token: ${textoDias(est, entorno.zona)}`);
  const alerta = alertaDelToken(est, entorno.zona);
  if (alerta?.ojo) decir(`  Ojo: ${alerta.texto}.`);
  else if (alerta) faltas.push(alerta.texto);

  // 5. Dónde baja Instagram las imágenes y los videos.
  try {
    const base = revisarBaseUrl(entorno.config.medios?.baseUrl || "");
    if (base) decir(`Medios: ${base} (de ahí baja Instagram las imágenes y los videos)`);
    else faltas.push("config.json → medios.baseUrl está vacío: Instagram baja las imágenes y los videos de una URL pública, así que hasta completarlo no se puede publicar (la conexión con Instagram sí está; README.md)");
  } catch (e) {
    faltas.push(e.message);
  }
}

export const ojoInstagram = (entorno) =>
  `Ojo: la app está en modo desarrollo y @${usuarioEsperado(entorno) || "la cuenta"} entra como evaluadora de Instagram; la doc de Meta no dice si lo publicado así lo ve todo el mundo. Abrí la primera publicación en una ventana privada antes de publicar la segunda (README.md).`;
