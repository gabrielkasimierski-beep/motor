#!/usr/bin/env node
// Pasa un video a una secuencia de cuadros lista para kit/cuadros.js.
// Sin dependencias: solo node y ffmpeg/ffprobe en el PATH.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LIMITE_WEBP = 16383;            // lado máximo que admite una imagen WebP
const AVISO_TOTAL = 8 * 1024 * 1024;  // sobre esto el sitio se siente pesado
const OPCIONES = new Set(["salida", "nombre", "cuadros", "fps", "ancho", "calidad", "desde", "hasta", "hoja", "web", "intra", "ayuda"]);

const AYUDA = `Uso: node herramientas/video-a-cuadros.js <video> [opciones]

  --salida=carpeta    dónde dejar todo (por defecto ./<nombre>-cuadros)
  --nombre=toma       prefijo de los archivos (por defecto, el nombre del video)
  --cuadros=120       cuántos cuadros sacar, repartidos en el tramo (por defecto 120)
  --fps=24            alternativa a --cuadros: cuadros por segundo del tramo
  --ancho=1280        ancho máximo en px (nunca agranda)
  --calidad=78        calidad WebP, de 0 a 100
  --desde=seg         arranca en este segundo
  --hasta=seg         termina en este segundo
  --hoja              además arma una hoja de cuadros (una sola imagen con grilla)
  --web               además deja nombre-web.mp4 liviano para portada
  --intra             además deja nombre-intra.mp4 todo-intra para mover con el scroll`;

class ErrorUso extends Error {}

// ---------- utilidades ----------
function leerArgumentos(argv) {
  const pos = [], op = {};
  for (const a of argv) {
    if (!a.startsWith("--")) { pos.push(a); continue; }
    const i = a.indexOf("=");
    if (i === -1) op[a.slice(2)] = true;
    else op[a.slice(2, i)] = a.slice(i + 1);
  }
  return { pos, op };
}

function numero(op, clave, defecto, { min = -Infinity, max = Infinity, entero = false } = {}) {
  const crudo = op[clave];
  if (crudo === undefined) return defecto;
  const v = Number(crudo);
  if (crudo === true || crudo === "" || !Number.isFinite(v)) throw new ErrorUso(`--${clave} tiene que ser un número (recibí "${crudo === true ? "" : crudo}").`);
  if (entero && !Number.isInteger(v)) throw new ErrorUso(`--${clave} tiene que ser un número entero (recibí ${v}).`);
  if (v < min || v > max) throw new ErrorUso(`--${clave} tiene que estar entre ${min} y ${max} (recibí ${v}).`);
  return v;
}

const limpiarNombre = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const cola = (txt, n = 8) => String(txt || "").trim().split(/\r?\n/).slice(-n).join("\n");
const mb = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
const kb = (b) => Math.round(b / 1024) + " KB";
const pesoLindo = (b) => (b >= 1024 * 1024 ? mb(b) : kb(b));
const aviso = (txt) => console.warn(`Aviso: ${txt}`);

function correr(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (r.error) {
    if (r.error.code === "ENOENT") throw new ErrorUso(`No encuentro "${cmd}" en el PATH. Instalá ffmpeg (trae ffprobe) y abrí la terminal de nuevo.`);
    throw r.error;
  }
  return r;
}

function ffmpeg(args, queHacia) {
  const r = correr("ffmpeg", ["-hide_banner", "-y", "-v", "error", "-nostdin", ...args]);
  if (r.status !== 0) throw new ErrorUso(`ffmpeg falló mientras ${queHacia}:\n${cola(r.stderr)}`);
  return r;
}

// Alto y ancho reales de una imagen ya generada (ffmpeg ya aplicó rotación y redondeo)
function medirImagen(archivo) {
  const r = correr("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", archivo]);
  const [ancho, alto] = String(r.stdout).trim().split(",").map(Number);
  if (r.status !== 0 || !ancho || !alto) throw new ErrorUso(`No pude medir ${archivo}.`);
  return { ancho, alto };
}

