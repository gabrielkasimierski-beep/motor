// Lee y actualiza las tablas de calendario.md y registro.md (Markdown con tablas de |).
// En calendario.md la columna Carpeta trae salidas/<tanda>/<id>/; en las tablas sin Carpeta
// (historias, reels) la pieza es el archivo entre comillas invertidas: `perfil/<id>.png`,
// `guiones/<id>.md`. Nunca se busca en la celda Estado ni por una palabra suelta.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Falla, escribirArchivo } from "./entorno.mjs";
import { hoyLocal } from "./tiempo.mjs";

const ORDEN = ["idea", "para-aprobar", "aprobado", "programado", "publicado"];

function celdas(linea) {
  const t = linea.trim();
  if (!t.startsWith("|") || !t.endsWith("|") || t.length < 2) return null;
  return t.slice(1, -1).split("|").map((c) => c.trim());
}

export function leerTablas(md) {
  const eol = md.includes("\r\n") ? "\r\n" : "\n";
  const lineas = md.split(/\r?\n/);
  const tablas = [];
  for (let i = 0; i < lineas.length - 1; i++) {
    const enc = celdas(lineas[i]);
    const sep = celdas(lineas[i + 1]);
    if (!enc || !sep || !sep.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    const tabla = { linea: i, encabezados: enc, filas: [] };
    let j = i + 2;
    for (; j < lineas.length && celdas(lineas[j]); j++) tabla.filas.push({ linea: j, celdas: celdas(lineas[j]) });
    tablas.push(tabla);
    i = j - 1;
  }
  return { eol, lineas, tablas };
}

const limpiar = (c) => String(c || "").replace(/[`*]/g, "").trim();
const columna = (tabla, nombre) => tabla.encabezados.findIndex((e) => limpiar(e).toLowerCase() === nombre);

// El estado tiene que estar escrito tal cual: "aprobado?", "Aprobado", "**aprobado**" o
// "aprobado (falta la persona responsable)" NO son "aprobado". El agregado "(…)" vale solo para publicado y
// programado, que lo escribe esta herramienta con los links. Lo que no encaja se devuelve entero.
export function estadoDe(celda) {
  const c = String(celda || "").trim();
  if (/^(idea|para-aprobar|aprobado)$/.test(c)) return c;
  const m = c.match(/^(programado|publicado)(\s+\(.*\))?$/);
  return m ? m[1] : c;
}

// Los archivos citados entre comillas invertidas en una celda, sin la extensión: `perfil/historia-hola.png` → historia-hola.
const archivosCitados = (celda) => [...String(celda || "").matchAll(/`([^`]+)`/g)].map((m) => m[1].trim().replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, ""));

export function buscarPieza(md, tanda, id) {
  const { tablas } = leerTablas(md);
  const carpeta = `salidas/${tanda}/${id}`;
  const hallados = [];
  for (const tabla of tablas) {
    const iEstado = columna(tabla, "estado");
    if (iEstado === -1) continue;
    const iCarpeta = columna(tabla, "carpeta");
    for (const fila of tabla.filas) {
      const coincide = iCarpeta !== -1
        ? limpiar(fila.celdas[iCarpeta]).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "") === carpeta
        : fila.celdas.some((c, i) => i !== iEstado && archivosCitados(c).includes(id));
      if (!coincide) continue;
      const iNombre = ["pieza", "historia", "guion"].map((n) => columna(tabla, n)).find((i) => i !== -1);
      const iClave = columna(tabla, "palabra clave");
      hallados.push({
        linea: fila.linea,
        // Una fila sin Carpeta (historias, reels) no dice de qué tanda es: la tanda la ata
        // publicar/<tanda>/<id>/, de donde --de-verdad exige sacar todos los archivos.
        estado: estadoDe(fila.celdas[iEstado]),
        // Sin columna Carpeta (historias, reels) la fila no dice la tanda: el control contra
        // duplicados no mira la tanda (registro.mjs → previasDe).
        porCarpeta: iCarpeta !== -1,
        nombre: iNombre !== undefined ? limpiar(fila.celdas[iNombre]) : id,
        palabraClave: iClave !== -1 ? limpiar(fila.celdas[iClave]) : "",
      });
    }
  }
  if (hallados.length > 1) throw new Falla(`hay ${hallados.length} filas de calendario.md que coinciden con "${id}": dejá una sola`);
  return hallados[0] || null;
}

// Pasa la fila a "publicado"/"programado" y suma los enlaces sin perder los que ya tenía.
export function actualizarEstado(md, tanda, id, { estado, enlaces }) {
  const hallado = buscarPieza(md, tanda, id);
  if (!hallado) throw new Falla(`no encuentro "${id}" en calendario.md para actualizarlo`);
  const { eol, lineas, tablas } = leerTablas(md);
  const tabla = tablas.find((t) => t.filas.some((f) => f.linea === hallado.linea));
  const fila = tabla.filas.find((f) => f.linea === hallado.linea);
  const iEstado = columna(tabla, "estado");
  const previos = [...fila.celdas[iEstado].matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ etiqueta: m[1], url: m[2] }));
  const clave = (e) => e.etiqueta.replace(/ programado.*$/, "");
  const todos = [...previos.filter((p) => !enlaces.some((n) => clave(n) === clave(p))), ...enlaces];
  const actual = estadoDe(fila.celdas[iEstado]);
  const final = ORDEN.indexOf(actual) > ORDEN.indexOf(estado) ? actual : estado;
  fila.celdas[iEstado] = todos.length ? `${final} (${todos.map((e) => `[${e.etiqueta}](${e.url})`).join(" · ")})` : final;
  lineas[fila.linea] = `| ${fila.celdas.join(" | ")} |`;
  return lineas.join(eol);
}

