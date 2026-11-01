// registro-meta/publicaciones.json: lo que este publicador mandó a Meta, por tanda + pieza + red + formato.
// Sirve para no publicar dos veces lo mismo. Estados:
//   en-curso  → se mandó el pedido de publicar y todavía no hubo respuesta (si queda así, se cortó a mitad)
//   dudoso    → no se pudo confirmar si salió: hay que mirar la cuenta antes de repetir
//   publicado / programado → listo
//   descartado → un "dudoso" o "en-curso" que no había salido: se repitió con --repetir (ya no bloquea)
// Un "dudoso" o "en-curso" se cierra con: node herramientas/meta.mjs resolver … --salio=si|no
// registro-meta/.candado: mientras una corrida publica de verdad, ninguna otra puede (dos terminales,
// un agente que relanza el comando…).
import { join } from "node:path";
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, mkdirSync, statSync } from "node:fs";
import { Falla, leerJson, escribirArchivo } from "./entorno.mjs";

export const BLOQUEAN = ["en-curso", "dudoso", "publicado", "programado"];

export const archivoRegistro = (raiz) => join(raiz, "registro-meta", "publicaciones.json");
export const claveDe = ({ tanda, id, red, formato }) => `${tanda}/${id}/${red}/${formato}`;

export function leerRegistro(raiz) {
  const r = leerJson(archivoRegistro(raiz));
  if (r === null) return { nota: "Lo escribe herramientas/meta.mjs. No editar a mano: los 'dudoso' se cierran con node herramientas/meta.mjs resolver.", publicaciones: [] };
  // Un JSON sano pero con otra forma no se toma como "vacío": se olvidaría lo publicado y el
  // próximo anotar() lo pisaría.
  if (!r || typeof r !== "object" || !Array.isArray(r.publicaciones) || r.publicaciones.some((p) => !p || typeof p !== "object")) {
    throw new Falla(`${archivoRegistro(raiz)} no tiene la forma { "publicaciones": [ … ] }: no publico sin saber qué ya salió. Recuperalo (git o una copia) antes de seguir`);
  }
  return r;
}

export function previas(registro, clave) {
  return registro.publicaciones.filter((p) => p.clave === clave && BLOQUEAN.includes(p.estado));
}

// Historias y reels: su fila de calendario.md no dice la tanda, así que la misma pieza con otra
// --tanda es la misma pieza. Ahí se buscan publicaciones previas sin mirar la tanda.
export function previasDe(registro, { tanda, id, red, formato }, { cualquierTanda = false } = {}) {
  if (!cualquierTanda) return previas(registro, claveDe({ tanda, id, red, formato }));
  return registro.publicaciones.filter((p) => p.id === id && p.red === red && p.formato === formato && BLOQUEAN.includes(p.estado));
}

// Lo anotado en las últimas 24 h que cumple la condición (para los cupos que Meta pide controlar en la app).
export function ultimas24h(registro, condicion) {
  const desde = Date.now() - 86_400_000;
  return registro.publicaciones.filter((p) => BLOQUEAN.includes(p.estado) && Date.parse(p.fecha || p.desde || 0) >= desde && condicion(p));
}

// Cada cambio se guarda en el acto: si el proceso se corta, el registro ya sabe qué quedó a mitad.
export function anotar(raiz, entrada) {
  const registro = leerRegistro(raiz);
  const i = registro.publicaciones.findIndex((p) => p.ref === entrada.ref);
  if (i === -1) registro.publicaciones.push(entrada);
  else registro.publicaciones[i] = { ...registro.publicaciones[i], ...entrada };
  escribirArchivo(archivoRegistro(raiz), JSON.stringify(registro, null, 2) + "\n");
}

export function borrar(raiz, ref) {
  const registro = leerRegistro(raiz);
  registro.publicaciones = registro.publicaciones.filter((p) => p.ref !== ref);
  escribirArchivo(archivoRegistro(raiz), JSON.stringify(registro, null, 2) + "\n");
}

// ---------- candado ----------
const vivo = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
};

// Se abre con "wx": si el archivo ya existe, falla. Así solo una corrida a la vez publica de verdad.
// pruebas.alLeerColgado: solo para las pruebas (simula otra corrida que cambia el candado justo ahí).
export function tomarCandado(raiz, pruebas = {}) {
  const ruta = join(raiz, "registro-meta", ".candado");
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const fd = openSync(ruta, "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }) + "\n");
      closeSync(fd);
      let suelto = false;
      const soltar = () => {
        if (suelto) return;
        suelto = true;
        try { unlinkSync(ruta); } catch { /* ya no estaba */ }
      };
      // Aunque el proceso termine por un error inesperado, el candado no queda puesto.
      process.once("exit", soltar);
      return soltar;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let otro = {};
      let leido = null;
      try { leido = readFileSync(ruta, "utf8"); otro = JSON.parse(leido); } catch { /* candado a medio escribir */ }
      // Sin pid y recién creado: el otro proceso lo está escribiendo en este instante.
      const recien = !otro.pid && Date.now() - (statSync(ruta, { throwIfNoEntry: false })?.mtimeMs ?? 0) < 5_000;
      if ((otro.pid && vivo(otro.pid)) || recien) {
        throw new Falla(`hay otra publicación corriendo (proceso ${otro.pid ?? "?"}${otro.desde ? `, desde ${String(otro.desde).replace("T", " ").slice(0, 19)} UTC` : ""}): esperá a que termine. Si no hay ninguna, borrá registro-meta/.candado`);
      }
      // El proceso que lo tomó ya no existe (se cortó): el candado quedó colgado y se saca, pero
      // de a una corrida por vez (.candado.rompiendo) y solo si sigue siendo el mismo que se leyó:
      // si otra corrida ya lo cambió por el suyo, no se toca (borrarlo por la ruta dejaría a dos publicando).
      if (pruebas.alLeerColgado) pruebas.alLeerColgado();
      const rompiendo = ruta + ".rompiendo";
      let fdR;
      try {
        fdR = openSync(rompiendo, "wx");
      } catch (e2) {
        if (e2.code !== "EEXIST" && e2.code !== "EPERM") throw e2;
        throw new Falla("otra corrida está sacando un candado colgado en este momento: probá de nuevo en unos segundos (si sigue, borrá registro-meta/.candado.rompiendo)");
      }
      try {
        let ahora = null;
        try { ahora = readFileSync(ruta, "utf8"); } catch { /* ya no estaba */ }
        if (leido !== null && ahora === leido) unlinkSync(ruta);
      } finally {
        closeSync(fdR);
        unlinkSync(rompiendo);
      }
    }
  }
  throw new Falla("no pude tomar registro-meta/.candado: probá de nuevo");
}

// Cómo se cierra un "dudoso" o un "en-curso" (lo dicen publicar y estado).
export function comoResolver({ tanda, id, red }) {
  const base = `node herramientas/meta.mjs resolver --tanda=${tanda} --id=${id} --red=${red}`;
  return [
    `si salió: ${base} --salio=si --link=<link de la publicación>`,
    `si no salió: ${base} --salio=no, y publicala de nuevo solo en esa red (--red=${red}); o directamente --red=${red} --repetir`,
  ];
}
