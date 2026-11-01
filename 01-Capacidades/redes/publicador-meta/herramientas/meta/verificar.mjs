// verificar: con el token de .env pregunta a Meta quién es, qué página y qué Instagram ve, qué
// permisos tiene y cuánto cupo queda. Solo lee: no publica nada. Nunca muestra el token.
// No usa debug_token: ese pedido lleva el token en la URL (y además pide un token de la app).
// Cuándo vence el token de Facebook se mira en el Depurador de tokens de Meta (README.md).
// En el modo Instagram (INSTAGRAM_TOKEN) la parte de Instagram está en instagram-login.mjs: ahí el
// vencimiento sale de registro-meta/token-instagram.json y, si toca, renueva el token.
import { Falla, decir, enmascarar } from "./entorno.mjs";
import { crearCliente } from "./graph.mjs";
import { explicarError } from "./errores.mjs";
import { usuarioEsperado, cupoInstagram, problemaDePagina, paginaEsperada } from "./cuentas.mjs";
import { revisarInstagramLogin, ojoInstagram } from "./instagram-login.mjs";

// [permiso, para qué, alternativas que también sirven]
const NECESARIOS = [
  ["instagram_basic", "leer la cuenta de Instagram"],
  // La doc lo escribe de las dos formas (referencias: instagram_content_publish; caso de uso: instagram_content_publishing).
  ["instagram_content_publish", "publicar en Instagram", ["instagram_content_publishing"]],
  ["pages_show_list", "ver la página"],
  ["pages_read_engagement", "leer la página; lo piden Instagram y Facebook"],
  ["pages_manage_posts", "publicar en la página de Facebook"],
  ["business_management", "las historias de Facebook lo piden con usuario del sistema"],
  // Referencias de Instagram (media, media_publish, IG User, content_publishing_limit, stories): con un rol
  // dado por el portfolio comercial (el usuario del sistema) hace falta "one of: ads_management, ads_read".
  ["ads_read", "Instagram lo pide (o ads_management) cuando la página está asignada desde el portfolio comercial", ["ads_management"]],
];
// Los que son solo para Instagram por la página (en modo mixto Instagram va con INSTAGRAM_TOKEN).
const DE_INSTAGRAM = new Set(["instagram_basic", "instagram_content_publish", "ads_read"]);
const OPCIONALES = [
  // La referencia de permisos lo pone como dependencia de instagram_basic; el caso de uso de Instagram no lo agrega.
  ["pages_read_user_content", "la referencia de permisos lo pone como dependencia de instagram_basic; si el diálogo del token lo ofrece, marcalo (no publica nada)"],
  ["publish_video", "según la referencia de permisos es para video en vivo: los reels e historias (video_reels, video_stories) no lo piden"],
];

// La doc de Meta (App modes): "Any data generated while an app is in Development mode, such as test
// posts, can only be seen by role users". Para Instagram no hay nada escrito.
const OJO_FACEBOOK = "Ojo: si la app no está publicada (Live), en Facebook la doc de Meta dice que lo publicado lo ven solo quienes tienen rol en la app; en Instagram no está documentado. Abrí la primera publicación en una ventana privada antes de publicar la segunda (README.md).";

// Según el modo (lo decide .env): Instagram con inicio de sesión de Instagram, Facebook (el camino de
// antes) o los dos. Termina en "Todo en orden" solo si no falta nada.
export async function verificar(entorno) {
  const faltas = [];
  if (entorno.modo === "facebook") {
    await revisarFacebook(entorno, faltas, { conInstagram: true });
    return cerrar(faltas, [OJO_FACEBOOK]);
  }
  await revisarInstagramLogin(entorno, faltas);
  decir("");
  if (entorno.modo === "mixto") {
    decir("Facebook (META_ACCESS_TOKEN, solo para --red=facebook):");
    await revisarFacebook(entorno, faltas, { conInstagram: false });
    return cerrar(faltas, [ojoInstagram(entorno), OJO_FACEBOOK]);
  }
  decir("Facebook: todavía no está conectado (falta el portfolio); por ahora solo Instagram.");
  return cerrar(faltas, [ojoInstagram(entorno)]);
}

