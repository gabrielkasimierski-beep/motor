// Pruebas chicas de las piezas del publicador de Meta (sin simulador ni red).
//   node --test        (desde maquina-de-contenido/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { registrarSecreto, sanear, contieneSecreto, nombreZona, parsearEnv, GRAPH_INSTAGRAM } from "../herramientas/meta/entorno.mjs";
import { clienteInstagram, crearCliente } from "../herramientas/meta/graph.mjs";
import { ErrorMeta } from "../herramientas/meta/errores.mjs";
import { validarImagen, validarCarrusel } from "../herramientas/meta/validar.mjs";
import { estadoDe, buscarPieza } from "../herramientas/meta/calendario.mjs";
import { esDelDriveDelTrabajo } from "../herramientas/meta/archivos.mjs";
import { revisarBaseUrl, esDeDrive } from "../herramientas/meta/medios.mjs";
import { normalizarTexto } from "../herramientas/meta/instagram.mjs";

const MB = 1048576;
const img = (ancho, alto, bytes = 200_000) => ({ ruta: `x/${ancho}x${alto}.jpg`, ancho, alto, bytes, mpo: false });

test("sanear tapa el token entero y cualquier pedazo de 8 caracteres o más", () => {
  const token = "EAAunidad-secreto-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123";
  registrarSecreto(token);
  assert.equal(sanear(`token=${token}`), "token=EAAu…");
  const recortado = sanear(`"META_ACCESS_TOKEN=${token}"`.slice(0, 40) + "…");
  assert.ok(!recortado.includes(token.slice(0, 12)), recortado);
  assert.match(sanear(`Malformed access token ${token.slice(0, 30)}...`), /Malformed access token EAAu…\.\.\./);
  assert.match(sanear(`algo ${token.slice(10, 25)} más`), /^algo EAAu… más$/);
  assert.equal(sanear("Mismo laburo. Mucho menos lío."), "Mismo laburo. Mucho menos lío.");
  assert.ok(contieneSecreto(`hola ${token.slice(12, 20)}`));
  assert.ok(contieneSecreto("META_ACCESS_TOKEN="));
  assert.ok(!contieneSecreto("Soluciones con IA para negocios. #pymes"));
});

test("errores: códigos -1 y -2 de Instagram, 368 sin reintento, 500 sin code y falta de ads_read", () => {
  const menos1 = new ErrorMeta({ http: 400, error: { code: -1, error_subcode: 2207001, message: "x" } });
  assert.match(menos1.message, /error del servidor de Instagram/);
  assert.ok(menos1.pasajero);
  const largo = new ErrorMeta({ http: 400, error: { code: 36004, error_subcode: 2207010 } });
  assert.match(largo.message, /el texto es demasiado largo: el texto pasa el máximo/);
  const tarde = new ErrorMeta({ http: 400, error: { code: 24, error_subcode: 2207008 } });
  assert.match(tarde.sugerencia, /entre 30 segundos y 2 minutos/);
  const bloqueo = new ErrorMeta({ http: 400, error: { code: 368 } });
  assert.equal(bloqueo.limite, false, "un bloqueo por políticas no se reintenta");
  assert.match(bloqueo.sugerencia, /no insistas/);
  const caido = new ErrorMeta({ http: 502, error: { message: "<html>" } });
  assert.match(caido.sugerencia, /Meta está con problemas/);
  const ads = new ErrorMeta({ http: 403, error: { code: 200, message: "The calling app is missing the ads_management permission for the target." } });
  assert.match(ads.sugerencia, /ads_read/);
});

test("validar: historias 9:16 es recomendación, 4:5 exacto, 4 MB por /photos y tope de 10 solo en Instagram", () => {
  const h = validarImagen(img(1080, 1350), { uso: "historia", redes: ["instagram"] });
  assert.deepEqual(h.errores, []);
  assert.match(h.avisos.join(), /Meta recomienda 9:16/);
  assert.deepEqual(validarImagen(img(1080, 1350), { uso: "feed", redes: ["instagram"] }).errores, []);
  assert.match(validarImagen(img(1080, 1358), { uso: "feed", redes: ["instagram"] }).errores.join(), /entre 4:5 y 1\.91:1/);
  // Historia de Facebook con foto: pasa por /photos, tope 4 MB (no 10).
  assert.match(validarImagen(img(1080, 1920, 5 * MB), { uso: "historia", redes: ["facebook"] }).errores.join(), /4 MB/);
  // Solo Instagram pero con --medios=facebook: también pasa por /photos.
  assert.match(validarImagen(img(1080, 1350, 5 * MB), { uso: "feed", redes: ["instagram"], porPhotos: true }).errores.join(), /4 MB/);
  assert.deepEqual(validarImagen(img(1080, 1350, 5 * MB), { uso: "feed", redes: ["instagram"] }).errores, []);
  const once = Array.from({ length: 11 }, () => img(1080, 1350));
  assert.deepEqual(validarCarrusel(once, { redes: ["facebook"] }).errores, []);
  assert.match(validarCarrusel(once, { redes: ["instagram"] }).errores.join(), /Instagram acepta hasta 10/);
});

