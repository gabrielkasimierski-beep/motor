#!/usr/bin/env node
// Arma la carpeta de un sitio nuevo a partir del kit.
// Uso: node herramientas/nuevo-sitio.js <carpeta-destino> [--nombre="Nombre del sitio"] [--piezas=cuadros,capas,...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aca = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(aca, "..", "kit");
const SIEMPRE = ["tokens.css", "motor-scroll.js"];
const PIEZAS_CONOCIDAS = ["cuadros", "video-portada", "capas", "puntero", "fondo-shader", "escena3d", "graficos"];

const AYUDA = `Uso: node herramientas/nuevo-sitio.js <carpeta-destino> [opciones]

  --nombre="Nombre del sitio"   título de la página (por defecto, el nombre de la carpeta)
  --piezas=a,b,c                piezas del kit a copiar además de tokens.css y motor-scroll.js
                                (${PIEZAS_CONOCIDAS.join(", ")}; también sirve cualquier
                                 archivo del kit, como secciones o pantalla, o componentes/<pieza>)`;

class ErrorUso extends Error {}

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

const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dentroDelKit = (ruta) => ruta === kit || ruta.startsWith(kit + path.sep);

// Qué archivos del kit corresponden a una pieza: pieza.js, pieza.css o la carpeta componentes/pieza
function resolverPieza(nombre) {
  if (!nombre || nombre.includes("..") || path.isAbsolute(nombre)) return [];
  const limpio = nombre.replace(/\\/g, "/").replace(/\.(js|css)$/, "");
  const existe = (c) => { const abs = path.resolve(kit, c); return dentroDelKit(abs) && fs.existsSync(abs); };
  const halladas = [`${limpio}.js`, `${limpio}.css`, `componentes/${limpio}`].filter(existe);
  // Si no es una pieza por nombre, vale la ruta tal cual (por ejemplo "componentes" o "componentes/marquesina")
  if (!halladas.length && existe(limpio)) halladas.push(limpio);
  return halladas;
}

