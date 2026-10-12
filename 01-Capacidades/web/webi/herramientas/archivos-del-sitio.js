#!/usr/bin/env node
// Lista los archivos de un sitio con su peso y avisa de lo que se pasa de los límites de publicación.
// Uso: node herramientas/archivos-del-sitio.js <carpeta-del-sitio> [--json]
//   --json imprime solo { "ruta/relativa": "ruta/relativa" } de todo menos index.html (para publicar con los archivos al lado).

import fs from "node:fs";
import path from "node:path";

const MB = 1024 * 1024;
const LIMITES = { archivos: 255, texto: 16 * MB, binario: 15 * MB, total: 64 * MB, imagen: 500 * 1024, video: 8 * MB };
const TEXTO = new Set([".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".map", ".csv"]);
const IMAGEN = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);
const VIDEO = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const RUIDO = new Set(["node_modules", "thumbs.db", "desktop.ini"]);
const LEIBLES = new Set([".html", ".htm", ".css", ".js", ".mjs", ".svg", ".xml", ".webmanifest", ".json"]); // donde puede nombrarse un .json

const AYUDA = "Uso: node herramientas/archivos-del-sitio.js <carpeta-del-sitio> [--json]";

const args = process.argv.slice(2);
const comoJson = args.includes("--json");
const pos = args.filter((a) => !a.startsWith("--"));
const raras = args.filter((a) => a.startsWith("--") && a !== "--json" && a !== "--ayuda");
if (args.includes("--ayuda") || !args.length) { console.log(AYUDA); process.exit(args.length ? 0 : 1); }
if (raras.length || pos.length !== 1) { console.error(`Error: ${raras.length ? `no conozco ${raras[0]}` : "falta la carpeta del sitio"}.\n${AYUDA}`); process.exit(1); }

const raiz = path.resolve(pos[0]);
if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) { console.error(`Error: no existe la carpeta ${raiz}`); process.exit(1); }

const pesoLindo = (b) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

// Recorre la carpeta sin entrar a ocultos ni a node_modules; los .md nunca se publican
function recorrer(dir, rel = "") {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || RUIDO.has(e.name.toLowerCase())) continue;
    const abs = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) salida.push(...recorrer(abs, r));
    else if (e.isFile() && path.extname(e.name).toLowerCase() !== ".md") salida.push({ ruta: r, abs, peso: fs.statSync(abs).size, ext: path.extname(e.name).toLowerCase() });
  }
  return salida;
}

let archivos = recorrer(raiz);

// Un .json solo va si alguna página, hoja de estilos o script lo nombra (los datos de cuadros sí; un package.json suelto no)
const lectura = archivos.filter((a) => LEIBLES.has(a.ext) && a.peso <= 5 * MB).map((a) => ({ abs: a.abs, texto: fs.readFileSync(a.abs, "utf8") }));
archivos = archivos.filter((a) => a.ext !== ".json" || lectura.some((l) => l.abs !== a.abs && l.texto.includes(path.basename(a.abs))));
archivos.sort((a, b) => a.ruta.localeCompare(b.ruta, "es"));

const total = archivos.reduce((s, a) => s + a.peso, 0);
const avisos = [];
if (archivos.length > LIMITES.archivos) avisos.push(`Son ${archivos.length} archivos y una publicación admite hasta ${LIMITES.archivos}: hay que subirlo en varias tandas, o juntar los cuadros en una hoja (--hoja).`);
if (total > LIMITES.total) avisos.push(`El total es ${pesoLindo(total)} y una publicación admite hasta 64 MB: hay que subirlo en varias tandas o aliviar los medios.`);
for (const a of archivos) {
  const esTexto = TEXTO.has(a.ext);
  if (esTexto && a.peso > LIMITES.texto) avisos.push(`${a.ruta} (${pesoLindo(a.peso)}) pasa de 16 MB, el máximo para un archivo de texto.`);
  if (!esTexto && a.peso > LIMITES.binario) avisos.push(`${a.ruta} (${pesoLindo(a.peso)}) pasa de 15 MB, el máximo para un archivo binario.`);
  if (IMAGEN.has(a.ext) && a.peso > LIMITES.imagen) avisos.push(`${a.ruta} (${pesoLindo(a.peso)}) es una imagen de más de 500 KB: conviene más chica o con menos calidad.`);
  if (VIDEO.has(a.ext) && a.peso > LIMITES.video) avisos.push(`${a.ruta} (${pesoLindo(a.peso)}) es un video de más de 8 MB: conviene recomprimirlo (video-a-cuadros.js --web).`);
}

if (comoJson) {
  const mapa = {};
  for (const a of archivos) if (a.ruta !== "index.html") mapa[a.ruta] = a.ruta;
  console.log(JSON.stringify(mapa, null, 2));
  avisos.forEach((v) => console.error(`Aviso: ${v}`)); // por stderr, para no ensuciar el JSON
} else {
  console.log(`Archivos de ${raiz}\n`);
  const ancho = Math.max(0, ...archivos.map((a) => pesoLindo(a.peso).length));
  for (const a of archivos) console.log(`  ${pesoLindo(a.peso).padStart(ancho)}  ${a.ruta}`);
  console.log(`\nTotal: ${archivos.length} archivos · ${pesoLindo(total)}`);
  if (avisos.length) { console.log(`\nAvisos (${avisos.length})`); avisos.forEach((v) => console.log(`  - ${v}`)); }
  else console.log("\nSin avisos: entra en una sola publicación.");
}
