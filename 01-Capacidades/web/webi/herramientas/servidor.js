#!/usr/bin/env node
// Servidor local estático para el banco y los sitios del motor.
// Uso: node herramientas/servidor.js <carpeta> [puerto]   (puerto: argumento, variable PORT o 5190)
// Sin dependencias. Soporta Range (206) para poder saltar dentro de los videos.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
};

const [carpetaArg, puertoArg] = process.argv.slice(2);
if (!carpetaArg || carpetaArg === "--ayuda" || carpetaArg === "-h") {
  console.log("Uso: node herramientas/servidor.js <carpeta> [puerto]\n  Puerto por defecto: variable PORT o 5190.");
  process.exit(carpetaArg ? 0 : 1);
}

const raiz = path.resolve(carpetaArg);
if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
  console.error(`Error: no existe la carpeta ${raiz}`);
  process.exit(1);
}
const puerto = Number(puertoArg ?? process.env.PORT ?? 5190);
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  console.error(`Error: puerto inválido (${puertoArg ?? process.env.PORT}).`);
  process.exit(1);
}

// Convierte la ruta del pedido en una ruta de disco, o null si intenta salir de la carpeta
function rutaEnDisco(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return { error: 400 }; }
  if (p.includes("\0")) return { error: 400 };
  // En Windows ":" abriría flujos alternativos o unidades (C:\...): no hay motivo para aceptarlo
  if (process.platform === "win32" && p.includes(":")) return { error: 404 };
  const abs = path.join(raiz, p); // join resuelve los ".."
  const rel = path.relative(raiz, abs);
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return { error: 403 };
  return { abs };
}

const cabecerasBase = (tipo) => ({ "Content-Type": tipo, "Cache-Control": "no-store", "Accept-Ranges": "bytes" });

function texto(res, estado, cuerpo, extra = {}) {
  res.writeHead(estado, { ...cabecerasBase("text/plain; charset=utf-8"), "Content-Length": Buffer.byteLength(cuerpo), ...extra });
  res.end(cuerpo);
}

async function stat(ruta) {
  try { return await fs.promises.stat(ruta); } catch { return null; }
}

function enviar(req, res, abs, st, estado = 200) {
  const tipo = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const cab = cabecerasBase(tipo);
  let inicio = 0, fin = st.size - 1, codigo = estado;

  // Pedido por rango: un solo rango; si no se entiende, se responde el archivo entero
  const rango = estado === 200 ? req.headers.range : null;
  if (rango) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
    if (m && (m[1] || m[2])) {
      if (m[1] === "") { inicio = Math.max(0, st.size - Number(m[2])); } // "-500": los últimos 500 bytes
      else {
        inicio = Number(m[1]);
        if (m[2] !== "") fin = Math.min(Number(m[2]), st.size - 1);
      }
      if (inicio > fin || inicio >= st.size) {
        res.writeHead(416, { ...cab, "Content-Range": `bytes */${st.size}`, "Content-Length": 0 });
        return res.end();
      }
      codigo = 206;
      cab["Content-Range"] = `bytes ${inicio}-${fin}/${st.size}`;
    }
  }

  const largo = st.size === 0 ? 0 : fin - inicio + 1;
  cab["Content-Length"] = largo;
  res.writeHead(codigo, cab);
  if (req.method === "HEAD" || largo === 0) return res.end();
  const flujo = fs.createReadStream(abs, { start: inicio, end: fin });
  // pipeline cierra el archivo si el navegador corta el pedido (pasa seguido al saltar en un video)
  pipeline(flujo, res, () => {});
}

async function noEncontrado(req, res, pathname) {
  const p404 = path.join(raiz, "404.html");
  const st = await stat(p404);
  if (st && st.isFile()) {
    // Sin Range: la página de error se manda siempre entera
    const reqSinRango = { method: req.method, headers: {} };
    return enviar(reqSinRango, res, p404, st, 404);
  }
  texto(res, 404, `404 · No se encontró ${pathname}\n`);
}

const servidor = http.createServer(async (req, res) => {
  const crudo = req.url.split("#")[0];
  const [pathname, consulta] = [crudo.split("?")[0], crudo.includes("?") ? crudo.slice(crudo.indexOf("?")) : ""];
  const avisar = () => { if (res.statusCode >= 400) console.log(`${res.statusCode} ${req.method} ${pathname}`); };
  res.on("finish", avisar);

  try {
    if (req.method !== "GET" && req.method !== "HEAD") return texto(res, 405, "405 · Solo GET y HEAD\n", { Allow: "GET, HEAD" });

    const r = rutaEnDisco(pathname);
    if (r.error === 404) return noEncontrado(req, res, pathname);
    if (r.error === 403) return texto(res, 403, "403 · Fuera de la carpeta\n");
    if (r.error) return texto(res, 400, "400 · Pedido inválido\n");

    let abs = r.abs;
    let st = await stat(abs);
    if (st && st.isDirectory()) {
      // Sin la barra final los links relativos de la página quedarían mal
      if (!pathname.endsWith("/")) {
        res.writeHead(301, { Location: pathname + "/" + consulta, "Cache-Control": "no-store" });
        return res.end();
      }
      abs = path.join(abs, "index.html");
      st = await stat(abs);
    }
    if (!st || !st.isFile()) return noEncontrado(req, res, pathname);
    enviar(req, res, abs, st);
  } catch (e) {
    console.error("Error al servir", pathname, e.message);
    if (!res.headersSent) texto(res, 500, "500 · Error del servidor\n"); else res.destroy();
  }
});

servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`Error: el puerto ${puerto} ya está en uso. Probá con otro: node herramientas/servidor.js ${carpetaArg} ${puerto + 1}`);
  else console.error("Error del servidor:", e.message);
  process.exit(1);
});

servidor.listen(puerto, "127.0.0.1", () => {
  console.log(`Sirviendo ${raiz}\n  → http://127.0.0.1:${puerto}/   (Ctrl+C para frenar)`);
});

function apagar() {
  servidor.close(() => process.exit(0));
  servidor.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
