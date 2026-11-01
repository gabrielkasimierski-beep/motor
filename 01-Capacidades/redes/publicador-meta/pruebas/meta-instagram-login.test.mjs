// Pruebas del modo Instagram: "Instagram API with Instagram Login" (graph.instagram.com, INSTAGRAM_TOKEN),
// contra el simulador local (nada sale de esta compu).
//   node --test        (desde maquina-de-contenido/)
// Cada prueba arma una copia mínima del proyecto en una carpeta temporal (META_RAIZ): el .env real,
// el calendario y los registros reales no se tocan. correr() revisa además que ningún token (ni un
// pedazo de 8 caracteres, tampoco los renovados) salga por pantalla ni quede en un archivo.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, chmodSync, cpSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { iniciarSimulador, TOKEN_IG, TOKEN_PRUEBA, TOKEN_PAGINA, PAGE_ID, IG_ID } from "./simulador-meta.mjs";
import { RAIZ, TANDA, TEXTO, jpeg, mp4, crearProyecto, enPieza, correr, args, posts, leer, registro, limpiarTemporales, conTokenAProposito, envDe } from "./armado.mjs";
import { reemplazarToken } from "../herramientas/meta/token-instagram.mjs";
import { contieneSecreto } from "../herramientas/meta/entorno.mjs";

after(limpiarTemporales);

const HORA = 3_600_000;
const DIA = 24 * HORA;
const iso = (ms) => new Date(ms).toISOString();
// publicar sin --red: en el modo Instagram la red por defecto es instagram.
const publicarIg = (id, ...mas) => ["publicar", `--tanda=${TANDA}`, `--id=${id}`, ...mas];
const proyectoIg = (sim, op = {}) => crearProyecto(sim, { ...op, modo: "instagram" });
const archivoFechas = (raiz) => join(raiz, "registro-meta", "token-instagram.json");
// Las fechas del token como las dejaría el publicador (con la fecha actual de .env, para que valgan).
function escribirFechas(raiz, { emitido, renovado = emitido, vence = null }) {
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  const m = statSync(join(raiz, ".env")).mtimeMs;
  writeFileSync(archivoFechas(raiz), JSON.stringify({ emitido: iso(emitido), renovado: renovado ? iso(renovado) : null, vence: vence ? iso(vence) : null, envModificado: iso(m) }, null, 2));
}
const renovaciones = (sim) => sim.pedidos.filter((p) => p.ruta === "/refresh_access_token");
const aMeta = (sim) => sim.pedidosAMeta();
// Lo que hay en la carpeta que empiece con ".env" (no puede quedar ningún temporal).
const envs = (raiz) => readdirSync(raiz).filter((n) => n.startsWith(".env")).sort();

// ---------- elegir el modo ----------
test("modo Instagram: simulación sin red, sin --red va a Instagram y muestra el host de Instagram (el del simulador) con user_id", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "c1", laminas: 3 }] });
  const r = await correr(raiz, sim, publicarIg("c1"));
  assert.equal(r.codigo, 0, r.todo);
  assert.equal(sim.pedidos.length, 0, "en simulación no puede salir ningún pedido");
  assert.match(r.salida, /MODO SIMULACIÓN/);
  // El host que se muestra es el del cliente, adonde de verdad irían los pedidos (acá, el "graph.instagram.com"
  // del simulador: localhost). Sin simulador muestra graph.instagram.com (prueba de la carpeta real, más abajo).
  assert.match(r.salida, new RegExp(`Pedidos que haría a Instagram \\(localhost:${sim.puerto}, .*INSTAGRAM_TOKEN de \\.env, que no se muestra: IGAA…\\)`));
  assert.match(r.salida, /GET  http:\/\/localhost:\d+\/v26\.0\/me\?fields=user_id,username,account_type/);
  assert.match(r.salida, /<user_id>\/media_publish/);
  assert.doesNotMatch(r.salida, new RegExp(PAGE_ID), "en el modo Instagram no se consulta ninguna página");
  assert.doesNotMatch(r.salida, /meta\.paginaFacebook/);
  assert.match(r.salida, /Nada se mandó/);
  assert.ok(!existsSync(join(raiz, "registro-meta")), "la simulación no escribe nada (ni las fechas del token)");
});

// ---------- de punta a punta contra el simulador ----------
test("carrusel en el modo Instagram: graph.instagram.com, INSTAGRAM_TOKEN en la cabecera, user_id y registros", async (t) => {
  const sim = await iniciarSimulador({ sondeosEnCurso: 2 });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "c1", laminas: 3, clave: "TURNOS" }] });
  const r = await correr(raiz, sim, publicarIg("c1", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /Cuenta: Instagram @cuenta_demo \(inicio de sesión de Instagram\)/);

  const meta = aMeta(sim);
  assert.ok(meta.length > 0);
  assert.ok(meta.every((p) => p.auth === `Bearer ${TOKEN_IG}`), "todo a Meta va con INSTAGRAM_TOKEN en la cabecera");
  assert.ok(meta.every((p) => p.lado === "instagram"), "todo llegó por el host de Instagram (en el simulador, localhost)");
  assert.ok(meta.every((p) => !("access_token" in p.query)), "el token nunca va en la URL");
  assert.ok(!meta.some((p) => p.ruta.includes(PAGE_ID)), "nada de páginas de Facebook");
  assert.ok(!meta.some((p) => p.ruta.startsWith("/ig-api-upload")), "nada de rupload");
  assert.equal(meta[0].ruta, "/v26.0/me");
  assert.equal(meta[0].query.fields, "user_id,username,account_type");

  const medias = posts(sim, `/v26.0/${IG_ID}/media`);
  const hijos = medias.filter((p) => p.cuerpo.is_carousel_item === true);
  assert.deepEqual(hijos.map((h) => h.cuerpo.image_url), ["01", "02", "03"].map((n) => `${sim.url}/medios/${TANDA}/c1/${n}.jpg`));
  assert.ok(hijos.every((h) => h.cuerpo.caption === undefined));
  const carrusel = medias.find((p) => p.cuerpo.media_type === "CAROUSEL");
  assert.equal(carrusel.cuerpo.caption, TEXTO);
  const idsHijos = [...sim.estado.contenedores.values()].filter((c) => c.tipo === "HIJO").map((c) => c.id);
  assert.equal(carrusel.cuerpo.children, idsHijos.join(","));
  assert.ok([...sim.estado.contenedores.values()].every((c) => c.ig), "los contenedores se crearon en graph.instagram.com");
  const publicar = posts(sim, `/v26.0/${IG_ID}/media_publish`);
  assert.equal(publicar.length, 1);
  assert.equal(publicar[0].cuerpo.creation_id, [...sim.estado.contenedores.values()].find((c) => c.tipo === "CAROUSEL").id);

  const permalink = sim.estado.medias[0].permalink;
  const reg = registro(raiz);
  assert.equal(reg.length, 1);
  assert.deepEqual([reg[0].red, reg[0].formato, reg[0].estado, reg[0].cuenta, reg[0].permalink], ["instagram", "carrusel", "publicado", "@cuenta_demo", permalink]);
  assert.match(leer(raiz, "calendario.md"), new RegExp(`\\| publicado \\(\\[IG\\]\\(${permalink.replace(/[.?]/g, "\\$&")}\\)\\) \\|`));
  // La primera vez que ve el token anota la fecha (solo fechas).
  const fechas = JSON.parse(readFileSync(archivoFechas(raiz), "utf8"));
  assert.deepEqual(Object.keys(fechas).sort(), ["emitido", "envModificado", "nota", "renovado", "vence"]);
  assert.equal(fechas.renovado, null);
  assert.equal(renovaciones(sim).length, 0, "un token recién visto no se renueva");
});

test("imagen sola en el modo Instagram: un contenedor con image_url y caption", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, publicarIg("i1", "--red=instagram", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const medias = posts(sim, `/${IG_ID}/media`);
  assert.equal(medias.length, 1);
  assert.deepEqual(medias[0].cuerpo, { image_url: `${sim.url}/medios/${TANDA}/i1/01.jpg`, caption: TEXTO });
  assert.equal(posts(sim, "/media_publish").length, 1);
  assert.equal(registro(raiz)[0].formato, "imagen");
});

