// Vista previa de un solo archivo.
//
// El sitio real referencia sus estilos, su JavaScript y sus imágenes como archivos
// (assets/...), que es lo correcto para publicar. Pero para mostrarlo como link (artifact)
// todo tiene que ir dentro de un único HTML. Este script copia el sitio y mete adentro
// cada hoja de estilos, cada script y cada imagen.
//
// Uso:  node vista-previa.js <sitio/index.html> <salida.html>

const fs = require("fs");
const path = require("path");

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node vista-previa.js <sitio/index.html> <salida.html>");
  process.exit(1);
}

const dir = path.dirname(entrada);
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const faltan = [];
const leer = ruta => {
  const abs = path.join(dir, ruta.replace(/^\//, ""));        // "/assets/x" y "assets/x" son lo mismo
  if (!fs.existsSync(abs)) { faltan.push(ruta); return null; }
  return abs;
};

let html = fs.readFileSync(entrada, "utf8");
let estilos = 0, scripts = 0;

// 1. Hojas de estilo propias (las de internet, como Google Fonts, quedan como están)
html = html.replace(/[ \t]*<link[^>]+href="((?!https?:|\/\/)[^"]+\.css)"[^>]*>\n?/gi, (todo, ruta) => {
  const abs = leer(ruta);
  if (!abs) return todo;
  estilos++;
  return `<style>\n/* ${ruta} */\n${fs.readFileSync(abs, "utf8")}\n</style>\n`;
});

// 2. Scripts propios
html = html.replace(/[ \t]*<script[^>]+src="((?!https?:|\/\/)[^"]+\.js)"[^>]*><\/script>\n?/gi, (todo, ruta) => {
  const abs = leer(ruta);
  if (!abs) return todo;
  scripts++;
  const codigo = fs.readFileSync(abs, "utf8").replace(/<\/script>/gi, "<\\/script>");
  const tipo = /type=["']module["']/i.test(todo) ? ' type="module"' : "";   // los módulos siguen siendo módulos
  return `<script${tipo}>\n/* ${ruta} */\n${codigo}\n</script>\n`;
});

// 3. Imágenes, como data URI
const hechas = {};
html = html.replace(/\/?assets\/[\w\/.-]+\.(jpe?g|png|webp|svg)/gi, ruta => {
  if (!hechas[ruta]) {
    const abs = leer(ruta);
    if (!abs) return ruta;
    hechas[ruta] = `data:${mime[path.extname(ruta).toLowerCase()]};base64,${fs.readFileSync(abs).toString("base64")}`;
  }
  return hechas[ruta];
});

fs.writeFileSync(salida, html);
const mb = (fs.statSync(salida).size / 1024 / 1024).toFixed(2);
console.log(`${estilos} estilos · ${scripts} scripts · ${Object.keys(hechas).length} imágenes → ${salida} (${mb} MB)`);
if (faltan.length) { console.error("FALTAN:", [...new Set(faltan)].join(", ")); process.exit(2); }