// Imports relativos dentro de un .js o un .css del kit: hay que llevarse también lo que importa
function dependencias(archivo) {
  if (!/\.(m?js|css)$/.test(archivo)) return [];
  // Sin comentarios: los ejemplos de uso de la cabecera también traen "import … from './…'" y no son dependencias
  const texto = fs.readFileSync(archivo, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|@import\s+(?:url\()?)["'](\.{1,2}\/[^"']+)["']/g;
  const salida = [];
  for (const m of texto.matchAll(re)) salida.push(path.resolve(path.dirname(archivo), m[1]));
  return salida;
}

function main() {
  const { pos, op } = leerArgumentos(process.argv.slice(2));
  if (op.ayuda || !process.argv.slice(2).length) { console.log(AYUDA); return; }
  if (pos.length !== 1) throw new ErrorUso(`Falta la carpeta de destino (o sobra algún argumento).\n\n${AYUDA}`);
  for (const clave of Object.keys(op)) if (!["nombre", "piezas", "ayuda"].includes(clave)) throw new ErrorUso(`No conozco la opción --${clave}.\n\n${AYUDA}`);
  for (const clave of ["nombre", "piezas"]) if (op[clave] === true || op[clave] === "") throw new ErrorUso(`--${clave} necesita un valor: --${clave}=...`);

  const destino = path.resolve(pos[0]);
  if (fs.existsSync(destino)) {
    if (!fs.statSync(destino).isDirectory()) throw new ErrorUso(`${destino} existe y no es una carpeta.`);
    if (fs.readdirSync(destino).length) throw new ErrorUso(`${destino} ya existe y no está vacía. Elegí otra carpeta o vaciala.`);
  }
  if (!fs.existsSync(kit)) throw new ErrorUso(`No encuentro el kit en ${kit}.`);

  const base = path.basename(destino).replace(/[-_]+/g, " ").trim();
  const nombre = (op.nombre ?? (base.charAt(0).toUpperCase() + base.slice(1))) || "Sitio nuevo";
  const pedidas = String(op.piezas ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Lista de lo que se copia, relativa al kit; las dependencias se suman solas
  const aCopiar = new Map(); // ruta relativa → origen absoluto
  const faltan = [], extra = [];
  const sumar = (rel, porDependencia = false) => {
    const abs = path.resolve(kit, rel);
    if (!dentroDelKit(abs)) return;
    if (!fs.existsSync(abs)) { faltan.push(rel); return; }
    const relNorm = path.relative(kit, abs).split(path.sep).join("/");
    if (aCopiar.has(relNorm)) return;
    aCopiar.set(relNorm, abs);
    if (porDependencia) extra.push(relNorm);
    const archivos = fs.statSync(abs).isDirectory()
      ? fs.readdirSync(abs, { recursive: true }).map((f) => path.join(abs, f)).filter((f) => fs.statSync(f).isFile())
      : [abs];
    for (const f of archivos) for (const dep of dependencias(f)) sumar(path.relative(kit, dep), true);
  };

  for (const s of SIEMPRE) sumar(s);
  for (const pieza of pedidas) {
    const rutas = resolverPieza(pieza);
    if (!rutas.length) faltan.push(pieza); else rutas.forEach((r) => sumar(r));
  }

  fs.mkdirSync(path.join(destino, "kit"), { recursive: true });
  fs.mkdirSync(path.join(destino, "medios"), { recursive: true });
  for (const [rel, abs] of aCopiar) {
    const a = path.join(destino, "kit", rel);
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.cpSync(abs, a, { recursive: true });
  }

  fs.writeFileSync(path.join(destino, "index.html"), plantilla(nombre));

  // Ruta corta si cuelga de donde estás parado; si no, la absoluta (sin escaleras de "..")
  const ver = (p) => {
    const rel = path.relative(process.cwd(), p) || ".";
    const r = rel.startsWith("..") || path.isAbsolute(rel) ? p : rel;
    return /\s/.test(r) ? `"${r}"` : r;
  };
  const herr = (archivo) => ver(path.join(aca, archivo));
  const rutaSitio = ver(destino);
  const unir = (...partes) => ver(path.join(destino, ...partes));
  console.log(`Sitio creado en ${destino}`);
  console.log(`  kit/     ${[...aCopiar.keys()].join(", ")}`);
  if (extra.length) console.log(`           (sumadas por dependencia: ${extra.join(", ")})`);
  console.log("  medios/  vacía");
  console.log("  index.html");
  if (faltan.length) console.warn(`\nAviso: no existe todavía en el kit: ${[...new Set(faltan)].join(", ")}. Copialas a mano cuando estén.`);
  console.log(`
Próximos pasos
  1. Marca: en ${unir("kit", "tokens.css")} pisá solo el bloque "Marca" (colores y tipografías).
  2. Medios: dejá imágenes y videos en ${unir("medios")}. Para una película por cuadros:
     node ${herr("video-a-cuadros.js")} video.mp4 --salida=${unir("medios", "cuadros")} --nombre=toma
  3. Verlo: node ${herr("servidor.js")} ${rutaSitio} 5191  →  http://127.0.0.1:5191/
  4. Antes de publicar: node ${herr("archivos-del-sitio.js")} ${rutaSitio}`);
}

function plantilla(nombre) {
  const n = escapar(nombre);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${n}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./kit/tokens.css">
<style>
  /* Hero de arranque: todo sale de tokens.css, nada de colores propios */
  .hero { min-height: 100vh; min-height: 100svh; display: grid; align-content: center; }
  .hero .contenedor { display: grid; gap: 1.5rem; justify-items: start; }
  .hero .titulo-xl { max-width: 14ch; }
</style>
</head>
<body>
<main>
  <section class="hero banda resplandor grano">
    <div class="contenedor">
      <p class="etiqueta" data-aparecer>Sitio nuevo</p>
      <h1 class="titulo-xl" data-aparecer>${n}</h1>
      <p class="bajada" data-aparecer>Punto de partida del Motor webi. Reemplazá este texto y sumá las bandas del sitio.</p>
      <a class="boton" href="#" data-aparecer>Empezar</a>
    </div>
  </section>
</main>
<script type="module">
  import { aparecer } from "./kit/motor-scroll.js";
  aparecer();
</script>
</body>
</html>
`;
}

try {
  main();
} catch (e) {
  if (e instanceof ErrorUso) { console.error(`Error: ${e.message}`); process.exitCode = 1; }
  else { console.error("Error inesperado:", e); process.exitCode = 1; }
}