test("reel en el modo Instagram: va por video_url (sin carga reanudable) y el video de la web tiene que ser el de la carpeta", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { reels: [{ id: "r1" }] });
  const video = enPieza(raiz, "r1", "reel.mp4", mp4(20, 40_000, { ancho: 1080, alto: 1920 }));
  const portada = enPieza(raiz, "r1", "portada.jpg", jpeg(1080, 1920));
  const texto = enPieza(raiz, "r1", "texto.txt", "Un reel de prueba. #pymes\n");

  // En la web hay otro video (una versión vieja): se frena antes de crear nada.
  const web = join(raiz, "web-vieja");
  mkdirSync(join(web, TANDA, "r1"), { recursive: true });
  writeFileSync(join(web, TANDA, "r1", "reel.mp4"), mp4(20, 40_001, { ancho: 1080, alto: 1920 }));
  writeFileSync(join(web, TANDA, "r1", "portada.jpg"), readFileSync(portada));
  sim.escenario.carpetaMedios = web;
  const vieja = await correr(raiz, sim, publicarIg("r1", `--video=${video}`, `--portada=${portada}`, `--texto=${texto}`, "--de-verdad"));
  assert.notEqual(vieja.codigo, 0, vieja.todo);
  assert.match(vieja.error, /reel\.mp4 en la web .* no es igual a la copia local/);
  assert.equal(aMeta(sim).length, 0);

  sim.escenario.carpetaMedios = join(raiz, "publicar");
  const r = await correr(raiz, sim, publicarIg("r1", `--video=${video}`, `--portada=${portada}`, `--texto=${texto}`, "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const bajadas = sim.pedidos.filter((p) => p.ruta === `/medios/${TANDA}/r1/reel.mp4`);
  assert.ok(bajadas.length >= 2 && bajadas.every((p) => p.auth === ""), "comprobó el video publicado, sin token");
  const cont = posts(sim, `/${IG_ID}/media`);
  assert.equal(cont.length, 1);
  assert.deepEqual(cont[0].cuerpo, {
    media_type: "REELS",
    video_url: `${sim.url}/medios/${TANDA}/r1/reel.mp4`,
    caption: "Un reel de prueba. #pymes",
    share_to_feed: true,
    cover_url: `${sim.url}/medios/${TANDA}/r1/portada.jpg`,
  });
  assert.ok(!sim.pedidos.some((p) => p.ruta.startsWith("/ig-api-upload")), "nada de rupload en el modo Instagram");
  assert.equal(posts(sim, "/media_publish").length, 1);
  assert.deepEqual(registro(raiz).map((p) => `${p.red}/${p.formato}/${p.estado}`), ["instagram/reel/publicado"]);
});

test("historia en el modo Instagram: con imagen (image_url) y con video (video_url)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { historias: [{ id: "h-imagen" }, { id: "h-video" }] });
  const imagen = enPieza(raiz, "h-imagen", "historia.jpg", jpeg(1080, 1920));
  const video = enPieza(raiz, "h-video", "historia.mp4", mp4(15, 30_000, { ancho: 1080, alto: 1920 }));

  const r1 = await correr(raiz, sim, publicarIg("h-imagen", "--formato=historia", `--imagen=${imagen}`, "--de-verdad"));
  assert.equal(r1.codigo, 0, r1.todo);
  const r2 = await correr(raiz, sim, publicarIg("h-video", "--formato=historia", `--video=${video}`, "--de-verdad"));
  assert.equal(r2.codigo, 0, r2.todo);
  const cuerpos = posts(sim, `/${IG_ID}/media`).map((p) => p.cuerpo);
  assert.deepEqual(cuerpos, [
    { media_type: "STORIES", image_url: `${sim.url}/medios/${TANDA}/h-imagen/historia.jpg` },
    { media_type: "STORIES", video_url: `${sim.url}/medios/${TANDA}/h-video/historia.mp4` },
  ]);
  assert.equal(posts(sim, "/media_publish").length, 2);
  assert.ok(sim.estado.medias.every((m) => m.tipo === "STORIES"));
  assert.deepEqual(registro(raiz).map((p) => `${p.id}/${p.formato}/${p.estado}`), ["h-imagen/historia/publicado", "h-video/historia/publicado"]);
});

test("media_publish sin respuesta en el modo Instagram: no publica dos veces y queda dudoso si no encuentra el link", async (t) => {
  const sim = await iniciarSimulador({ caerseEnPublicar: true });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.notEqual(r.codigo, 0, r.todo);
  assert.equal(sim.estado.medias.length, 1, "salió una sola vez");
  assert.equal(posts(sim, "/media_publish").length, 1, "no se repitió a ciegas: el contenedor dice PUBLISHED");
  // Con inicio de sesión de Instagram, /media no trae el caption: no se puede confirmar cuál es, queda dudoso.
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso"]);
  assert.match(r.salida, /resolver --tanda=2099-01-prueba --id=i1 --red=instagram --salio=si/);
});

// ---------- seguros ----------
test("cuenta ajena: si INSTAGRAM_TOKEN no es de @cuenta_demo (o no es profesional), no publica", async (t) => {
  for (const [esc, error] of [
    [{ usuario: "otra.cuenta" }, /INSTAGRAM_TOKEN es de @otra\.cuenta y config\.json espera @cuenta_demo: este publicador es solo para las cuentas de proyecto/],
    [{ usuario: "" }, /Meta no devolvió el usuario de la cuenta de INSTAGRAM_TOKEN/],
    [{ tipoCuenta: "PERSONAL" }, /tipo PERSONAL: para publicar por API tiene que ser profesional/],
  ]) {
    const sim = await iniciarSimulador(esc);
    t.after(sim.cerrar);
    const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
    const r = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
    assert.notEqual(r.codigo, 0, r.todo);
    assert.match(r.error, error);
    assert.equal(posts(sim, "/media").length, 0, "no se creó ningún contenedor");
    assert.equal(registro(raiz).length, 0);
  }
});

test("--red=facebook y --red=ambas se rechazan en el modo Instagram; --medios=facebook tampoco existe", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  for (const red of ["facebook", "ambas"]) {
    for (const extra of [[], ["--de-verdad"]]) {
      const r = await correr(raiz, sim, publicarIg("i1", `--red=${red}`, ...extra));
      assert.equal(r.codigo, 2, r.todo);
      assert.match(r.error, /Facebook todavía no está conectado \(falta el portfolio\); por ahora solo Instagram/);
    }
  }
  const medios = await correr(raiz, sim, publicarIg("i1", "--medios=facebook"));
  assert.equal(medios.codigo, 2);
  assert.match(medios.error, /--medios=facebook no está disponible en el modo Instagram/);
  assert.equal(sim.pedidos.length, 0);
  assert.ok(!existsSync(join(raiz, "registro-meta")));
});

test("con los dos tokens: avisa, Instagram va con INSTAGRAM_TOKEN, Facebook con META_ACCESS_TOKEN, y de a una red", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }], modo: "mixto" });
  const ambas = await correr(raiz, sim, args("i1", "ambas", "--de-verdad"));
  assert.equal(ambas.codigo, 2);
  assert.match(ambas.error, /se publica de a una red por vez/);
  assert.equal(sim.pedidos.length, 0);

  const ig = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.equal(ig.codigo, 0, ig.todo);
  assert.match(ig.salida, /están INSTAGRAM_TOKEN y META_ACCESS_TOKEN/);
  const deIg = aMeta(sim);
  assert.ok(deIg.every((p) => p.auth === `Bearer ${TOKEN_IG}`), "Instagram solo con INSTAGRAM_TOKEN");
  assert.ok(deIg.every((p) => p.lado === "instagram"), "Instagram solo por el host de Instagram");

  const fb = await correr(raiz, sim, args("i1", "facebook", "--de-verdad"));
  assert.equal(fb.codigo, 0, fb.todo);
  const deFb = aMeta(sim).slice(deIg.length);
  assert.ok(deFb.every((p) => p.auth === `Bearer ${TOKEN_PRUEBA}` || p.auth === `Bearer ${TOKEN_PAGINA}`), "Facebook nunca con el token de Instagram");
  assert.ok(deFb.every((p) => p.lado === "facebook"), "Facebook solo por el host de Facebook");
  assert.equal(posts(sim, `/${PAGE_ID}/photos`).length, 1);
  assert.deepEqual(registro(raiz).map((p) => `${p.red}/${p.estado}`), ["instagram/publicado", "facebook/publicado"]);

  // verificar revisa las dos partes; del token de Facebook no pide lo de Instagram.
  const v = await correr(raiz, sim, ["verificar"]);
  assert.equal(v.codigo, 0, v.todo);
  assert.match(v.salida, /Verificando Instagram con inicio de sesión de Instagram/);
  assert.match(v.salida, /Facebook \(META_ACCESS_TOKEN, solo para --red=facebook\):/);
  assert.doesNotMatch(v.salida, /instagram_basic|ads_read/);
  assert.match(v.salida, /Todo en orden/);
});

