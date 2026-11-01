// Pasa cada archivo de prueba a Node: funciona en Windows sin glob del shell.
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const carpeta = join(raiz, "pruebas");
const archivos = readdirSync(carpeta, { withFileTypes: true })
  .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".test.mjs"))
  .map((entrada) => join(carpeta, entrada.name))
  .sort();

if (archivos.length === 0) {
  console.error("No hay archivos .test.mjs en pruebas/.");
  process.exitCode = 1;
} else {
  const resultado = spawnSync(process.execPath, ["--test", ...archivos], {
    cwd: raiz,
    stdio: "inherit",
  });
  if (resultado.error) {
    console.error("No se pudo iniciar el ejecutor de pruebas de Node.");
    process.exitCode = 1;
  } else {
    process.exitCode = resultado.status ?? 1;
  }
}