function fraccion(txt) {
  const [a, b] = String(txt || "").split("/").map(Number);
  return b ? a / b : a || 0;
}

function sondear(video) {
  const r = correr("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration:format=duration", "-of", "json", video]);
  if (r.status !== 0) throw new ErrorUso(`ffprobe no pudo leer "${video}". ¿Es un video?\n${cola(r.stderr)}`);
  const j = JSON.parse(r.stdout || "{}");
  const s = j.streams && j.streams[0];
  if (!s) throw new ErrorUso(`"${video}" no tiene pista de video.`);
  const duracion = Number(s.duration) || Number(j.format && j.format.duration);
  if (!(duracion > 0)) throw new ErrorUso("No pude leer la duración del video.");
  const fps = fraccion(s.avg_frame_rate) || fraccion(s.r_frame_rate);
  return { ancho: s.width, alto: s.height, fps, duracion, nbFrames: Number(s.nb_frames) || 0 };
}

// ---------- piezas del trabajo ----------
// Cuántos cuadros tiene el tramo: se cuenta decodificando con las mismas opciones de corte que la extracción
function contarCuadros(entrada) {
  const r = ffmpeg([...entrada, "-map", "0:v:0", "-an", "-nostats", "-progress", "pipe:1", "-f", "null", "-"], "contaba los cuadros");
  const hallados = [...String(r.stdout).matchAll(/^frame=(\d+)/gm)];
  return hallados.length ? Number(hallados[hallados.length - 1][1]) : 0;
}

// Elige EXACTAMENTE n de f cuadros, del primero al último incluidos, parejos entre sí.
// i = round(k·(n-1)/(f-1)) y se queda el cuadro k solo si vuelve a caer en sí mismo: no repite ni se saltea ninguno.
function filtroSeleccion(f, n) {
  if (n >= f) return null;
  if (n === 1) return "select=not(n)";
  return `select=not(round(round(n*${n - 1}/${f - 1})*${f - 1}/${n - 1})-n)`;
}

function grillaParaHoja(n, w, h) {
  const maxC = Math.floor(LIMITE_WEBP / w), maxF = Math.floor(LIMITE_WEBP / h);
  let mejor = null;
  for (let c = 1; c <= Math.min(maxC, n); c++) {
    const f = Math.ceil(n / c);
    if (f > maxF) continue;
    const x = c * w, y = f * h;
    const puntaje = Math.max(x, y) / Math.min(x, y) + (c * f - n) * 0.001; // lo más cuadrada posible, con pocas celdas vacías
    if (!mejor || puntaje < mejor.puntaje) mejor = { columnas: c, filas: f, puntaje };
  }
  return mejor;
}