test("modo Facebook intacto: renovar se niega y publicar sigue pidiendo --red", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 2);
  assert.match(r.error, /renovar es para INSTAGRAM_TOKEN/);
  const sinRed = await correr(raiz, sim, ["publicar", `--tanda=${TANDA}`, "--id=i1"]);
  assert.equal(sinRed.codigo, 2);
  assert.match(sinRed.error, /falta --red=instagram\|facebook\|ambas/);
  assert.equal(sim.pedidos.length, 0);
});

// ---------- renovación del token ----------
test("renovar: pide el token nuevo con grant_type=ig_refresh_token, lo guarda en .env (solo esa línea) y anota solo fechas", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const ahora = Date.now();
  escribirFechas(raiz, { emitido: ahora - 8 * DIA, vence: ahora + 52 * DIA });
  const antes = readFileSync(join(raiz, ".env"), "utf8");
  assert.ok(antes.includes("\r\n"), "el .env de prueba tiene saltos de Windows");

  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /Listo: token renovado, le quedan 59 días \(vence el \d{4}-\d{2}-\d{2}\)/);
  assert.equal(sim.estado.tokensNuevos.length, 1);
  const nuevo = sim.estado.tokensNuevos[0];
  // .env: igual byte a byte salvo el token (comentarios, otras líneas y \r\n intactos).
  assert.equal(readFileSync(join(raiz, ".env"), "utf8"), antes.replace(TOKEN_IG, nuevo));
  assert.deepEqual(envs(raiz), [".env"], "no quedó ningún temporal ni copia");
  // El pedido: el token en la URL (la doc no da otra forma), sin cabecera y a /refresh_access_token.
  const [ren] = renovaciones(sim);
  assert.deepEqual(ren.query, { grant_type: "ig_refresh_token", access_token: TOKEN_IG });
  assert.equal(ren.metodo, "GET");
  assert.equal(ren.auth, "", "el token no va además en la cabecera");
  assert.equal(ren.lado, "instagram", "la renovación va al host de Instagram");
  // Las fechas: solo fechas.
  const f = JSON.parse(readFileSync(archivoFechas(raiz), "utf8"));
  assert.deepEqual(Object.keys(f).sort(), ["emitido", "envModificado", "nota", "renovado", "vence"]);
  for (const k of ["emitido", "renovado", "vence", "envModificado"]) assert.ok(!Number.isNaN(Date.parse(f[k])), `${k} es una fecha`);
  assert.ok(Math.abs(Date.parse(f.vence) - Date.parse(f.renovado) - 5183944_000) < 5_000);

  // Lo que sigue usa el token nuevo, y verificar no vuelve a renovar (se renovó recién).
  const v = await correr(raiz, sim, ["verificar"]);
  assert.equal(v.codigo, 0, v.todo);
  assert.match(v.salida, /Token: le quedan 59 días/);
  const despues = aMeta(sim).filter((p) => p.ruta !== "/refresh_access_token");
  assert.ok(despues.length && despues.every((p) => p.auth === `Bearer ${nuevo}`), "verificar usa el token nuevo de .env");
  assert.equal(renovaciones(sim).length, 1);
});

test("renovación automática: verificar y publicar --de-verdad renuevan cuando pasó una semana o quedan menos de 20 días", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const ahora = Date.now();

  // Renovado hace 3 días y le quedan 57: no toca.
  escribirFechas(raiz, { emitido: ahora - 3 * DIA, vence: ahora + 57 * DIA });
  const v0 = await correr(raiz, sim, ["verificar"]);
  assert.equal(v0.codigo, 0, v0.todo);
  assert.equal(renovaciones(sim).length, 0);

  // Renovado hace 8 días: verificar lo renueva.
  escribirFechas(raiz, { emitido: ahora - 8 * DIA, vence: ahora + 52 * DIA });
  const v1 = await correr(raiz, sim, ["verificar"]);
  assert.equal(v1.codigo, 0, v1.todo);
  assert.match(v1.salida, /Token de Instagram: lo renuevo \(pasó más de una semana desde la última renovación\)/);
  assert.equal(renovaciones(sim).length, 1);

  // Hace 2 días, pero le quedan 10 (un token que llegó así): publicar --de-verdad lo renueva antes de publicar.
  escribirFechas(raiz, { emitido: ahora - 2 * DIA, vence: ahora + 10 * DIA });
  const p = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.equal(p.codigo, 0, p.todo);
  assert.match(p.salida, /lo renuevo \(le quedan menos de 20 días\)/);
  assert.equal(renovaciones(sim).length, 2);
  const ultimo = sim.estado.tokensNuevos[1];
  const iRen = sim.pedidos.lastIndexOf(renovaciones(sim)[1]);
  assert.ok(sim.pedidos.slice(iRen + 1).filter((x) => !x.ruta.startsWith("/medios/")).every((x) => x.auth === `Bearer ${ultimo}`), "publica con el token recién renovado");
  assert.equal(sim.estado.medias.length, 1);
  assert.ok(leer(raiz, ".env").includes(`INSTAGRAM_TOKEN=${ultimo}\r\n`));
  assert.deepEqual(envs(raiz), [".env"]);
});

test("renovación que falla: no toca .env ni las fechas y avisa cuántos días quedan", async (t) => {
  const sim = await iniciarSimulador({ renovarFalla: { code: 190, message: "Error validating access token: the token can not be refreshed" }, ecoToken: true });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const ahora = Date.now();
  escribirFechas(raiz, { emitido: ahora - 10 * DIA, vence: ahora + 15 * DIA + HORA });
  const env = readFileSync(join(raiz, ".env"));
  const fechas = readFileSync(archivoFechas(raiz));

  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 1, r.todo);
  // Meta dijo que el token no sirve: no se contradice con "le quedan 15 días", y dice en qué línea va.
  assert.match(r.salida, /No se renovó\. No toqué \.env: sigue el mismo token, pero Meta contestó que no sirve/);
  assert.doesNotMatch(r.salida, /le quedan 15 días/);
  assert.match(r.salida, /el token de Meta no sirve/);
  assert.match(r.salida, /revisá que el token esté entero en la línea INSTAGRAM_TOKEN= .*README\.md/);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env), ".env quedó igual, byte a byte");
  assert.ok(readFileSync(archivoFechas(raiz)).equals(fechas), "las fechas quedaron igual");
  assert.deepEqual(envs(raiz), [".env"], "no quedó el temporal");

  // Sola, dentro de verificar: avisa y sigue (el token todavía sirve).
  const v = await correr(raiz, sim, ["verificar"]);
  assert.equal(v.codigo, 0, v.todo);
  assert.match(v.salida, /Aviso: no pude renovar el token de Instagram\. No toqué \.env; Meta contestó que el token no sirve/);
  assert.match(v.salida, /Todo en orden/);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env));
  assert.equal(renovaciones(sim).length, 2);

  // Otro error (code 100): dice cuántos días quedan y no habla de "la pieza" (en la renovación no hay pieza).
  sim.escenario.renovarFalla = { code: 100, message: "(#100) The access token can not be refreshed" };
  const cien = await correr(raiz, sim, ["renovar"]);
  assert.equal(cien.codigo, 1, cien.todo);
  assert.match(cien.salida, /No se renovó\. No toqué \.env: sigue el mismo token, y le quedan 15 días/);
  assert.match(cien.salida, /Qué hacer: Meta no dejó renovar el token/);
  assert.doesNotMatch(cien.salida, /datos de la pieza/);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env));
});

