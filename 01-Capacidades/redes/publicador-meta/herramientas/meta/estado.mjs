// estado: lo que este publicador mandó (registro-meta/publicaciones.json) y el cupo de Instagram del día.
import { decir } from "./entorno.mjs";
import { crearCliente, clienteInstagram } from "./graph.mjs";
import { explicarError } from "./errores.mjs";
import { leerRegistro, comoResolver } from "./registro.mjs";
import { cupoInstagram } from "./cuentas.mjs";
import { cuentaInstagram } from "./instagram-login.mjs";
import { estadoToken, textoDias } from "./token-instagram.mjs";

export async function estado(entorno) {
  const { publicaciones } = leerRegistro(entorno.raiz);
  decir(`Publicado con la API de Meta (registro-meta/publicaciones.json): ${publicaciones.length}`);
  for (const p of [...publicaciones].sort((a, b) => String(a.fecha || a.desde).localeCompare(String(b.fecha || b.desde)))) {
    const cuando = String(p.fecha || p.desde || "").replace("T", " ").slice(0, 16);
    decir(`  ${cuando}  ${p.tanda}/${p.id}  ${p.red} ${p.formato}  ${p.estado}${p.programadoPara ? " para " + p.programadoPara : ""}${p.permalink ? "  " + p.permalink : ""}`);
    // "descartado": un dudoso que se repitió con --repetir o se resolvió a mano; queda solo como historia.
    if (["en-curso", "dudoso"].includes(p.estado)) {
      decir(p.estado === "en-curso"
        ? "      ↳ una corrida quedó a mitad (se cortó): mirá la cuenta antes de repetir y cerralo:"
        : `      ↳ no se pudo confirmar si salió (${p.nota || "sin detalle"}): mirá la cuenta antes de repetir y cerralo:`);
      for (const linea of comoResolver(p)) decir(`          ${linea}`);
    }
  }

  // Modo Instagram (o mixto): el cupo y el vencimiento son del token de Instagram. Solo lee: no renueva.
  if (entorno.modo !== "facebook") {
    if (!entorno.igToken) { decir("\nCupo de Instagram: sin INSTAGRAM_TOKEN en .env no lo puedo consultar."); return; }
    decir(`\nToken de Instagram: ${textoDias(estadoToken(entorno), entorno.zona)}.`);
    const cli = clienteInstagram(entorno, { simular: false });
    try {
      const { igId } = await cuentaInstagram(cli, entorno);
      const cupo = await cupoInstagram(cli, igId);
      decir(`Cupo de Instagram: ${cupo.usadas} de ${cupo.total ?? "?"} publicaciones por API en las últimas 24 h (quedan ${cupo.total != null ? Math.max(0, cupo.total - cupo.usadas) : "?"}).`);
    } catch (e) {
      decir("No pude leer el cupo de Instagram:");
      decir(explicarError(e));
    }
    return;
  }
  if (!entorno.token) { decir("\nCupo de Instagram: sin token en .env no lo puedo consultar."); return; }
  const cli = crearCliente(entorno, { simular: false });
  try {
    let igId = entorno.igUserId;
    if (!igId && entorno.pageId) igId = (await cli.get(entorno.pageId, { fields: "instagram_business_account" })).instagram_business_account?.id;
    if (!igId) { decir("\nCupo de Instagram: falta META_PAGE_ID (o META_IG_USER_ID) en .env."); return; }
    const cupo = await cupoInstagram(cli, igId);
    decir(`\nCupo de Instagram: ${cupo.usadas} de ${cupo.total ?? "?"} publicaciones por API en las últimas 24 h (quedan ${cupo.total != null ? Math.max(0, cupo.total - cupo.usadas) : "?"}).`);
  } catch (e) {
    decir("\nNo pude leer el cupo de Instagram:");
    decir(explicarError(e));
  }
}
