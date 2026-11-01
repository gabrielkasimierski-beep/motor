// resolver: cierra a mano un "dudoso" o un "en-curso" de registro-meta/publicaciones.json después de
// mirar la cuenta. No habla con Meta.
//   --salio=no → se borra la entrada (y se puede volver a publicar sin --repetir).
//   --salio=si --link=<url> → queda "publicado" (o "programado") y se completan calendario.md y
//                             registro.md, como si el publicador lo hubiera confirmado.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Falla, decir } from "./entorno.mjs";
import { buscarPieza, cerrarPublicacion } from "./calendario.mjs";
import { leerRegistro, anotar, borrar, tomarCandado } from "./registro.mjs";

const NOMBRE = { instagram: "Instagram", facebook: "Facebook" };
const HOSTS = {
  instagram: ["www.instagram.com", "instagram.com"],
  facebook: ["www.facebook.com", "facebook.com", "m.facebook.com", "web.facebook.com"],
};
const ABIERTOS = ["dudoso", "en-curso"];

export function resolver(op, entorno) {
  const { tanda, id, red, salio } = op;
  const deOtro = ["video", "portada", "imagen", "texto", "programar", "medios", "deVerdad", "repetir", "ia"].filter((k) => op[k]);
  if (deOtro.length) throw new Falla("resolver lleva solo --tanda, --id, --red, --salio, --link y --formato (no habla con Meta ni publica)", { codigo: 2 });
  if (!tanda || !id) throw new Falla("faltan --tanda=<tanda> y --id=<pieza>", { codigo: 2 });
  if (!["instagram", "facebook"].includes(red)) throw new Falla("--red tiene que ser instagram o facebook (se resuelve de a una red)", { codigo: 2 });
  if (!["si", "no"].includes(salio)) throw new Falla("falta --salio=si o --salio=no (lo que viste en la cuenta)", { codigo: 2 });
  let link = null;
  if (salio === "si") {
    if (!op.link) throw new Falla(`con --salio=si va el link de la publicación: --link=https://www.${red}.com/…`, { codigo: 2 });
    let u = null;
    try { u = new URL(op.link); } catch { /* se avisa abajo */ }
    if (!u || u.protocol !== "https:" || !HOSTS[red].includes(u.hostname)) {
      throw new Falla(`--link tiene que ser el link de ${NOMBRE[red]} (https://www.${red}.com/…)`, { codigo: 2 });
    }
    link = u.href;
  } else if (op.link) throw new Falla("--link va solo con --salio=si", { codigo: 2 });

  const raiz = entorno.raiz;
  const soltar = tomarCandado(raiz);
  try {
    const archivoCal = join(raiz, "calendario.md");
    const md = existsSync(archivoCal) ? readFileSync(archivoCal, "utf8") : null;
    const fila = md ? buscarPieza(md, tanda, id) : null;
    // Historias y reels (fila sin Carpeta): la tanda no la distingue, igual que al publicar.
    const cualquierTanda = fila ? !fila.porCarpeta : false;
    const abiertas = leerRegistro(raiz).publicaciones.filter((p) =>
      p.id === id && p.red === red && ABIERTOS.includes(p.estado) && (cualquierTanda || p.tanda === tanda) && (!op.formato || p.formato === op.formato));
    if (!abiertas.length) {
      throw new Falla(`no hay nada "dudoso" ni "en-curso" de ${tanda}/${id} en ${NOMBRE[red]}${op.formato ? ` (${op.formato})` : ""}: mirá node herramientas/meta.mjs estado`);
    }
    const formatos = [...new Set(abiertas.map((p) => p.formato))];
    if (formatos.length > 1) throw new Falla(`hay entradas abiertas de varios formatos (${formatos.join(", ")}): elegí uno con --formato=…`, { codigo: 2 });
    const formato = formatos[0];

    if (salio === "no") {
      for (const p of abiertas) borrar(raiz, p.ref);
      decir(`Listo: saqué ${abiertas.length === 1 ? "la entrada" : `las ${abiertas.length} entradas`} de ${tanda}/${id} en ${NOMBRE[red]} (${formato}) del registro. Ya se puede publicar de nuevo solo en esa red (--red=${red}), primero en simulación.`);
      return;
    }

    // Salió: la más nueva queda publicada; si había otras abiertas de la misma pieza, se descartan.
    const ordenadas = [...abiertas].sort((a, b) => String(b.desde || "").localeCompare(String(a.desde || "")));
    const [elegida, ...resto] = ordenadas;
    const estado = elegida.programadoPara ? "programado" : "publicado";
    const fecha = new Date().toISOString();
    anotar(raiz, { ref: elegida.ref, estado, fecha, permalink: link, nota: `${elegida.nota ? elegida.nota + " · " : ""}confirmado a mano el ${fecha.slice(0, 10)}` });
    for (const p of resto) anotar(raiz, { ref: p.ref, estado: "descartado", nota: `${p.nota ? p.nota + " · " : ""}descartado al resolver a mano el ${fecha.slice(0, 10)}` });
    if (!fila) {
      decir(`Anotado como "${estado}" en registro-meta/publicaciones.json, pero no encuentro la pieza en calendario.md: sumá el link a mano ahí y en registro.md.`);
      return;
    }
    try {
      cerrarPublicacion(raiz, {
        zona: entorno.zona, tanda: elegida.tanda, id, red, formato, estado, fila, permalink: link,
        programadoPara: elegida.programadoPara,
        nota: `API de Meta · ${formato} · confirmado a mano`,
      });
    } catch (e) {
      const motivo = ["EPERM", "EBUSY", "EACCES"].includes(e.code) ? "el archivo está en solo lectura o abierto en otro programa" : e.message;
      throw new Falla(`quedó "${estado}" en registro-meta/publicaciones.json, pero no pude escribir registro.md / calendario.md (${motivo}): anotá el link a mano ahí`);
    }
    decir(`Listo: ${tanda}/${id} quedó "${estado}" en ${NOMBRE[red]} → ${link}. Anotado en registro-meta/publicaciones.json, registro.md y calendario.md.`);
  } finally {
    soltar();
  }
}