test("token muy nuevo: no se pide la renovación; sin fechas se anota el día y se renueva después de 24 h", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const env = readFileSync(join(raiz, ".env"));
  const ahora = Date.now();

  // Renovado hace 2 horas: ni a mano.
  escribirFechas(raiz, { emitido: ahora - 2 * HORA, vence: ahora + 60 * DIA - 2 * HORA });
  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /El token es muy nuevo: .* Meta pide que tenga al menos 24 h/);
  assert.equal(renovaciones(sim).length, 0);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env));

  // Sin fechas (recién pegado): verificar anota el día y dice que todavía no sabe cuánto le queda.
  writeFileSync(archivoFechas(raiz), "");
  const v1 = await correr(raiz, sim, ["verificar"]);
  assert.equal(v1.codigo, 0, v1.todo);
  assert.match(v1.salida, /Token de Instagram: es la primera vez que lo veo/);
  // Antes de la primera renovación da un tope seguro: 60 días desde que lo vio por primera vez.
  assert.match(v1.salida, /Token: le quedan como mucho 59 días \(vence a más tardar el \d{4}-\d{2}-\d{2}; lo voy a saber exacto en la primera renovación, que se puede desde el /);
  const f = JSON.parse(readFileSync(archivoFechas(raiz), "utf8"));
  assert.equal(f.renovado, null);
  assert.equal(f.vence, null);
  assert.ok(Math.abs(Date.parse(f.emitido) - Date.now()) < 60_000);
  const v2 = await correr(raiz, sim, ["verificar"]);
  assert.equal(v2.codigo, 0, v2.todo);
  assert.equal(renovaciones(sim).length, 0, "con menos de 24 h no se pide");

  // Si alguien edita .env (otro token), las fechas dejan de valer y se cuenta de nuevo.
  escribirFechas(raiz, { emitido: ahora - 30 * DIA, vence: ahora + 30 * DIA });
  writeFileSync(join(raiz, ".env"), readFileSync(join(raiz, ".env")));
  const futuro = Date.now() + 5_000;
  const { utimesSync } = await import("node:fs");
  utimesSync(join(raiz, ".env"), new Date(futuro), new Date(futuro));
  const v3 = await correr(raiz, sim, ["verificar"]);
  assert.match(v3.salida, /\.env cambió desde la última renovación/);
  assert.equal(renovaciones(sim).length, 0);

  // Dos días después (sin renovación previa): la primera renovación.
  escribirFechas(raiz, { emitido: ahora - 2 * DIA, renovado: null });
  const v4 = await correr(raiz, sim, ["verificar"]);
  assert.equal(v4.codigo, 0, v4.todo);
  assert.match(v4.salida, /lo renuevo \(todavía no lo había renovado nunca\)/);
  assert.equal(renovaciones(sim).length, 1);
  assert.match(v4.salida, /Token: le quedan 59 días/);
});

test("escritura de .env: solo cambia el valor del token, y si .env no se puede escribir ni se le pide a Meta", async (t) => {
  // Unidad: comentarios, comillas, export, \r\n, la última línea si hay dos, y el resto igual.
  const viejo = "IGAAviejo0000000000000000000000000000000000";
  const nuevo = "IGAAnuevo1111111111111111111111111111111111";
  const casos = [
    [`A=1\r\nINSTAGRAM_TOKEN=${viejo}\r\nB=2\r\n`, `A=1\r\nINSTAGRAM_TOKEN=${nuevo}\r\nB=2\r\n`],
    [`INSTAGRAM_TOKEN=${viejo}   # el de proyecto\n`, `INSTAGRAM_TOKEN=${nuevo}   # el de proyecto\n`],
    [`export INSTAGRAM_TOKEN="${viejo}"`, `export INSTAGRAM_TOKEN="${nuevo}"`],
    [`INSTAGRAM_TOKEN=viejisimo\nINSTAGRAM_TOKEN = ${viejo}\n`, `INSTAGRAM_TOKEN=viejisimo\nINSTAGRAM_TOKEN = ${nuevo}\n`],
    // Entre comillas y con un comentario después; y saltos de línea sueltos (\r), que quedan como estaban.
    [`INSTAGRAM_TOKEN="${viejo}"  # el de proyecto\r\n`, `INSTAGRAM_TOKEN="${nuevo}"  # el de proyecto\r\n`],
    [`A=1\rINSTAGRAM_TOKEN=${viejo}\rB=2\r`, `A=1\rINSTAGRAM_TOKEN=${nuevo}\rB=2\r`],
  ];
  for (const [antes, despues] of casos) assert.equal(reemplazarToken(antes, viejo, nuevo), despues);
  assert.throws(() => reemplazarToken(`INSTAGRAM_TOKEN=otro0000000000000000000000\n`, viejo, nuevo), /no tiene el token que estoy usando/);
  assert.throws(() => reemplazarToken("META_ACCESS_TOKEN=x\n", viejo, nuevo), /no encuentro la línea INSTAGRAM_TOKEN=/);

  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const ahora = Date.now();
  escribirFechas(raiz, { emitido: ahora - 8 * DIA, vence: ahora + 52 * DIA });

  // Un temporal de una renovación cortada se avisa (puede tener un token adentro).
  // El proceso 99999 no existe (en Windows los números de proceso son múltiplos de 4).
  writeFileSync(join(raiz, ".env.renovando-99999.tmp"), "# cortado a mitad\n");
  const aviso = await correr(raiz, sim, ["estado"]);
  assert.match(aviso.salida, /quedó "\.env\.renovando-99999\.tmp" .* renovación del token que se cortó/);
  // Con contenido puede ser la única copia del token nuevo: no manda a borrarlo a ciegas.
  assert.match(aviso.salida, /puede tener el token nuevo.*si el token anda, borralo; si dice que el token no sirve, .*renombralo a "\.env"/);
  const { unlinkSync } = await import("node:fs");
  writeFileSync(join(raiz, ".env.renovando-99999.tmp"), "");
  assert.match((await correr(raiz, sim, ["estado"])).salida, /quedó "\.env\.renovando-99999\.tmp" .*: está vacío\. Borralo/);
  unlinkSync(join(raiz, ".env.renovando-99999.tmp"));
  // El de una corrida que sigue viva (acá, el proceso de las pruebas) es una renovación en curso: no se avisa.
  writeFileSync(join(raiz, `.env.renovando-${process.pid}.tmp`), "# renovando ahora\n");
  assert.doesNotMatch((await correr(raiz, sim, ["estado"])).salida, /renovando-/, "no manda a borrar el temporal de otra corrida que está renovando");
  unlinkSync(join(raiz, `.env.renovando-${process.pid}.tmp`));

  if (process.platform === "win32") {
    const ruta = join(raiz, ".env");
    const env = readFileSync(ruta);
    chmodSync(ruta, 0o444);
    t.after(() => chmodSync(ruta, 0o644));
    const r = await correr(raiz, sim, ["renovar"]);
    assert.equal(r.codigo, 1, r.todo);
    assert.match(r.salida, /no puedo escribir maquina-de-contenido\/\.env .*: no pedí la renovación/);
    assert.equal(renovaciones(sim).length, 0, "si no se puede guardar, no se le pide un token nuevo a Meta");
    assert.ok(readFileSync(ruta).equals(env));
    assert.deepEqual(envs(raiz), [".env"]);
    chmodSync(ruta, 0o644);
  }

  // INSTAGRAM_TOKEN por variable de entorno: no se puede guardar el nuevo, no se renueva.
  const variable = await correr(raiz, sim, ["renovar"], { INSTAGRAM_TOKEN: TOKEN_IG });
  assert.equal(variable.codigo, 2);
  assert.match(variable.error, /viene de una variable de entorno/);
  assert.equal(renovaciones(sim).length, 0);

  // "renovar" con opciones se rechaza antes de leer .env (acá .env tiene algo que frenaría la lectura).
  writeFileSync(join(raiz, ".env"), envDe("instagram") + `META_API_BASE=${sim.url}\r\n`);
  const conOpcion = await correr(raiz, sim, ["renovar", "--de-verdad"]);
  assert.equal(conOpcion.codigo, 2);
  assert.match(conOpcion.error, /renovar va sin opciones/);
  assert.equal(renovaciones(sim).length, 0);
});

