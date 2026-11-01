// Lee lo justo de una imagen JPEG y de un video MP4/MOV para validarlos antes de mandar nada:
// tamaño, medidas, duración y si el "moov" está al principio (lo pide Meta para videos).
// También: la huella de una pieza (para atar lo publicado a lo aprobado) y el seguro contra G:.
import { readFileSync, openSync, readSync, closeSync, statSync, existsSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { Falla } from "./entorno.mjs";

// G: es el Drive del trabajo de la persona responsable. Se mira la ruta "limpia": sin el prefijo de ruta larga
// (\\?\ o \\.\), como recurso compartido (\\localhost\G$) y, si existe, después de seguir atajos.
export function esDelDriveDelTrabajo(ruta) {
  const limpiar = (p) => String(p).replace(/\//g, "\\").replace(/^\\\\[?.]\\(UNC\\)?/i, (m, unc) => (unc ? "\\\\" : ""));
  const esG = (p) => /^[gG]:/.test(p) || /^\\\\[^\\]+\\[gG]\$/i.test(p);
  // Si ya se ve que es G:, ni se consulta el disco (no se toca G: ni para mirar).
  if ([limpiar(ruta), limpiar(resolve(String(ruta)))].some(esG)) return true;
  try { return esG(limpiar(realpathSync.native(resolve(String(ruta))))); } catch { return false; /* no existe: alcanza con lo anterior */ }
}

// ¿La ruta está dentro de la carpeta? (sin salirse con "..")
export function estaDentro(carpeta, ruta) {
  const rel = relative(resolve(carpeta), resolve(ruta));
  return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
}

export function leerJpeg(ruta) {
  if (!existsSync(ruta)) throw new Falla(`no existe ${ruta}`);
  const b = readFileSync(ruta);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) {
    // Lo más común: un PNG con nombre .jpg. Si es una lámina de publicar/, se arregla preparándola de nuevo.
    const enPublicar = /[\\/]publicar[\\/]/.test(String(ruta));
    throw new Falla(
      `${ruta} no es JPEG: Instagram solo acepta JPEG por API. ` +
      (enPublicar
        ? "Exportá de nuevo la imagen en JPEG y reemplazala en publicar/<tanda>/<pieza>/; ver README.md."
        : "Convertí la imagen a JPEG con tu editor antes de agregarla a la pieza; ver README.md."),
    );
  }
  let ancho = null;
  let alto = null;
  let mpo = false;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; } // relleno
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xd9 || m === 0xda) break; // las medidas siempre vienen antes de los datos
    const largo = b.readUInt16BE(i + 2);
    // APP2 con "MPF": es un JPEG extendido (MPO), que Instagram no acepta.
    if (m === 0xe2 && b.toString("latin1", i + 4, i + 8) === "MPF\0") mpo = true;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      alto = b.readUInt16BE(i + 5);
      ancho = b.readUInt16BE(i + 7);
    }
    i += 2 + largo;
  }
  if (!ancho || !alto) throw new Falla(`no pude leer las medidas de ${ruta}: ¿es un JPEG sano?`);
  return { ruta, tipo: "jpeg", ancho, alto, bytes: b.length, mpo };
}

// Recorre las cajas de primer nivel sin cargar el video entero en memoria.
export function leerMp4(ruta) {
  if (!existsSync(ruta)) throw new Falla(`no existe ${ruta}`);
  const bytes = statSync(ruta).size;
  const fd = openSync(ruta, "r");
  const cajas = [];
  let moov = null;
  try {
    const cab = Buffer.alloc(16);
    let pos = 0;
    while (pos + 8 <= bytes && cajas.length < 200) {
      readSync(fd, cab, 0, 16, pos);
      let tam = cab.readUInt32BE(0);
      const tipo = cab.toString("latin1", 4, 8);
      let cabecera = 8;
      if (tam === 1) { tam = Number(cab.readBigUInt64BE(8)); cabecera = 16; }
      else if (tam === 0) tam = bytes - pos;
      if (tam < cabecera) break;
      cajas.push(tipo);
      if (tipo === "moov" && tam < 64 * 1048576) moov = leerMoov(fd, pos + cabecera, tam - cabecera);
      pos += tam;
    }
  } finally {
    closeSync(fd);
  }
  if (cajas[0] !== "ftyp") throw new Falla(`${ruta} no parece un MP4/MOV (falta la caja ftyp al principio)`);
  const iMoov = cajas.indexOf("moov");
  const iMdat = cajas.indexOf("mdat");
  return {
    ruta, tipo: "video", bytes,
    duracion: moov?.duracion ?? null,
    ancho: moov?.ancho ?? null,
    alto: moov?.alto ?? null,
    moovAlPrincipio: iMoov !== -1 && (iMdat === -1 || iMoov < iMdat),
  };
}

// Dentro de moov: la duración (mvhd) y las medidas de la pista de video (trak → tkhd).
function leerMoov(fd, desde, largo) {
  const b = Buffer.alloc(largo);
  readSync(fd, b, 0, largo, desde);
  const r = { duracion: null, ancho: null, alto: null };
  const recorrer = (ini, fin) => {
    let i = ini;
    while (i + 8 <= fin) {
      const tam = b.readUInt32BE(i);
      const tipo = b.toString("latin1", i + 4, i + 8);
      if (tam < 8 || i + tam > fin) break;
      if (tipo === "mvhd" && tam >= 32) {
        const p = i + 8;
        const version = b[p];
        const escala = version === 1 ? b.readUInt32BE(p + 20) : b.readUInt32BE(p + 12);
        const dur = version === 1 ? Number(b.readBigUInt64BE(p + 24)) : b.readUInt32BE(p + 16);
        r.duracion = escala ? dur / escala : null;
      }
      if (tipo === "trak") recorrer(i + 8, i + tam);
      // tkhd termina con ancho y alto en punto fijo 16.16; la pista de audio trae 0×0.
      if (tipo === "tkhd" && tam >= 92) {
        const ancho = b.readUInt32BE(i + tam - 8) / 65536;
        const alto = b.readUInt32BE(i + tam - 4) / 65536;
        if (ancho && alto && !r.ancho) { r.ancho = Math.round(ancho); r.alto = Math.round(alto); }
      }
      i += tam;
    }
  };
  recorrer(0, b.length);
  return r;
}

// Huella de lo que se publica (texto + archivos, en orden): la misma pieza en la otra red tiene
// que ser exactamente lo mismo que ya salió.
export function huellaDe(texto, archivos) {
  const h = createHash("sha256");
  h.update(String(texto ?? ""));
  const trozo = Buffer.alloc(1 << 20);
  for (const archivo of archivos) {
    h.update("\0archivo\0");
    const fd = openSync(archivo, "r");
    try {
      let n;
      while ((n = readSync(fd, trozo, 0, trozo.length, null)) > 0) h.update(trozo.subarray(0, n));
    } finally {
      closeSync(fd);
    }
  }
  return h.digest("hex").slice(0, 16);
}