function main() {
  const { pos, op } = leerArgumentos(process.argv.slice(2));
  if (op.ayuda || (!pos.length && !process.argv.slice(2).length)) { console.log(AYUDA); return; }
  for (const clave of Object.keys(op)) if (!OPCIONES.has(clave)) throw new ErrorUso(`No conozco la opción --${clave}.\n\n${AYUDA}`);
  if (pos.length !== 1) throw new ErrorUso(`Falta el video (o sobra algún argumento).\n\n${AYUDA}`);
  for (const clave of ["salida", "nombre"]) if (op[clave] === true || op[clave] === "") throw new ErrorUso(`--${clave} necesita un valor: --${clave}=...`);
  if (op.cuadros !== undefined && op.fps !== undefined) throw new ErrorUso("Elegí --cuadros o --fps, no los dos a la vez.");

  const video = path.resolve(pos[0]);
  if (!fs.existsSync(video) || !fs.statSync(video).isFile()) throw new ErrorUso(`No encuentro el video: ${video}`);

  // Herramientas: avisar claro antes de arrancar
  correr("ffmpeg", ["-version"]);
  correr("ffprobe", ["-version"]);
  const codecs = String(correr("ffmpeg", ["-hide_banner", "-encoders"]).stdout);
  if (!/\blibwebp\b/.test(codecs)) throw new ErrorUso("Tu ffmpeg no trae el codificador libwebp. Instalá una versión completa (por ejemplo la build \"full\" de gyan.dev).");
  if ((op.web || op.intra) && !/\blibx264\b/.test(codecs)) throw new ErrorUso("Tu ffmpeg no trae libx264, que hace falta para --web y --intra.");

  const sonda = sondear(video);
  const nombre = limpiarNombre(op.nombre ?? path.parse(video).name);
  if (!nombre) throw new ErrorUso("El nombre quedó vacío; probá con --nombre=toma.");
  const salida = path.resolve(op.salida ?? `${nombre}-cuadros`);
  const ancho = numero(op, "ancho", 1280, { min: 16, entero: true });
  const calidad = numero(op, "calidad", 78, { min: 0, max: 100 });
  const desde = numero(op, "desde", 0, { min: 0 });
  let hasta = numero(op, "hasta", sonda.duracion, { min: 0 });
  const pidioFps = op.fps !== undefined;
  const fpsPedido = pidioFps ? numero(op, "fps", 24, { min: 0.1 }) : 0;
  const cuadrosPedidos = pidioFps ? 0 : numero(op, "cuadros", 120, { min: 1, entero: true });

  if (desde >= sonda.duracion) throw new ErrorUso(`--desde=${desde} cae fuera del video, que dura ${sonda.duracion.toFixed(2)} s.`);
  if (hasta > sonda.duracion) { aviso(`--hasta=${hasta} pasa del final; uso ${sonda.duracion.toFixed(2)} s.`); hasta = sonda.duracion; }
  if (hasta <= desde) throw new ErrorUso("--hasta tiene que ser mayor que --desde.");
  const hayTramo = desde > 0 || hasta < sonda.duracion - 1e-6;
  const durTramo = hasta - desde;

  console.log(`Video: ${path.basename(video)} · ${sonda.ancho}×${sonda.alto} · ${sonda.fps.toFixed(2)} fps · ${sonda.duracion.toFixed(2)} s`);

  // Opciones de corte, idénticas en todas las pasadas para que "el cuadro n" sea siempre el mismo
  const entrada = [
    ...(desde > 0 ? ["-ss", desde.toFixed(3)] : []),
    ...(hasta < sonda.duracion - 1e-6 ? ["-t", durTramo.toFixed(3)] : []),
    "-i", video,
  ];

  let totalVideo, origenTotal;
  if (!hayTramo && sonda.nbFrames) { totalVideo = sonda.nbFrames; origenTotal = "ffprobe"; }
  else { console.log("Contando los cuadros del tramo…"); totalVideo = contarCuadros(entrada); origenTotal = "conteo"; }
  if (totalVideo < 1) throw new ErrorUso("El tramo no tiene cuadros. Revisá --desde y --hasta.");

  const pedir = () => {
    const n = pidioFps ? Math.max(1, Math.round(durTramo * fpsPedido)) : cuadrosPedidos;
    return Math.min(n, totalVideo);
  };
  let total = pedir();
  const pedidoOriginal = pidioFps ? Math.max(1, Math.round(durTramo * fpsPedido)) : cuadrosPedidos;
  if (pedidoOriginal > totalVideo) aviso(`el tramo solo tiene ${totalVideo} cuadros; saco ${totalVideo} (no se pueden inventar más).`);

  // Carpeta limpia de la toma anterior con el mismo nombre (si no, sobrarían cuadros viejos)
  fs.mkdirSync(salida, { recursive: true });
  const reCuadro = new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.webp$`);
  const listarCuadros = () => fs.readdirSync(salida).filter((f) => reCuadro.test(f)).sort();
  const limpiar = () => listarCuadros().forEach((f) => fs.rmSync(path.join(salida, f)));

  const digitos = Math.max(4, String(totalVideo).length);
  const archivo = (suf) => path.join(salida, `${nombre}-${suf}`);
  const escala = `scale=w='min(${ancho},iw)':h=-2:flags=lanczos`;
  const codecWebp = ["-c:v", "libwebp", "-quality", String(calidad), "-compression_level", "6"];

  const sacarCuadros = () => {
    const vf = [filtroSeleccion(totalVideo, total), escala].filter(Boolean).join(",");
    ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", vf, "-fps_mode", "passthrough", ...codecWebp,
      "-start_number", "1", archivo(`%0${digitos}d.webp`)], "sacaba los cuadros");
  };

  console.log(`Sacando ${total} cuadros…`);
  limpiar();
  sacarCuadros();
  let hallados = listarCuadros().length;
  if (hallados !== total && origenTotal === "ffprobe") {
    // El conteo del contenedor no coincidió con lo decodificado: recontar de verdad y repetir una vez
    aviso(`salieron ${hallados} cuadros y esperaba ${total}; recuento el video y repito.`);
    totalVideo = contarCuadros(entrada);
    total = pedir();
    limpiar();
    sacarCuadros();
    hallados = listarCuadros().length;
  }
  if (hallados === 0) throw new ErrorUso("ffmpeg no generó ningún cuadro.");
  if (hallados !== total) {
    // Último recurso: dejar la secuencia con el largo exacto, y decirlo
    const lista = listarCuadros();
    if (hallados > total) {
      aviso(`sobraban ${hallados - total} cuadros; los saco del final.`);
      lista.slice(total).forEach((f) => fs.rmSync(path.join(salida, f)));
    } else {
      aviso(`faltaban ${total - hallados} cuadros; repito el último para completar.`);
      const ultimo = lista[lista.length - 1];
      for (let i = hallados + 1; i <= total; i++) fs.copyFileSync(path.join(salida, ultimo), archivo(`${String(i).padStart(digitos, "0")}.webp`));
    }
  }
  const lista = listarCuadros();
  if (lista.length !== total) throw new ErrorUso(`No logré dejar exactamente ${total} cuadros (hay ${lista.length}).`);

  const { ancho: w, alto: h } = medirImagen(path.join(salida, lista[0]));
  const pesoBytes = lista.reduce((s, f) => s + fs.statSync(path.join(salida, f)).size, 0);

  // Poster = primer cuadro; final = último cuadro EXACTO del tramo (se saca del video, no del WebP, para no recomprimir)
  ffmpeg([...(desde > 0 ? ["-ss", desde.toFixed(3)] : []), "-i", video, "-map", "0:v:0", "-an", "-vf", escala,
    "-frames:v", "1", "-q:v", "2", "-update", "1", archivo("poster.jpg")], "sacaba el poster");
  const archivoFinal = archivo("final.jpg");
  fs.rmSync(archivoFinal, { force: true });
  ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", `select=not(n-${totalVideo - 1}),${escala}`, "-fps_mode", "passthrough",
    "-frames:v", "1", "-q:v", "2", "-update", "1", archivoFinal], "sacaba el cuadro final");
  if (!fs.existsSync(archivoFinal)) {
    // Si el conteo se corrió, esta pasada escribe cada cuadro encima del anterior y queda el último
    ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", escala, "-fps_mode", "passthrough", "-q:v", "2", "-update", "1", archivoFinal], "sacaba el cuadro final");
  }

  const seleccion = filtroSeleccion(totalVideo, total);
  const extras = [];

  // Hoja: una sola imagen con todos los cuadros en grilla, hecha desde el video (sin recomprimir los WebP)
  let hoja = null;
  if (op.hoja) {
    const g = grillaParaHoja(total, w, h);
    if (!g) {
      aviso(`no hago la hoja: ${total} cuadros de ${w}×${h} no entran en una imagen WebP (máximo ${LIMITE_WEBP} px por lado). Probá con menos cuadros o menos ancho.`);
    } else {
      console.log(`Armando la hoja (${g.columnas}×${g.filas})…`);
      const archivoHoja = archivo("hoja.webp");
      const vf = [seleccion, escala, `tile=${g.columnas}x${g.filas}:padding=0:margin=0`].filter(Boolean).join(",");
      ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", vf, "-fps_mode", "passthrough", "-frames:v", "1", ...codecWebp, "-update", "1", archivoHoja], "armaba la hoja");
      const m = medirImagen(archivoHoja);
      if (m.ancho !== g.columnas * w || m.alto !== g.filas * h) aviso(`la hoja salió de ${m.ancho}×${m.alto} y esperaba ${g.columnas * w}×${g.filas * h}.`);
      hoja = { archivo: path.basename(archivoHoja), columnas: g.columnas, filas: g.filas };
      const mpx = (m.ancho * m.alto) / 1e6;
      extras.push(`Hoja:       ${hoja.archivo} · ${m.ancho}×${m.alto} · ${pesoLindo(fs.statSync(archivoHoja).size)}`);
      if (mpx > 16.7) aviso(`la hoja tiene ${mpx.toFixed(0)} megapíxeles; varios celulares no la decodifican. Para móvil conviene la secuencia suelta, menos cuadros o menos --ancho.`);
    }
  }

  // Videos: uno liviano para portada y otro todo-intra para mover con el scroll
  const escalaVideo = `scale=w='trunc(min(${ancho},iw)/2)*2':h=-2:flags=lanczos`;
  const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  if (op.web) {
    console.log("Comprimiendo el video para portada…");
    const f = archivo("web.mp4");
    ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", escalaVideo, ...h264, "-preset", "medium", "-crf", "26", f], "comprimía el video web");
    extras.push(`Video web:   ${path.basename(f)} · ${pesoLindo(fs.statSync(f).size)}`);
  }
  if (op.intra) {
    console.log("Comprimiendo el video todo-intra…");
    const f = archivo("intra.mp4");
    ffmpeg([...entrada, "-map", "0:v:0", "-an", "-vf", escalaVideo, ...h264, "-preset", "medium", "-crf", "24", "-g", "1", "-bf", "0", f], "comprimía el video intra");
    extras.push(`Video intra: ${path.basename(f)} · ${pesoLindo(fs.statSync(f).size)} (un cuadro clave por cuadro)`);
  }

  // Datos para el sitio
  const datos = {
    total, ancho: w, alto: h,
    fuente: `${nombre}-${"#".repeat(digitos)}.webp`,
    fps: Math.round((total / durTramo) * 100) / 100,
    duracion: Math.round(durTramo * 100) / 100,
    pesoKB: Math.round(pesoBytes / 1024),
  };
  if (hoja) datos.hoja = hoja;
  fs.writeFileSync(path.join(salida, `${nombre}.json`), JSON.stringify(datos, null, 2) + "\n");

  console.log(`\nListo: ${total} cuadros de ${w}×${h} en ${salida}`);
  console.log(`Peso total:  ${mb(pesoBytes)} · ${kb(pesoBytes / total)} por cuadro`);
  console.log(`Poster:      ${nombre}-poster.jpg · Final: ${nombre}-final.jpg · Datos: ${nombre}.json`);
  extras.forEach((e) => console.log(e));
  if (pesoBytes > AVISO_TOTAL) {
    console.warn(`\nAviso: los cuadros pesan ${mb(pesoBytes)}, más de 8 MB. Para bajarlo: menos cuadros (--cuadros=${Math.max(1, Math.round(total * 0.6))}), menos ancho (--ancho=${Math.max(320, Math.round(w * 0.75))}) o menos calidad (--calidad=${Math.max(40, Math.round(calidad - 10))}).`);
  }
}

try {
  main();
} catch (e) {
  if (e instanceof ErrorUso) { console.error(`Error: ${e.message}`); process.exitCode = 1; }
  else { console.error("Error inesperado:", e); process.exitCode = 1; }
}