// ---------- el token no sale nunca ----------
test("el token de Instagram no aparece en la salida, los archivos ni las URL (tampoco el renovado ni un eco de Meta)", async (t) => {
  // Meta repite el token (entero y un pedazo) en el error: sale tapado. correr() revisa cada pedazo de 8.
  const simEco = await iniciarSimulador({ tokenInvalido: true, ecoToken: true, ecoParcial: true });
  t.after(simEco.cerrar);
  const v = await correr(proyectoIg(simEco, {}), simEco, ["verificar"]);
  assert.notEqual(v.codigo, 0);
  assert.match(v.todo, /Malformed access token IGAA…/);
  assert.match(v.error, /el token de Instagram no sirve/);

  const sim = await iniciarSimulador({ ecoToken: true });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const r = await correr(raiz, sim, publicarIg("c1", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.equal(sim.estado.tokensNuevos.length, 1, "se renovó (y correr() revisó que el nuevo tampoco salga)");
  const tokens = [TOKEN_IG, ...sim.estado.tokensNuevos];
  const pedazo = (s) => s.slice(4, 12);
  for (const p of sim.pedidos) {
    const enUrl = p.ruta + JSON.stringify(p.query);
    if (p.ruta === "/refresh_access_token") continue; // la única que la doc da solo con el token en la URL
    for (const tk of tokens) assert.ok(!enUrl.includes(pedazo(tk)), `el token apareció en la URL ${p.ruta}`);
  }
  // Las fechas no tienen el token (correr() ya revisó todos los archivos menos .env).
  assert.ok(!readFileSync(archivoFechas(raiz), "utf8").includes(pedazo(sim.estado.tokensNuevos[0])));

  // En la misma corrida que lo renueva, Meta rechaza el token nuevo y lo repite entero: sale tapado.
  const simNuevo = await iniciarSimulador({ ecoTrasRenovar: true });
  t.after(simNuevo.cerrar);
  const otra = proyectoIg(simNuevo, {});
  escribirFechas(otra, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const eco = await correr(otra, simNuevo, ["verificar"]);
  assert.notEqual(eco.codigo, 0, eco.todo);
  assert.equal(simNuevo.estado.tokensNuevos.length, 1);
  assert.match(eco.salida, /Listo: token renovado/);
  assert.match(eco.salida, /Invalid OAuth access token: IGAA…/);

  // Un texto con el token de Instagram (o algo con su forma) no se publica ni se muestra.
  const conToken = enPieza(raiz, "c1", "texto.txt", `Promo.\nINSTAGRAM_TOKEN=${TOKEN_IG}\n`);
  conTokenAProposito.add(conToken);
  const forma = enPieza(raiz, "c1", "forma.txt", `Mirá IGAA${"Zx9".repeat(14)} jaja`);
  for (const archivo of [conToken, forma]) {
    const x = await correr(raiz, sim, publicarIg("c1", `--texto=${archivo}`));
    assert.equal(x.codigo, 2, x.todo);
    assert.match(x.error, /trae el token de Meta/);
  }
  assert.ok(contieneSecreto("INSTAGRAM_TOKEN="));

  // Un INSTAGRAM_TOKEN pegado en .env.ejemplo (que va al repositorio) frena todo.
  writeFileSync(join(raiz, ".env.ejemplo"), `META_ACCESS_TOKEN=\nINSTAGRAM_TOKEN=${TOKEN_IG}\n`);
  conTokenAProposito.add(join(raiz, ".env.ejemplo"));
  const ej = await correr(raiz, sim, ["verificar"]);
  assert.equal(ej.codigo, 2);
  assert.match(ej.error, /\.env\.ejemplo tiene un INSTAGRAM_TOKEN/);
});

// ---------- verificar ----------
test("verificar en el modo Instagram: cuenta, tipo, cupo, días del token, medios.baseUrl y 'Todo en orden' solo si está todo", async (t) => {
  const sim = await iniciarSimulador({ cupoUsado: 3 });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const ahora = Date.now();
  escribirFechas(raiz, { emitido: ahora - 2 * DIA, vence: ahora + 40 * DIA + HORA });
  const r = await correr(raiz, sim, ["verificar"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /Verificando Instagram con inicio de sesión de Instagram \(simulador http:\/\/localhost:\d+, v26\.0\)/);
  assert.match(r.salida, /Token: IGAA… \(INSTAGRAM_TOKEN, no se muestra entero\)/);
  assert.match(r.salida, new RegExp(`Cuenta: @cuenta_demo · tipo BUSINESS · user_id ${IG_ID}`));
  assert.match(r.salida, /coincide con config\.json \(@cuenta_demo\): OK/);
  assert.match(r.salida, /cuenta profesional \(Empresa\): OK/);
  assert.match(r.salida, /OK    instagram_business_content_publish/);
  assert.match(r.salida, /Cupo de Instagram: 3 de 50/);
  assert.match(r.salida, /Token: le quedan 40 días \(vence el \d{4}-\d{2}-\d{2}\)/);
  assert.match(r.salida, /Medios: http:\/\/127\.0\.0\.1:\d+\/medios/);
  assert.match(r.salida, /Facebook: todavía no está conectado \(falta el portfolio\); por ahora solo Instagram/);
  assert.match(r.salida, /Todo en orden/);
  assert.match(r.salida, /entra como evaluadora de Instagram/);
  assert.ok(aMeta(sim).every((p) => p.metodo === "GET"), "verificar solo lee");
  assert.ok(!aMeta(sim).some((p) => p.ruta.includes(PAGE_ID) || p.ruta.endsWith("/permissions")));
  assert.equal(aMeta(sim).find((p) => p.ruta.endsWith("/content_publishing_limit")).ruta, `/v26.0/${IG_ID}/content_publishing_limit`, "el cupo se pide con el user_id de /me");

  // /me dentro de "data": [ … ] (como el ejemplo de la doc): lo mismo.
  const simData = await iniciarSimulador({ meConData: true });
  t.after(simData.cerrar);
  const d = await correr(proyectoIg(simData, {}), simData, ["verificar"]);
  assert.equal(d.codigo, 0, d.todo);
  assert.match(d.salida, /Cuenta: @cuenta_demo/);

  // Si /me no acepta account_type, se pide sin él y sigue (el tipo es un dato de más).
  const simTipo = await iniciarSimulador({ meSinTipo: true });
  t.after(simTipo.cerrar);
  const pt = proyectoIg(simTipo, { piezas: [{ id: "i1", laminas: 1 }] });
  const sinTipo = await correr(pt, simTipo, ["verificar"]);
  assert.equal(sinTipo.codigo, 0, sinTipo.todo);
  assert.match(sinTipo.salida, /tipo \(sin dato\)/);
  assert.deepEqual(simTipo.pedidos.filter((p) => p.ruta === "/v26.0/me").map((p) => p.query.fields), ["user_id,username,account_type", "user_id,username"]);
  assert.equal((await correr(pt, simTipo, publicarIg("i1", "--de-verdad"))).codigo, 0, "publica igual");

  // Si Meta no reconoce el user_id (la doc se contradice sobre qué número usar), lo dice claro.
  const simId = await iniciarSimulador({ userIdNoSirve: true });
  t.after(simId.cerrar);
  const malId = await correr(proyectoIg(simId, {}), simId, ["verificar"]);
  assert.equal(malId.codigo, 1, malId.todo);
  assert.match(malId.salida, new RegExp(`Meta no reconoce el user_id ${IG_ID} para publicar`));

  // Sin medios.baseUrl: la conexión está, pero no dice "Todo en orden".
  const sinBase = proyectoIg(sim, { conBase: false });
  const b = await correr(sinBase, sim, ["verificar"]);
  assert.equal(b.codigo, 1, b.todo);
  assert.match(b.salida, /config\.json → medios\.baseUrl está vacío: Instagram baja las imágenes y los videos de una URL pública/);
  assert.doesNotMatch(b.salida, /Todo en orden/);

  // Cuenta ajena, sin permiso de publicar, cuenta personal y token vencido.
  for (const [esc, falta, fechas] of [
    [{ usuario: "otra.cuenta" }, /INSTAGRAM_TOKEN es de @otra\.cuenta y config\.json espera @cuenta_demo/],
    [{ permisosFaltantesIg: ["instagram_business_content_publish"] }, /FALTA instagram_business_content_publish[\s\S]*falta el permiso instagram_business_content_publish/],
    [{ tipoCuenta: "PERSONAL" }, /la cuenta es de tipo PERSONAL/],
    [{}, /el token de Instagram venció/, { emitido: ahora - 70 * DIA, vence: ahora - 10 * DIA }],
  ]) {
    const s = await iniciarSimulador(esc);
    t.after(s.cerrar);
    const p = proyectoIg(s, {});
    if (fechas) escribirFechas(p, fechas);
    const x = await correr(p, s, ["verificar"]);
    assert.equal(x.codigo, 1, x.todo);
    assert.match(x.salida, falta);
    assert.doesNotMatch(x.salida, /Todo en orden/);
  }

  // estado: el cupo y los días del token, sin renovar nada.
  const e = await correr(raiz, sim, ["estado"]);
  assert.equal(e.codigo, 0, e.todo);
  assert.match(e.salida, /Token de Instagram: le quedan 40 días/);
  assert.match(e.salida, /Cupo de Instagram: 3 de 50/);
  assert.equal(renovaciones(sim).length, 0);
});

test("sin ningún token, el modo es Instagram y dice qué falta", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  writeFileSync(join(raiz, ".env"), envDe("instagram").replace(TOKEN_IG, ""));
  const v = await correr(raiz, sim, ["verificar"]);
  assert.notEqual(v.codigo, 0);
  assert.match(v.error, /falta INSTAGRAM_TOKEN en maquina-de-contenido\/\.env: generalo en el panel de la app/);
  const p = await correr(raiz, sim, publicarIg("i1"));
  assert.equal(p.codigo, 0, p.todo);
  assert.match(p.salida, /ahora falta INSTAGRAM_TOKEN/);
  const pv = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.notEqual(pv.codigo, 0);
  assert.match(pv.error, /falta INSTAGRAM_TOKEN/);
  assert.equal(sim.pedidos.filter((x) => !x.ruta.startsWith("/medios/")).length, 0);
});

// ---------- arreglos de la revisión (oct-2026) ----------
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Copia el código a la carpeta de un proyecto de prueba y lo corre como si esa fuera la carpeta real
// (sin META_RAIZ): así se prueban los seguros de "la carpeta real" sin tocar la de verdad.
function comoCarpetaReal(raiz, sim) {
  cpSync(join(RAIZ, "herramientas"), join(raiz, "herramientas"), { recursive: true });
  const cli = join(raiz, "herramientas", "meta.mjs");
  return (argumentos, extra = {}, op = {}) => correr(raiz, sim, argumentos, { META_RAIZ: undefined, ...extra }, { cli, cwd: raiz, ...op });
}

test("carpeta real contra el simulador (sin META_RAIZ): no renueva ni toca .env, el calendario ni los registros; sin simulador muestra graph.instagram.com", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const comoReal = comoCarpetaReal(raiz, sim);
  const ahora = Date.now();
  // Renovado hace 8 días: en cualquier otra carpeta, verificar lo renovaría (y reescribiría .env).
  escribirFechas(raiz, { emitido: ahora - 8 * DIA, vence: ahora + 52 * DIA });
  const archivos = [".env", "calendario.md", "registro.md", join("registro-meta", "token-instagram.json")];
  const antes = archivos.map((n) => readFileSync(join(raiz, n)));
  const igual = (que) => archivos.forEach((n, i) => assert.ok(readFileSync(join(raiz, n)).equals(antes[i]), `${n} quedó igual (${que})`));

  const v = await comoReal(["verificar"]);
  assert.equal(v.codigo, 0, v.todo);
  assert.equal(renovaciones(sim).length, 0, "contra el simulador con la carpeta real no se renueva");
  igual("verificar");

  const r = await comoReal(["renovar"]);
  assert.equal(r.codigo, 2, r.todo);
  assert.match(r.error, /no renuevo: contra el simulador con la carpeta real no toco \.env/);
  assert.equal(renovaciones(sim).length, 0);
  igual("renovar");

  const p = await comoReal(publicarIg("i1", "--de-verdad"));
  assert.equal(p.codigo, 0, p.todo);
  assert.match(p.salida, /Ojo: estás contra el simulador con la carpeta real: no toco calendario\.md, registro\.md ni registro-meta\//);
  assert.equal(sim.estado.medias.length, 1, "publicó en el simulador");
  assert.equal(renovaciones(sim).length, 0);
  igual("publicar --de-verdad");
  assert.ok(!existsSync(join(raiz, "registro-meta", "publicaciones.json")), "no anotó nada en registro-meta/");
  assert.deepEqual(envs(raiz), [".env"]);

  // Sin META_API_BASE (como en la compu de la persona responsable) la simulación muestra los hosts de verdad. En ese
  // proceso fetch está anulado: aunque algo fallara, no puede salir ningún pedido a ningún lado.
  const sinRed = join(raiz, "sin-red.mjs");
  writeFileSync(sinRed, 'globalThis.fetch = async () => { throw new Error("prueba sin red: este proceso no habla con nadie"); };\n');
  const s = await comoReal(publicarIg("i1"), { META_API_BASE: undefined }, { nodeArgs: ["--import", pathToFileURL(sinRed).href] });
  assert.equal(s.codigo, 0, s.todo);
  assert.match(s.salida, /Pedidos que haría a Instagram \(graph\.instagram\.com, /);
  assert.match(s.salida, /GET  https:\/\/graph\.instagram\.com\/v26\.0\/me\?fields=user_id,username,account_type/);
  assert.match(s.salida, /POST https:\/\/graph\.instagram\.com\/v26\.0\/<user_id>\/media_publish/);
  assert.doesNotMatch(s.salida, /graph\.facebook\.com|rupload/, "el token de Instagram no iría nunca a los hosts de Facebook");
  igual("simulación sin red");
});

test("tokens cruzados en .env: frena antes de hablar con Meta y dice qué línea corregir", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  for (const [env, error] of [
    [`META_ACCESS_TOKEN=${TOKEN_IG}\r\nINSTAGRAM_TOKEN=\r\nMETA_GRAPH_VERSION=v26.0\r\n`, /el token de META_ACCESS_TOKEN es de Instagram \(empieza con IG\): va en la línea INSTAGRAM_TOKEN= .*no hace falta generar otro token/],
    [`META_ACCESS_TOKEN=\r\nINSTAGRAM_TOKEN=${TOKEN_PRUEBA}\r\nMETA_GRAPH_VERSION=v26.0\r\n`, /el token de INSTAGRAM_TOKEN es de Facebook \(empieza con EAA\): ese va en la línea META_ACCESS_TOKEN=/],
  ]) {
    writeFileSync(join(raiz, ".env"), env);
    for (const argumentos of [["verificar"], publicarIg("i1", "--red=instagram"), publicarIg("i1", "--red=instagram", "--de-verdad"), ["estado"]]) {
      const r = await correr(raiz, sim, argumentos);
      assert.equal(r.codigo, 2, `${argumentos.join(" ")}: ${r.todo}`);
      assert.match(r.error, error);
    }
  }
  assert.equal(aMeta(sim).length, 0, "no llegó ni un pedido a Meta");
  assert.ok(!existsSync(join(raiz, "registro-meta")));
});

test(".env escrito a mano: comillas con comentario, saltos sueltos, un carácter invisible y Unicode (UTF-16)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  // Comillas y un comentario al final: el token es lo de adentro de las comillas.
  writeFileSync(join(raiz, ".env"), `INSTAGRAM_TOKEN="${TOKEN_IG}"  # el de proyecto\r\nMETA_GRAPH_VERSION=v26.0\r\n`);
  const c = await correr(raiz, sim, ["verificar"]);
  assert.equal(c.codigo, 0, c.todo);
  assert.ok(aMeta(sim).length && aMeta(sim).every((p) => p.auth === `Bearer ${TOKEN_IG}`), "sin las comillas");
  // Saltos de línea sueltos (\r): la línea del token no queda pegada como valor de META_ACCESS_TOKEN.
  writeFileSync(join(raiz, ".env"), `META_ACCESS_TOKEN=\rINSTAGRAM_TOKEN=${TOKEN_IG}\rMETA_GRAPH_VERSION=v26.0\r`);
  const cr = await correr(raiz, sim, ["verificar"]);
  assert.equal(cr.codigo, 0, cr.todo);
  assert.ok(aMeta(sim).every((p) => p.lado === "instagram"), "nada fue al host de Facebook");
  const n = aMeta(sim).length;
  // Un espacio invisible pegado desde la web: se frena con un mensaje claro (no "error de conexión").
  writeFileSync(join(raiz, ".env"), `INSTAGRAM_TOKEN=${TOKEN_IG.slice(0, 20)}​${TOKEN_IG.slice(20)}\r\n`);
  const inv = await correr(raiz, sim, ["verificar"]);
  assert.equal(inv.codigo, 2, inv.todo);
  assert.match(inv.error, /INSTAGRAM_TOKEN tiene un espacio o un carácter invisible/);
  // Guardado como "Unicode" (UTF-16): se dice eso, no "falta INSTAGRAM_TOKEN".
  writeFileSync(join(raiz, ".env"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`INSTAGRAM_TOKEN=${TOKEN_IG}\r\n`, "utf16le")]));
  const u16 = await correr(raiz, sim, ["verificar"]);
  assert.equal(u16.codigo, 2, u16.todo);
  assert.match(u16.error, /está guardado como "Unicode" \(UTF-16\)/);
  assert.equal(aMeta(sim).length, n, "ninguno de los dos llegó a Meta");
});