test("calendario: estado exacto y la pieza por archivo citado, nunca por la celda Estado", () => {
  assert.equal(estadoDe("aprobado"), "aprobado");
  for (const c of ["aprobado?", "Aprobado", "**aprobado**", "aprobado (falta la persona responsable)"]) assert.notEqual(estadoDe(c), "aprobado", c);
  assert.equal(estadoDe("publicado ([IG](https://x) · [FB](https://y))"), "publicado");
  const md = [
    "| Día | Fecha | Pieza | Pilar | Palabra clave | Estado | Carpeta |", "|---|---|---|---|---|---|---|",
    "| 1 | x | 01 · Presentación | marca | — | aprobado | `salidas/t1/01-presentacion/` |", "",
    "| Día | Historia | Estado |", "|---|---|---|",
    "| 1 | `perfil/historia-hola.png` + compartir el post 01 | aprobado |", "",
  ].join("\n");
  assert.equal(buscarPieza(md, "t1", "01-presentacion").estado, "aprobado");
  assert.equal(buscarPieza(md, "t2", "01-presentacion"), null, "otra tanda no coincide");
  assert.equal(buscarPieza(md, "t1", "historia-hola").estado, "aprobado");
  assert.equal(buscarPieza(md, "t1", "aprobado"), null);
  assert.equal(buscarPieza(md, "t1", "perfil"), null);
  assert.equal(buscarPieza(md, "t1", "01"), null);
});

test("nada de G: ni de Google Drive, escrito como sea", () => {
  for (const r of ["G:/Mi unidad/x.jpg", "g:\\x.jpg", "//?/G:/Mi unidad/x.jpg", "\\\\?\\G:\\x.jpg", "//localhost/G$/x.jpg", "\\\\127.0.0.1\\g$\\x", "\\\\?\\UNC\\localhost\\G$\\x"]) {
    assert.ok(esDelDriveDelTrabajo(r), r);
  }
  assert.ok(!esDelDriveDelTrabajo("C:/Proyecto/publicar/x.jpg"));
  for (const u of ["https://drive.usercontent.google.com/download?id=1", "https://drive.google.com/x", "https://lh3.googleusercontent.com/x", "https://www.googleapis.com/drive/v3/files/1"]) {
    assert.ok(esDeDrive(u), u);
    assert.throws(() => revisarBaseUrl(u), /Google/);
  }
  assert.equal(revisarBaseUrl("https://somosproyecto.com/medios/"), "https://somosproyecto.com/medios");
});

test("hosts de verdad: el cliente de Instagram arma graph.instagram.com y el de Facebook graph.facebook.com", () => {
  // Sin red ni simulador: lo que se fija es adónde iría cada token con los hosts reales.
  const guardado = { META_API_BASE: process.env.META_API_BASE, META_RAIZ: process.env.META_RAIZ };
  delete process.env.META_API_BASE;
  delete process.env.META_RAIZ;
  try {
    assert.equal(GRAPH_INSTAGRAM, "https://graph.instagram.com");
    const entorno = { igGraph: GRAPH_INSTAGRAM, graph: "https://graph.facebook.com", rupload: "https://rupload.facebook.com", version: "v26.0", igToken: "IGAA" + "x".repeat(40), token: "EAA" + "y".repeat(40) };
    const ig = clienteInstagram(entorno, { simular: true });
    assert.equal(ig.base, "https://graph.instagram.com/v26.0", "INSTAGRAM_TOKEN va solo a graph.instagram.com");
    const fb = crearCliente(entorno, { simular: true });
    assert.equal(fb.base, "https://graph.facebook.com/v26.0", "el camino de Facebook sigue en graph.facebook.com");
    assert.equal(fb.rupload, "https://rupload.facebook.com");
  } finally {
    for (const [k, v] of Object.entries(guardado)) if (v !== undefined) process.env[k] = v;
  }
});

test(".env: comillas con comentario, saltos sueltos (\\r) y la última línea que se repite", () => {
  assert.deepEqual(parsearEnv('INSTAGRAM_TOKEN="IGAAabc"  # el de proyecto\r\nB=2'), { INSTAGRAM_TOKEN: "IGAAabc", B: "2" });
  assert.deepEqual(parsearEnv("META_ACCESS_TOKEN=\rINSTAGRAM_TOKEN=IGAAabc\rX=1"), { META_ACCESS_TOKEN: "", INSTAGRAM_TOKEN: "IGAAabc", X: "1" });
  assert.deepEqual(parsearEnv("A=1 # nota\nA=2"), { A: "2" });
});

test("varios: texto sin @ para comparar y el nombre de la zona horaria", () => {
  assert.equal(normalizarTexto("Hola @cuenta_demo\n\n#pymes "), normalizarTexto("Hola cuenta_demo #pymes"));
  assert.equal(nombreZona("America/Argentina/Buenos_Aires"), "hora de Buenos Aires");
  assert.equal(nombreZona("America/New_York"), "hora de New York (America/New_York)");
});
