// Qué página y qué Instagram: solo las cuentas propias de proyecto. Dos seguros:
//   - la página: META_PAGE_ID (y lo que devuelve Meta) tiene que ser config.json → meta.paginaFacebook;
//   - el Instagram vinculado tiene que ser config.json → meta.usuarioInstagram.
// config.json va en el repositorio y se revisa; .env no: así un .env de otro proyecto (o un token
// con páginas de clientes) no alcanza para publicar en una cuenta ajena.
import { Falla } from "./entorno.mjs";

export const usuarioEsperado = (entorno) => String(entorno.config.meta?.usuarioInstagram || "").replace(/^@/, "").trim().toLowerCase();
export const paginaEsperada = (entorno) => String(entorno.config.meta?.paginaFacebook || "").trim();

// Devuelve el problema (texto) o null si la página es la de proyecto.
export function problemaDePagina(entorno, idDeMeta) {
  const esperada = paginaEsperada(entorno);
  if (!esperada) return "falta config.json → meta.paginaFacebook (el número de la página de proyecto): es el seguro para no publicar en otra página";
  if (!/^\d+$/.test(esperada)) return "config.json → meta.paginaFacebook tiene que ser el número de la página (solo dígitos)";
  if (entorno.pageId && entorno.pageId !== esperada) return `META_PAGE_ID (${entorno.pageId}) no es la página de proyecto de config.json (${esperada}): este publicador es solo para las cuentas de proyecto`;
  if (idDeMeta && String(idDeMeta) !== esperada) return `Meta devolvió la página ${idDeMeta} y config.json espera ${esperada}: este publicador es solo para las cuentas de proyecto`;
  return null;
}

export async function resolverCuentas(cli, entorno, { redes }) {
  const esperado = usuarioEsperado(entorno);
  const necesitaIg = redes.includes("instagram");

  if (cli.simular) {
    const pageId = entorno.pageId || "<META_PAGE_ID>";
    const igId = entorno.igUserId || "<IG_USER_ID>";
    await cli.get(pageId, { fields: "id,name,instagram_business_account" }, { nota: `tiene que ser la página ${paginaEsperada(entorno) || "(falta config.json → meta.paginaFacebook)"}` });
    await cli.get(pageId, { fields: "access_token" }, { nota: "token de la página: se usa en memoria, nunca se muestra" });
    if (necesitaIg) await cli.get(igId, { fields: "id,username" }, { nota: `tiene que ser @${esperado || "(falta config.json → meta.usuarioInstagram)"}` });
    return { pageId, igId, igUsername: esperado || null, pageName: null };
  }

  if (!entorno.token) throw new Falla("falta META_ACCESS_TOKEN en maquina-de-contenido/.env (ver .env.ejemplo y README.md)");
  if (!entorno.pageId) throw new Falla("falta META_PAGE_ID en maquina-de-contenido/.env (el número de la página de Facebook de proyecto)");
  // Antes de pedir nada: la página de .env tiene que ser la de config.json.
  const antes = problemaDePagina(entorno, null);
  if (antes) throw new Falla(antes);

  const pagina = await cli.get(entorno.pageId, { fields: "id,name,instagram_business_account" });
  const despues = problemaDePagina(entorno, pagina.id);
  if (despues) throw new Falla(despues);
  // Con un token de usuario del sistema, Facebook pide el token de la página para publicar en ella.
  try {
    const conToken = await cli.get(entorno.pageId, { fields: "access_token" });
    if (conToken.access_token) cli.usarTokenPagina(conToken.access_token);
  } catch {
    // Si el token de .env ya es de la página, Meta puede no devolver otro: se usa el mismo.
  }

  const vinculado = pagina.instagram_business_account?.id || null;
  if (entorno.igUserId && vinculado && entorno.igUserId !== vinculado) {
    throw new Falla(`META_IG_USER_ID (${entorno.igUserId}) no es el Instagram vinculado a la página (${vinculado}): revisá .env`);
  }
  const igId = entorno.igUserId || vinculado;
  let igUsername = null;
  if (igId) igUsername = String((await cli.get(igId, { fields: "id,username" })).username || "").toLowerCase() || null;

  if (necesitaIg) {
    if (!igId) throw new Falla(`la página "${pagina.name}" no tiene un Instagram profesional vinculado (ver README.md)`);
    if (!esperado) throw new Falla("completá config.json → meta.usuarioInstagram con el usuario de proyecto (sin @): es el seguro para no publicar en otra cuenta");
    // Sin usuario no se puede comparar: el seguro no puede quedar abierto.
    if (!igUsername) throw new Falla(`Meta no devolvió el usuario de la cuenta de Instagram ${igId}: no puedo confirmar que sea @${esperado}, así que no publico ahí. Corré node herramientas/meta.mjs verificar`);
  }
  if (igUsername && esperado && igUsername !== esperado) {
    throw new Falla(`la cuenta vinculada es @${igUsername} y config.json espera @${esperado}: este publicador es solo para las cuentas de proyecto`);
  }
  return { pageId: entorno.pageId, pageName: pagina.name || null, igId, igUsername };
}

export async function cupoInstagram(cli, igId) {
  const r = await cli.get(`${igId}/content_publishing_limit`, { fields: "quota_usage,config" }, {
    simulado: { data: [{ quota_usage: 0, config: { quota_total: 50, quota_duration: 86400 } }] },
    nota: "cupo de publicaciones por API de las últimas 24 h",
  });
  const d = r.data?.[0] || {};
  return { usadas: Number(d.quota_usage ?? 0), total: Number(d.config?.quota_total ?? 0) || null, duracion: Number(d.config?.quota_duration ?? 86400) };
}