test("renovar con .env en ANSI (no UTF-8): no le pide nada a Meta y explica cómo guardarlo", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  writeFileSync(join(raiz, ".env"), Buffer.from(`# configuración de proyecto\r\n${envDe("instagram")}`, "latin1"));
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const env = readFileSync(join(raiz, ".env"));
  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 1, r.todo);
  assert.match(r.salida, /no está guardado en UTF-8 .*Codificación "UTF-8"\. No pedí la renovación/);
  assert.equal(renovaciones(sim).length, 0);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env), ".env quedó igual (las tildes no se rompieron)");
});

test("token que se vence sin poder renovarlo: verificar termina en 'Qué falta' y publicar avisa (o no publica si venció)", async (t) => {
  const FALLA = { code: 190, subcode: 463, message: "Error validating access token: the token can not be refreshed" };
  const ahora = Date.now();
  // G1b: lo vio hace 55 días y nunca se pudo renovar: vence como mucho en 4 días (60 desde que lo vio).
  const sim = await iniciarSimulador({ renovarFalla: FALLA });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  escribirFechas(raiz, { emitido: ahora - 55 * DIA, renovado: null });
  const g1b = await correr(raiz, sim, ["verificar"]);
  assert.equal(g1b.codigo, 1, g1b.todo);
  assert.equal(renovaciones(sim).length, 1, "intentó renovar");
  assert.match(g1b.salida, /Token: le quedan como mucho 4 días \(vence a más tardar el \d{4}-\d{2}-\d{2}; lo voy a saber exacto en la primera renovación\)/);
  assert.match(g1b.salida, /Qué falta:[\s\S]*- el token de Instagram vence en 4 días \(o antes\) y no lo pude renovar: generá uno nuevo en el panel de la app/);
  assert.doesNotMatch(g1b.salida, /Todo en orden/);
  // publicar --de-verdad repite el aviso antes de publicar (el token todavía sirve: publica).
  const p = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.equal(p.codigo, 0, p.todo);
  assert.match(p.salida, /Ojo: el token de Instagram vence en 4 días \(o antes\) y no lo pude renovar/);
  assert.ok(p.salida.indexOf("Ojo: el token de Instagram vence") < p.salida.indexOf("Instagram: publico"), "el aviso sale antes de publicar");

  // G2: renovado hace 58 días, vence en 1 día y la renovación falla.
  const sim2 = await iniciarSimulador({ renovarFalla: FALLA });
  t.after(sim2.cerrar);
  const raiz2 = proyectoIg(sim2, {});
  escribirFechas(raiz2, { emitido: ahora - 58 * DIA, vence: ahora + 2 * DIA - HORA });
  const g2 = await correr(raiz2, sim2, ["verificar"]);
  assert.equal(g2.codigo, 1, g2.todo);
  assert.match(g2.salida, /Qué falta:[\s\S]*- el token de Instagram vence en 1 día y no lo pude renovar/);
  assert.doesNotMatch(g2.salida, /Todo en orden|(^|\D)1 días/);
  // "le queda 1 día" (antes decía "le quedan 1 día").
  assert.match(g2.salida, /Token: le queda 1 día \(vence el /);
  assert.doesNotMatch(g2.salida, /le quedan (1 día|menos de un día)/);

  // G1: lo vio hace 61 días y nunca se renovó: venció seguro. verificar lo dice y publicar no publica.
  const sim3 = await iniciarSimulador();
  t.after(sim3.cerrar);
  const raiz3 = proyectoIg(sim3, { piezas: [{ id: "i1", laminas: 1 }] });
  escribirFechas(raiz3, { emitido: ahora - 61 * DIA, renovado: null });
  const g1 = await correr(raiz3, sim3, ["verificar"]);
  assert.equal(g1.codigo, 1, g1.todo);
  assert.match(g1.salida, /Qué falta:[\s\S]*- el token de Instagram venció a más tardar el \d{4}-\d{2}-\d{2}/);
  assert.equal(renovaciones(sim3).length, 0, "un token vencido no se puede renovar: ni se pide");
  const p3 = await correr(raiz3, sim3, publicarIg("i1", "--de-verdad"));
  assert.notEqual(p3.codigo, 0, p3.todo);
  assert.match(p3.error, /no publico: el token de Instagram venció a más tardar/);
  assert.equal(posts(sim3, "/media").length, 0);
  assert.equal(registro(raiz3).length, 0);
});

// Un PowerShell que, cuando aparece la bandera, abre el archivo con ese "share" y lo deja trabado ms milisegundos
// (como el antivirus, el indexador o un editor que lo tiene abierto).
function trabar(ruta, bandera, share, ms) {
  const ps = [
    "$ErrorActionPreference='Stop'",
    "Write-Output 'LISTO'",
    `while (-not (Test-Path -LiteralPath '${bandera}')) { Start-Sleep -Milliseconds 20 }`,
    `$f = [System.IO.File]::Open('${ruta}', 'Open', 'Read', '${share}')`,
    "Write-Output 'TRABADO'",
    `Start-Sleep -Milliseconds ${ms}`,
    "$f.Close()",
    "Write-Output 'SUELTO'",
  ].join("\n");
  const hijo = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]);
  let salida = "";
  hijo.stdout.on("data", (d) => (salida += d));
  hijo.stderr.on("data", (d) => (salida += d));
  const fin = new Promise((ok) => hijo.on("close", () => ok(salida)));
  const listo = (async () => { while (!/LISTO/.test(salida) && hijo.exitCode == null) await esperar(20); })();
  return { listo, fin };
}