function cerrar(faltas, ojos) {
  decir("");
  if (faltas.length) {
    decir("Qué falta:");
    for (const f of faltas) decir(`  - ${f}`);
    return false;
  }
  decir("Todo en orden: ya se puede publicar (primero en simulación, después con --de-verdad).");
  for (const o of ojos) decir(o);
  return true;
}

// conInstagram=false (modo mixto): Instagram va por el inicio de sesión de Instagram, así que del token
// de Facebook solo se revisa lo de la página.
async function revisarFacebook(entorno, faltas, { conInstagram }) {
  decir(`Verificando la conexión con Meta (Graph API ${entorno.version}${entorno.simulador ? `, simulador ${entorno.graph}` : ""})…`);
  if (!entorno.token) throw new Falla("falta META_ACCESS_TOKEN en maquina-de-contenido/.env: seguí README.md (y copiá .env.ejemplo a .env)");
  decir(`Token: ${enmascarar(entorno.token)} (no se muestra entero)`);
  const cli = crearCliente(entorno, { simular: false });

  // 1. ¿Quién es el token? Si esto falla (190), lo demás no tiene sentido.
  let yo;
  try {
    yo = await cli.get("me", { fields: "id,name" });
  } catch (e) {
    decir(explicarError(e));
    throw new Falla("el token no sirve: no sigo verificando");
  }
  const esDePagina = Boolean(entorno.pageId && yo.id === entorno.pageId);
  decir(`  es de: ${yo.name || "(sin nombre)"} (id ${yo.id})${esDePagina ? " → es un token de la página" : ""}`);
  decir("  vence: miralo en el Depurador de tokens de Meta (developers.facebook.com/tools/debug/accesstoken); el del usuario del sistema con caducidad \"Nunca\" no vence");

  // 2. Permisos: /me/permissions (no expone el token).
  let concedidos = null;
  try {
    const { data = [] } = await cli.get("me/permissions");
    concedidos = new Set(data.filter((p) => p.status === "granted").map((p) => p.permission));
  } catch {
    concedidos = null;
  }

  decir("Permisos:");
  if (!concedidos) {
    decir("  no pude leerlos (con un token de página Meta no siempre los muestra): miralos en el Depurador de tokens de developers.facebook.com");
  } else {
    for (const [p, para, otros = []] of NECESARIOS.filter(([x]) => conInstagram || !DE_INSTAGRAM.has(x))) {
      const ok = [p, ...otros].some((x) => concedidos.has(x));
      decir(`  ${ok ? "OK   " : "FALTA"} ${p}${otros.length ? ` (o ${otros.join(" / ")})` : ""} (${para})`);
      if (!ok) faltas.push(`falta el permiso ${p}${otros.length ? ` (o ${otros.join(" / ")})` : ""}: ${para}. Generá el token de nuevo con ese permiso (README.md)`);
    }
    for (const [p, para] of OPCIONALES.filter(([x]) => conInstagram || x !== "pages_read_user_content")) {
      decir(`  ${concedidos.has(p) ? "OK   " : "--   "} ${p} (opcional: ${para})`);
    }
    // Las referencias de Instagram piden uno de los dos; la guía general de publicación los lista a los dos.
    if (conInstagram && concedidos.has("ads_read") && !concedidos.has("ads_management")) {
      decir("  (ads_read alcanza según las referencias de Instagram; la guía general de publicación nombra también ads_management: si Instagram lo pide, generá el token de nuevo sumándolo)");
    }
  }

  // 3. La página.
  if (!entorno.pageId) {
    faltas.push("falta META_PAGE_ID en .env (el número de la página de Facebook de proyecto)");
    try {
      const { data = [] } = await cli.get("me/accounts", { fields: "id,name" });
      if (data.length) decir(`Páginas que ve el token: ${data.map((p) => `${p.name} (${p.id})`).join(", ")}`);
    } catch { /* un token de página no tiene /me/accounts */ }
  } else {
    let pagina = null;
    try {
      pagina = await cli.get(entorno.pageId, { fields: "id,name,instagram_business_account" });
      decir(`Página: ${pagina.name} (id ${pagina.id})`);
    } catch (e) {
      decir(explicarError(e));
      faltas.push("el token no ve la página META_PAGE_ID: asignale la página al usuario del sistema (o revisá el número)");
    }
    // Nada de páginas de terceros: tiene que ser la de config.json.
    const problema = problemaDePagina(entorno, pagina?.id);
    if (problema) faltas.push(paginaEsperada(entorno) || !pagina ? problema : `${problema}. Si "${pagina.name}" es la de proyecto, poné "paginaFacebook": "${pagina.id}"`);
    else if (pagina) decir(`  coincide con config.json (página ${paginaEsperada(entorno)}): OK`);
    if (pagina) {
      try {
        const r = await cli.get(entorno.pageId, { fields: "access_token" });
        if (r.access_token) { cli.usarTokenPagina(r.access_token); decir("  token de la página: lo consigo (se usa en memoria, no se guarda ni se muestra)"); }
        else decir("  token de la página: uso el mismo de .env");
      } catch {
        decir("  token de la página: uso el mismo de .env");
      }

      // 4. El Instagram vinculado (en modo mixto Instagram va por su propio token: no se mira acá).
      if (!conInstagram) return;
      const vinculado = pagina.instagram_business_account?.id || null;
      const igId = entorno.igUserId || vinculado;
      const esperado = usuarioEsperado(entorno);
      if (entorno.igUserId && vinculado && entorno.igUserId !== vinculado) faltas.push(`META_IG_USER_ID (${entorno.igUserId}) no es el Instagram vinculado a la página (${vinculado})`);
      if (!igId) {
        faltas.push("la página no tiene un Instagram profesional vinculado (README.md)");
      } else {
        try {
          const ig = await cli.get(igId, { fields: "id,username" });
          decir(`Instagram: @${ig.username} (id ${ig.id})${entorno.igUserId ? "" : " (lo saqué de la página; podés fijarlo en META_IG_USER_ID)"}`);
          if (!esperado) faltas.push("falta config.json → meta.usuarioInstagram (el usuario de proyecto, sin @): es el seguro para no publicar en otra cuenta");
          else if (String(ig.username).toLowerCase() !== esperado) faltas.push(`la cuenta vinculada es @${ig.username} y config.json espera @${esperado}`);
          else decir(`  coincide con config.json (@${esperado}): OK`);
        } catch (e) {
          decir(explicarError(e));
          // Si Meta nombra ads_management, el token ya puede tener ads_read: lo que falta es el otro.
          if (/ads_management/i.test(String(e?.original || e?.message || ""))) faltas.push("Instagram pide ads_management: generá el token de nuevo sumando ads_management (además de ads_read) (README.md)");
          else faltas.push("no pude leer la cuenta de Instagram (¿falta instagram_basic, ads_read o asignarla al usuario del sistema?)");
        }
        try {
          const cupo = await cupoInstagram(cli, igId);
          decir(`Cupo de Instagram: ${cupo.usadas} de ${cupo.total ?? "?"} publicaciones por API en las últimas ${Math.round(cupo.duracion / 3600)} h`);
          if (cupo.total && cupo.usadas >= cupo.total) faltas.push("Instagram ya llegó al cupo de publicaciones por API de las últimas 24 h");
        } catch (e) {
          decir(explicarError(e));
          faltas.push("no pude leer el cupo de publicaciones (content_publishing_limit)");
        }
      }
    }
  }

}