// Suma una fila a la primera tabla de registro.md que tenga Fecha y Link.
export function agregarFilaRegistro(md, valores) {
  const { eol, lineas, tablas } = leerTablas(md);
  const tabla = tablas.find((t) => columna(t, "fecha") === 0 && columna(t, "link") !== -1);
  const fila = `| ${valores.map((v) => String(v ?? "").replace(/\|/g, "/").replace(/\r?\n/g, " ")).join(" | ")} |`;
  if (!tabla) {
    const encabezado = "| Fecha | Pieza | Red | Link | Alcance | Guardados | Compartidos | Mensajes | Palabra clave | Notas |";
    return md.replace(/\s*$/, "") + eol + eol + encabezado + eol + "|---|---|---|---|---|---|---|---|---|---|" + eol + fila + eol;
  }
  const ultima = tabla.filas.length ? tabla.filas.at(-1).linea : tabla.linea + 1;
  lineas.splice(ultima + 1, 0, fila);
  return lineas.join(eol);
}

const NOMBRE = { instagram: "Instagram", facebook: "Facebook" };
const CORTO = { instagram: "IG", facebook: "FB" };

// Lo que se anota cuando algo quedó publicado o programado (lo usan publicar y resolver):
// una fila en registro.md, con lugar para los números de los 7 días, y la fila de calendario.md
// pasa a publicado/programado con el link (o el de respaldo si Meta no dio uno).
export function cerrarPublicacion(raiz, { zona, tanda, id, red, formato, estado, permalink, respaldo, programadoPara, fila, nota }) {
  const archivoReg = join(raiz, "registro.md");
  const mdReg = existsSync(archivoReg) ? readFileSync(archivoReg, "utf8") : "# Registro\n";
  escribirArchivo(archivoReg, agregarFilaRegistro(mdReg, [hoyLocal(zona), fila?.nombre || id, `${NOMBRE[red]} (${formato})`, permalink || "", "", "", "", "", fila?.palabraClave || "", nota]));
  const archivoCal = join(raiz, "calendario.md");
  const mdCal = readFileSync(archivoCal, "utf8");
  const etiqueta = `${CORTO[red]}${["historia", "reel"].includes(formato) ? " " + formato : ""}${programadoPara ? ` programado ${programadoPara}` : ""}`;
  escribirArchivo(archivoCal, actualizarEstado(mdCal, tanda, id, { estado, enlaces: [{ etiqueta, url: permalink || respaldo }] }));
}