// "renovar" con .env trabado justo cuando llega la respuesta de Meta (el simulador la demora 1 s).
async function renovarConEnvTrabado(t, share, ms) {
  const sim = await iniciarSimulador({ demoraMs: 1000 });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const ruta = join(raiz, ".env");
  const bandera = join(raiz, "bandera");
  const antes = readFileSync(ruta);
  const traba = trabar(ruta, bandera, share, ms);
  await traba.listo;
  const corrida = correr(raiz, sim, ["renovar"]);
  while (!renovaciones(sim).length) await esperar(20);
  writeFileSync(bandera, "");
  const r = await corrida;
  const ps = await traba.fin;
  return { sim, raiz, ruta, antes, r, ps };
}

const soloWindows = process.platform !== "win32" && "el bloqueo de archivos es de Windows";

test("renovar con .env trabado un rato por otro programa (Windows): reintenta y guarda el token nuevo", { skip: soloWindows }, async (t) => {
  const { sim, raiz, ruta, r, ps } = await renovarConEnvTrabado(t, "ReadWrite", 1500);
  assert.match(ps, /TRABADO[\s\S]*SUELTO/, ps);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /Listo: token renovado/);
  assert.ok(readFileSync(ruta, "utf8").includes(`INSTAGRAM_TOKEN=${sim.estado.tokensNuevos[0]}\r\n`), ".env quedó con el token nuevo");
  assert.deepEqual(envs(raiz), [".env"]);
});

test("renovar con .env trabado más de lo que se espera (Windows): dice que Meta lo renovó y no se pudo guardar; la próxima corrida lo logra", { skip: soloWindows }, async (t) => {
  const { sim, raiz, ruta, antes, r, ps } = await renovarConEnvTrabado(t, "None", 5500);
  assert.match(ps, /TRABADO/, ps);
  assert.equal(r.codigo, 1, r.todo);
  assert.equal(sim.estado.tokensNuevos.length, 1, "Meta dio un token nuevo");
  assert.match(r.salida, /Meta renovó el token, pero no lo pude guardar en \.env: \.env estaba abierto o trabado por otro programa/);
  assert.match(r.salida, /En \.env sigue el anterior, que según lo que se sabe sirve hasta su vencimiento: le quedan 5\d días .*La próxima corrida lo vuelve a intentar sola/);
  assert.doesNotMatch(r.todo, /No se renovó|EBUSY|EPERM/);
  assert.ok(readFileSync(ruta).equals(antes), ".env quedó igual (con el anterior)");
  assert.deepEqual(envs(raiz), [".env"], "el token nuevo no quedó en ningún otro archivo");
  // Ya sin la traba, la próxima corrida lo renueva sola.
  sim.escenario.demoraMs = 0;
  const v = await correr(raiz, sim, ["verificar"]);
  assert.equal(v.codigo, 0, v.todo);
  assert.equal(renovaciones(sim).length, 2);
  assert.ok(readFileSync(ruta, "utf8").includes(`INSTAGRAM_TOKEN=${sim.estado.tokensNuevos[1]}\r\n`));
});

