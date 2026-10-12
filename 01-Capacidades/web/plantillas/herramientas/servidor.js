// Servidor local mínimo, sin dependencias.
//
// Sirve una carpeta en http://localhost para probar una web o una app en el navegador tal
// como va a quedar publicada (fetch, rutas y módulos no andan abriendo el archivo suelto).
//
// Uso:  node servidor.js <carpeta> [puerto]

const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(process.argv[2] || ".");
const puerto = Number(process.argv[3] || process.env.PORT || 5180);

const tipos = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".webmanifest": "application/manifest+json",
};

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://local").pathname);
  let archivo = path.join(raiz, ruta);
  if (!archivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, "index.html");

  if (!fs.existsSync(archivo)) {
    const p404 = path.join(raiz, "404.html");
    res.writeHead(404, { "Content-Type": tipos[".html"] });
    return res.end(fs.existsSync(p404) ? fs.readFileSync(p404) : "No existe: " + ruta);
  }
  res.writeHead(200, {
    "Content-Type": tipos[path.extname(archivo).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(archivo).pipe(res);
}).listen(puerto, () => console.log(`Sirviendo ${raiz} en http://localhost:${puerto}`));