test("renovación: no sigue una redirección (el token iría en la URL a otro servidor)", async (t) => {
  const recibidos = [];
  const otro = createServer((req, res) => { recibidos.push(req.url); res.end("{}"); });
  await new Promise((ok) => otro.listen(0, "127.0.0.1", ok));
  t.after(() => new Promise((ok) => { otro.closeAllConnections?.(); otro.close(() => ok()); }));
  const sim = await iniciarSimulador({ renovarRedirige: `http://localhost:${otro.address().port}/robado` });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const env = readFileSync(join(raiz, ".env"));
  const r = await correr(raiz, sim, ["renovar"]);
  assert.equal(r.codigo, 1, r.todo);
  assert.equal(renovaciones(sim).length, 1);
  assert.deepEqual(recibidos, [], "el otro servidor no recibió nada (ni el token)");
  assert.match(r.salida, /No se renovó/);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env));
  assert.deepEqual(envs(raiz), [".env"]);
});

test("renovación: si Meta contesta sin un token nuevo usable, no toca .env ni las fechas", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  const ahora = Date.now();
  escribirFechas(raiz, { emitido: ahora - 8 * DIA, vence: ahora + 52 * DIA });
  const env = readFileSync(join(raiz, ".env"));
  const fechas = readFileSync(archivoFechas(raiz));
  for (const cuerpo of [
    { token_type: "bearer", expires_in: 5183944 },
    { access_token: "IGAAcorto", token_type: "bearer", expires_in: 5183944 },
    { access_token: "IGAAcon espacios Qz8Wk5Tp0Lx3Mh7Gc2Rt6Yp1", token_type: "bearer", expires_in: 5183944 },
  ]) {
    sim.escenario.renovarCuerpo = cuerpo;
    const r = await correr(raiz, sim, ["renovar"]);
    assert.equal(r.codigo, 1, r.todo);
    assert.match(r.salida, /Meta contestó sin un token nuevo que se pueda usar: no toqué \.env/);
    assert.ok(readFileSync(join(raiz, ".env")).equals(env), ".env igual byte a byte");
    assert.ok(readFileSync(archivoFechas(raiz)).equals(fechas), "las fechas, iguales");
    assert.deepEqual(envs(raiz), [".env"]);
  }
  const v = await correr(raiz, sim, ["verificar"]);
  assert.match(v.salida, /Aviso: no pude renovar el token de Instagram/);
  assert.ok(readFileSync(join(raiz, ".env")).equals(env));
});

test("renovación: si .env cambia mientras se espera a Meta, no lo pisa (y no dice 'no se renovó')", async (t) => {
  const sim = await iniciarSimulador({ demoraMs: 1500 });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, {});
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const corrida = correr(raiz, sim, ["renovar"]);
  while (!renovaciones(sim).length) await esperar(20);
  appendFileSync(join(raiz, ".env"), "# lo agregó la persona responsable mientras corría\r\n");
  const r = await corrida;
  assert.equal(r.codigo, 1, r.todo);
  assert.match(r.salida, /\.env cambió mientras renovaba el token: no lo piso/);
  assert.doesNotMatch(r.salida, /No se renovó/, "Meta sí dio uno nuevo: no dice que no se renovó");
  const env = readFileSync(join(raiz, ".env"), "utf8");
  assert.ok(env.endsWith("# lo agregó la persona responsable mientras corría\r\n"), "queda lo que escribió");
  assert.ok(env.includes(`INSTAGRAM_TOKEN=${TOKEN_IG}\r\n`));
  assert.deepEqual(envs(raiz), [".env"]);

  // Lo mismo con la renovación automática de verificar: el aviso dice lo que pasó (no "no pude renovar").
  escribirFechas(raiz, { emitido: Date.now() - 8 * DIA, vence: Date.now() + 52 * DIA });
  const corridaV = correr(raiz, sim, ["verificar"]);
  while (renovaciones(sim).length < 2) await esperar(20);
  sim.escenario.demoraMs = 0; // lo que sigue de verificar, sin demora
  appendFileSync(join(raiz, ".env"), "# otra línea\r\n");
  const v = await corridaV;
  assert.equal(v.codigo, 0, v.todo);
  assert.match(v.salida, /Aviso: \.env cambió mientras renovaba el token: no lo piso/);
  assert.doesNotMatch(v.salida, /no pude renovar el token/);
  assert.ok(readFileSync(join(raiz, ".env"), "utf8").endsWith("# otra línea\r\n"));
  assert.deepEqual(envs(raiz), [".env"]);
});

test("META_IG_USER_ID que no es la cuenta de INSTAGRAM_TOKEN: no publica y verificar lo dice", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  writeFileSync(join(raiz, ".env"), envDe("instagram") + "META_IG_USER_ID=99999999999\r\n");
  const p = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.notEqual(p.codigo, 0, p.todo);
  assert.match(p.error, /META_IG_USER_ID \(99999999999\) no es la cuenta de INSTAGRAM_TOKEN/);
  assert.equal(posts(sim, "/media").length, 0, "no se creó ningún contenedor");
  assert.equal(registro(raiz).length, 0);
  const v = await correr(raiz, sim, ["verificar"]);
  assert.equal(v.codigo, 1, v.todo);
  assert.match(v.salida, /Qué falta:[\s\S]*META_IG_USER_ID \(99999999999\) no es la cuenta de INSTAGRAM_TOKEN/);
});

test("carrusel con --hecho-con-ia en el modo Instagram: la marca va solo en el contenedor CAROUSEL", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, publicarIg("c1", "--hecho-con-ia", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const medias = posts(sim, `/${IG_ID}/media`);
  const hijos = medias.filter((p) => p.cuerpo.is_carousel_item);
  assert.equal(hijos.length, 2);
  assert.ok(hijos.every((p) => p.cuerpo.is_ai_generated === undefined), "las láminas van sin la marca (Meta da error)");
  assert.equal(medias.find((p) => p.cuerpo.media_type === "CAROUSEL").cuerpo.is_ai_generated, true);
});

test("media_publish sin respuesta en el modo Instagram, si Meta sí devuelve el texto: lo confirma y no queda dudoso", async (t) => {
  // La referencia de IG Media dice que caption es solo del camino de Facebook; el changelog de jul-2026 da a entender
  // que se devuelve igual. El publicador sirve para los dos casos (el otro está en "media_publish sin respuesta…").
  const sim = await iniciarSimulador({ caerseEnPublicar: true, igConCaption: true });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, publicarIg("i1", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /salió bien \(lo confirmé consultando\)/);
  assert.equal(sim.estado.medias.length, 1);
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["publicado"]);
});

test("token que no sirve (190) en publicar y estado del modo Instagram: remite a la conexión de Instagram y al README local", async (t) => {
  const sim = await iniciarSimulador({ tokenInvalido: true });
  t.after(sim.cerrar);
  const raiz = proyectoIg(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  for (const argumentos of [publicarIg("i1", "--de-verdad"), ["estado"]]) {
    const r = await correr(raiz, sim, argumentos);
    assert.match(r.todo, /code 190/, `${argumentos[0]}: ${r.todo}`);
    assert.match(r.todo, /Qué hacer: revisá que el token esté entero en la línea INSTAGRAM_TOKEN= .*README\.md/, `${argumentos[0]}: ${r.todo}`);
    assert.doesNotMatch(r.todo, /generá un token nuevo \(README\.md\)/, "no el consejo general del camino de Facebook");
  }
  assert.equal(posts(sim, "/media").length, 0);
  assert.equal(registro(raiz).length, 0);
});

test("el simulador rechaza lo que Meta rechaza al crear contenedores (para que una regresión no pase inadvertida)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const crear = async (cuerpo) => {
    const r = await fetch(`${sim.urlIg}/v26.0/${IG_ID}/media`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_IG}`, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    return { http: r.status, cuerpo: await r.json() };
  };
  const img = `${sim.url}/medios/x.jpg`;
  const hijo = await crear({ image_url: img, is_carousel_item: true });
  assert.equal(hijo.http, 200);
  // La marca de IA en una lámina: "Setting this parameter on carousel children will result in an error".
  assert.equal((await crear({ image_url: img, is_carousel_item: true, is_ai_generated: true })).http, 400);
  // Carrusel de una sola lámina: 2207028 ("at least 2 photos/videos and no more than 10").
  const uno = await crear({ media_type: "CAROUSEL", children: hijo.cuerpo.id, caption: "x" });
  assert.equal(uno.http, 400);
  assert.equal(uno.cuerpo.error.error_subcode, 2207028);
  // Historias sin caption: la referencia lo da solo para imagen, video y carrusel.
  assert.equal((await crear({ media_type: "STORIES", image_url: img, caption: "x" })).http, 400);
  assert.equal((await crear({ media_type: "STORIES", image_url: img })).http, 200);
});
