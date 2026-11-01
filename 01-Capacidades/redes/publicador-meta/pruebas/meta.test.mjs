// Pruebas del publicador de Meta contra el simulador local (nada sale de esta compu).
//   node --test        (desde maquina-de-contenido/; corre también meta-fallas.test.mjs)
// Cada prueba arma una copia mínima del proyecto en una carpeta temporal (META_RAIZ): el
// calendario y los registros reales no se tocan. El armado está en armado.mjs.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { iniciarSimulador, TOKEN_PRUEBA, TOKEN_PAGINA, PAGE_ID, IG_ID } from "./simulador-meta.mjs";
import { TANDA, TEXTO, jpeg, mp4, crearProyecto, enPieza, correr, args, posts, leer, registro, horaBA, limpiarTemporales } from "./armado.mjs";

after(limpiarTemporales);

// ---------- pruebas ----------
test("simulación por defecto: no manda nada y no escribe nada", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 3 }] });
  const antes = leer(raiz, "calendario.md");
  const r = await correr(raiz, sim, args("c1", "ambas"));
  assert.equal(r.codigo, 0, r.todo);
  assert.equal(sim.pedidos.length, 0, "en simulación no puede salir ningún pedido");
  assert.match(r.salida, /MODO SIMULACIÓN/);
  assert.match(r.salida, /media_publish/);
  assert.match(r.salida, /\/feed/);
  assert.match(r.salida, /Nada se mandó/);
  assert.equal(leer(raiz, "calendario.md"), antes);
  assert.ok(!existsSync(join(raiz, "registro-meta")));
});

test("--de-verdad sin 'aprobado' en el calendario se niega antes de hablar con Meta", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 3, estado: "para-aprobar" }] });
  const r = await correr(raiz, sim, args("c1", "ambas", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /tiene que estar "aprobado"/);
  assert.equal(sim.pedidos.length, 0);
  assert.equal(registro(raiz).length, 0);
  assert.ok(!existsSync(join(raiz, "registro-meta", ".candado")), "el candado se suelta al negarse");
});

test("carrusel completo en Instagram: orden, caption, children, media_publish y registros", async (t) => {
  const sim = await iniciarSimulador({ sondeosEnCurso: 2 });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 3, clave: "TURNOS" }] });
  const r = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);

  // Antes de Meta, comprobó cada URL pública (sin token).
  const heads = sim.pedidos.filter((p) => p.ruta.startsWith("/medios/"));
  assert.equal(heads.length, 3);
  assert.ok(heads.every((p) => p.auth === ""), "a nuestro servidor de medios no se le manda el token");

  const medias = posts(sim, `/${IG_ID}/media`);
  const hijos = medias.filter((p) => p.cuerpo.is_carousel_item === true);
  assert.deepEqual(hijos.map((h) => h.cuerpo.image_url), ["01", "02", "03"].map((n) => `${sim.url}/medios/${TANDA}/c1/${n}.jpg`));
  assert.ok(hijos.every((h) => h.cuerpo.caption === undefined), "las láminas van sin caption");
  const carrusel = medias.find((p) => p.cuerpo.media_type === "CAROUSEL");
  assert.equal(carrusel.cuerpo.caption, TEXTO);
  const idsHijos = [...sim.estado.contenedores.values()].filter((c) => c.tipo === "HIJO").map((c) => c.id);
  assert.equal(carrusel.cuerpo.children, idsHijos.join(","));
  // Cada lámina se esperó (status_code) antes de armar el CAROUSEL.
  const iCarrusel = sim.pedidos.indexOf(carrusel);
  for (const h of idsHijos) {
    const consultas = sim.pedidos.map((p, i) => [p, i]).filter(([p]) => p.metodo === "GET" && p.ruta === `/v26.0/${h}` && String(p.query.fields).includes("status_code"));
    assert.ok(consultas.length >= 3 && consultas.every(([, i]) => i < iCarrusel), `la lámina ${h} no se esperó hasta FINISHED antes del carrusel`);
  }
  const idCarrusel = [...sim.estado.contenedores.values()].find((c) => c.tipo === "CAROUSEL").id;
  const publicar = posts(sim, `/${IG_ID}/media_publish`);
  assert.equal(publicar.length, 1);
  assert.equal(publicar[0].cuerpo.creation_id, idCarrusel);
  assert.ok(sim.pedidosAMeta().every((p) => p.auth === `Bearer ${TOKEN_PRUEBA}` || p.auth === `Bearer ${TOKEN_PAGINA}`), "el token va en la cabecera");
  assert.ok(sim.pedidosAMeta().every((p) => !JSON.stringify(p.query).includes(TOKEN_PRUEBA.slice(4, 12))), "el token nunca va en la URL");

  const permalink = sim.estado.medias[0].permalink;
  const reg = registro(raiz);
  assert.equal(reg.length, 1);
  assert.equal(reg[0].estado, "publicado");
  assert.equal(reg[0].red, "instagram");
  assert.equal(reg[0].formato, "carrusel");
  assert.equal(reg[0].permalink, permalink);
  assert.match(leer(raiz, "registro.md"), new RegExp(`\\| C1 · Prueba \\| Instagram \\(carrusel\\) \\| ${permalink.replace(/[.?]/g, "\\$&")} \\|.*\\| TURNOS \\|`));
  assert.match(leer(raiz, "calendario.md"), new RegExp(`\\| publicado \\(\\[IG\\]\\(${permalink.replace(/[.?]/g, "\\$&")}\\)\\) \\|`));
});

test("imagen sola en Instagram: un contenedor con image_url y caption", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const medias = posts(sim, `/${IG_ID}/media`);
  assert.equal(medias.length, 1);
  assert.deepEqual(medias[0].cuerpo, { image_url: `${sim.url}/medios/${TANDA}/i1/01.jpg`, caption: TEXTO });
  assert.equal(posts(sim, "/media_publish").length, 1);
  assert.equal(registro(raiz)[0].formato, "imagen");
});

test("historia en Instagram (STORIES) y Facebook (foto sin publicar + photo_stories)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { historias: [{ id: "historia-hola" }] });
  const imagen = join(raiz, "publicar", TANDA, "historia-hola", "historia.jpg");
  mkdirSync(dirname(imagen), { recursive: true });
  writeFileSync(imagen, jpeg(1080, 1920));

  // Una imagen 4:5 como historia: la doc de Instagram recomienda 9:16 (no lo exige), así que avisa y no frena.
  const otra = join(raiz, "publicar", TANDA, "historia-hola", "cuatro-quintos.jpg");
  writeFileSync(otra, jpeg(1080, 1350));
  const r0 = await correr(raiz, sim, args("historia-hola", "ambas", "--formato=historia", `--imagen=${otra}`));
  assert.equal(r0.codigo, 0, r0.todo);
  assert.match(r0.salida, /Meta recomienda 9:16 para historias/);
  assert.equal(sim.pedidos.length, 0);

  // --hecho-con-ia: ni la historia de Instagram ni las fotos de Facebook lo admiten; se avisa y no se manda.
  const r = await correr(raiz, sim, args("historia-hola", "ambas", "--formato=historia", `--imagen=${imagen}`, "--hecho-con-ia", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /no se aplica a la historia de Instagram/);
  assert.match(r.salida, /Facebook no tiene marca de IA para fotos/);
  const medias = posts(sim, `/${IG_ID}/media`);
  assert.equal(medias.length, 1);
  assert.deepEqual(medias[0].cuerpo, { media_type: "STORIES", image_url: `${sim.url}/medios/${TANDA}/historia-hola/historia.jpg` });
  assert.equal(posts(sim, "/media_publish").length, 1);
  const fotos = posts(sim, `/${PAGE_ID}/photos`);
  assert.equal(fotos.length, 1);
  assert.equal(fotos[0].cuerpo.published, "false");
  assert.equal(fotos[0].archivo.nombre, "historia.jpg");
  assert.equal(fotos[0].auth, `Bearer ${TOKEN_PAGINA}`, "Facebook usa el token de la página");
  const historia = posts(sim, `/${PAGE_ID}/photo_stories`);
  assert.equal(historia.length, 1);
  assert.equal(historia[0].cuerpo.photo_id, [...sim.estado.fotos.keys()][0]);
  assert.match(leer(raiz, "calendario.md"), /\| publicado \(\[IG historia\]\(https:\/\/www\.instagram\.com\/stories\/[^)]+\) · \[FB historia\]\([^)]+\)\) \|/);
});

test("reel con carga reanudable en Instagram y video_reels en Facebook", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
  // Con --de-verdad todo sale de la carpeta de la pieza (publicar/<tanda>/<id>/).
  const video = enPieza(raiz, "r1", "reel.mp4", mp4(20));
  const texto = enPieza(raiz, "r1", "texto.txt", "Un reel de prueba. #pymes\n");
  const bytes = statSync(video).size;

  // Más de 90 s: Facebook no lo acepta como reel; se frena antes de mandar nada.
  const largo = enPieza(raiz, "r1", "largo.mp4", mp4(100));
  const r0 = await correr(raiz, sim, args("r1", "ambas", `--video=${largo}`, `--texto=${texto}`, "--de-verdad"));
  assert.notEqual(r0.codigo, 0);
  assert.match(r0.error, /entre 3 y 90 s/);
  assert.equal(sim.pedidos.length, 0);

  const r = await correr(raiz, sim, args("r1", "ambas", `--video=${video}`, `--texto=${texto}`, "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const cont = posts(sim, `/${IG_ID}/media`)[0];
  assert.deepEqual(cont.cuerpo, { media_type: "REELS", upload_type: "resumable", caption: "Un reel de prueba. #pymes", share_to_feed: true });
  const idCont = [...sim.estado.contenedores.keys()][0];
  const subidaIg = sim.pedidos.find((p) => p.ruta === `/ig-api-upload/v26.0/${idCont}`);
  assert.ok(subidaIg, "subió a rupload (ig-api-upload)");
  assert.equal(subidaIg.auth, `OAuth ${TOKEN_PRUEBA}`);
  assert.equal(subidaIg.cabeceras.offset, "0");
  assert.equal(subidaIg.cabeceras.file_size, String(bytes));
  assert.equal(subidaIg.bytes, bytes);
  assert.equal(posts(sim, "/media_publish")[0].cuerpo.creation_id, idCont);

  const reels = posts(sim, `/${PAGE_ID}/video_reels`);
  assert.deepEqual(reels.map((p) => p.cuerpo.upload_phase), ["start", "finish"]);
  const idVideo = [...sim.estado.videos.keys()][0];
  const subidaFb = sim.pedidos.find((p) => p.ruta === `/video-upload/v26.0/${idVideo}`);
  assert.equal(subidaFb.auth, `OAuth ${TOKEN_PAGINA}`);
  assert.equal(subidaFb.bytes, bytes);
  assert.equal(reels[1].cuerpo.video_state, "PUBLISHED");
  assert.equal(reels[1].cuerpo.description, "Un reel de prueba. #pymes");
  assert.deepEqual(registro(raiz).map((p) => `${p.red}/${p.formato}/${p.estado}`).sort(), ["facebook/reel/publicado", "instagram/reel/publicado"]);
});

test("Facebook: varias fotos sin publicar + /feed con attached_media, programado; y fuera de rango", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 3 }] });

  for (const ms of [5 * 60_000, 40 * 86_400_000]) {
    const r0 = await correr(raiz, sim, args("c1", "facebook", `--programar=${horaBA(Date.now() + ms)}`, "--de-verdad"));
    assert.equal(r0.codigo, 2, r0.todo);
    assert.match(r0.error, /entre 10 minutos y 30 días/);
  }
  const r1 = await correr(raiz, sim, args("c1", "ambas", `--programar=${horaBA(Date.now() + 2 * 86_400_000)}`, "--de-verdad"));
  assert.equal(r1.codigo, 2);
  assert.match(r1.error, /solo para Facebook/);
  assert.equal(sim.pedidos.length, 0);

  const objetivo = Math.floor((Date.now() + 2 * 86_400_000) / 60_000) * 60_000;
  const cuando = horaBA(objetivo);
  const r = await correr(raiz, sim, args("c1", "facebook", `--programar=${cuando}`, "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const fotos = posts(sim, `/${PAGE_ID}/photos`);
  assert.deepEqual(fotos.map((f) => f.archivo.nombre), ["01.jpg", "02.jpg", "03.jpg"]);
  assert.ok(fotos.every((f) => f.cuerpo.published === "false" && f.cuerpo.temporary === "true"));
  const feed = posts(sim, `/${PAGE_ID}/feed`);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].cuerpo.message, TEXTO);
  assert.deepEqual(feed[0].cuerpo.attached_media, [...sim.estado.fotos.keys()].map((id) => ({ media_fbid: id })));
  assert.equal(feed[0].cuerpo.published, false);
  assert.equal(feed[0].cuerpo.scheduled_publish_time, objetivo / 1000);
  // La referencia de Page photos pide los tres: published, scheduled_publish_time y unpublished_content_type.
  assert.equal(feed[0].cuerpo.unpublished_content_type, "SCHEDULED");
  assert.equal(registro(raiz)[0].estado, "programado");
  assert.match(leer(raiz, "calendario.md"), new RegExp(`\\| programado \\(\\[FB programado ${cuando}\\]\\(https://www\\.facebook\\.com/[^)]+\\)\\) \\|`));
});

test("no publica dos veces lo mismo (salvo --repetir)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  assert.equal((await correr(raiz, sim, args("c1", "instagram", "--de-verdad"))).codigo, 0);
  const segunda = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.notEqual(segunda.codigo, 0);
  assert.match(segunda.error, /no publico dos veces lo mismo/);
  assert.equal(posts(sim, "/media_publish").length, 1);
  // La otra red sí se puede publicar después: la pieza ya está "publicado" por este publicador.
  const fb = await correr(raiz, sim, args("c1", "facebook", "--de-verdad"));
  assert.equal(fb.codigo, 0, fb.todo);
  assert.match(leer(raiz, "calendario.md"), /\| publicado \(\[IG\]\([^)]+\) · \[FB\]\([^)]+\)\) \|/);
  const repetida = await correr(raiz, sim, args("c1", "instagram", "--de-verdad", "--repetir"));
  assert.equal(repetida.codigo, 0, repetida.todo);
  assert.equal(posts(sim, "/media_publish").length, 2);
  // Con --red=ambas y una ya publicada, se niega entera.
  const ambas = await correr(raiz, sim, args("c1", "ambas", "--de-verdad"));
  assert.notEqual(ambas.codigo, 0);
  assert.match(ambas.error, /elegí solo la red que falta/);
});

test("errores traducidos: token inválido (190), permiso faltante (10) y límite (9 / 2207042)", async (t) => {
  const sim190 = await iniciarSimulador({ tokenInvalido: true, ecoToken: true });
  t.after(sim190.cerrar);
  const raiz190 = crearProyecto(sim190, {});
  const v = await correr(raiz190, sim190, ["verificar"]);
  assert.notEqual(v.codigo, 0);
  assert.match(v.todo, /code 190 · subcode 463/);
  assert.match(v.todo, /el token de Meta no sirve: el token venció/);
  assert.match(v.todo, /Qué hacer: generá un token nuevo/);
  assert.match(v.todo, /EAAp…/, "el eco del token sale enmascarado");

  const sim10 = await iniciarSimulador({ permisosFaltantes: ["instagram_content_publish"] });
  t.after(sim10.cerrar);
  const raiz10 = crearProyecto(sim10, { piezas: [{ id: "i1", laminas: 1 }] });
  const v10 = await correr(raiz10, sim10, ["verificar"]);
  assert.match(v10.salida, /FALTA instagram_content_publish/);
  const p10 = await correr(raiz10, sim10, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(p10.codigo, 0);
  assert.match(p10.error, /code 10/);
  assert.match(p10.error, /falta un permiso/);
  assert.equal(posts(sim10, "/media_publish").length, 0);
  assert.equal(registro(raiz10).length, 0);

  const simCupo = await iniciarSimulador({ cupoUsado: 50 });
  t.after(simCupo.cerrar);
  const raizCupo = crearProyecto(simCupo, { piezas: [{ id: "i1", laminas: 1 }] });
  const pc = await correr(raizCupo, simCupo, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(pc.codigo, 0);
  assert.match(pc.error, /llegó al máximo de publicaciones por API \(50 de 50/);
  assert.equal(posts(simCupo, `/${IG_ID}/media`).length, 0, "con el cupo lleno no crea ni un contenedor");

  const sim9 = await iniciarSimulador({ limiteEnPublicar: true });
  t.after(sim9.cerrar);
  const raiz9 = crearProyecto(sim9, { piezas: [{ id: "i1", laminas: 1 }] });
  const p9 = await correr(raiz9, sim9, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(p9.codigo, 0);
  assert.match(p9.error, /code 9 · subcode 2207042/);
  assert.match(p9.error, /máximo de publicaciones por API/);
  assert.equal(posts(sim9, "/media_publish").length, 1, "un rechazo por límite no se reintenta en loop");
  assert.equal(registro(raiz9).length, 0, "Meta lo rechazó: no queda nada en el registro");
});

test("contenedor en ERROR: no publica", async (t) => {
  const sim = await iniciarSimulador({ contenedorError: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /quedó en ERROR/);
  assert.match(r.error, /2207052/);
  assert.match(r.error, /No se publicó nada/);
  assert.equal(posts(sim, "/media_publish").length, 0);
  assert.equal(registro(raiz).length, 0);
});

test("media_publish sin respuesta: consulta a Meta antes de reintentar y no duplica", async (t) => {
  const sim = await iniciarSimulador({ caerseEnPublicar: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /consulto si salió/);
  assert.equal(posts(sim, "/media_publish").length, 1, "no lo pidió dos veces");
  assert.equal(sim.estado.medias.length, 1);
  const reg = registro(raiz);
  assert.equal(reg[0].estado, "publicado");
  assert.equal(reg[0].permalink, sim.estado.medias[0].permalink);
});

test("--medios=facebook: la foto va sin publicar a la página y Instagram usa la URL de Meta", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }], conBase: false });
  const sinNada = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(sinNada.codigo, 0);
  assert.match(sinNada.error, /no hay ninguna: completá config\.json → medios\.baseUrl/);
  assert.equal(sim.pedidos.length, 0);

  const r = await correr(raiz, sim, args("i1", "instagram", "--medios=facebook", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const foto = posts(sim, `/${PAGE_ID}/photos`)[0];
  assert.equal(foto.cuerpo.published, "false");
  const idFoto = [...sim.estado.fotos.keys()][0];
  assert.equal(posts(sim, `/${IG_ID}/media`)[0].cuerpo.image_url, `${sim.url}/cdn/${idFoto}.jpg`);
});

test("verificar: quién es, página, Instagram, permisos y cupo, sin mostrar el token", async (t) => {
  const sim = await iniciarSimulador({ cupoUsado: 3 });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, {});
  const r = await correr(raiz, sim, ["verificar"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /Token: EAAp…/);
  assert.match(r.salida, /es de: publicador-proyecto/);
  assert.match(r.salida, /vence: miralo en el Depurador de tokens/);
  assert.match(r.salida, /Página: proyecto · Soluciones con IA/);
  assert.match(r.salida, /coincide con config\.json \(página 1111111111\)/);
  assert.match(r.salida, /Instagram: @cuenta_demo/);
  assert.match(r.salida, /OK    pages_manage_posts/);
  assert.match(r.salida, /OK    business_management/);
  assert.match(r.salida, /OK    ads_read \(o ads_management\)/);
  // Sin debug_token: el token no viaja en ninguna URL.
  assert.ok(!sim.pedidos.some((p) => p.ruta.endsWith("debug_token")), "verificar no usa debug_token");
  assert.match(r.salida, /Cupo de Instagram: 3 de 50/);
  assert.match(r.salida, /Todo en orden/);
  assert.equal(sim.pedidos.filter((p) => p.metodo !== "GET").length, 0, "verificar solo lee");

  // Si el Instagram vinculado no es el de config.json, avisa (nada de cuentas de terceros).
  const ajena = crearProyecto(sim, { usuario: "otra.cuenta" });
  const r2 = await correr(ajena, sim, ["verificar"]);
  assert.notEqual(r2.codigo, 0);
  assert.match(r2.salida, /config\.json espera @otra\.cuenta/);

  // Usuario del sistema sin ads_read ni ads_management: la doc de Instagram lo pide con rol del portfolio.
  const simAds = await iniciarSimulador({ permisosFaltantes: ["ads_read"] });
  t.after(simAds.cerrar);
  const r3 = await correr(crearProyecto(simAds, {}), simAds, ["verificar"]);
  assert.notEqual(r3.codigo, 0);
  assert.match(r3.salida, /FALTA ads_read \(o ads_management\)/);
  assert.doesNotMatch(r3.salida, /Todo en orden/);

  // Sin config.json → meta.paginaFacebook: lo pide y sugiere el número que ve.
  const sinPagina = crearProyecto(sim, { pagina: "" });
  const r4 = await correr(sinPagina, sim, ["verificar"]);
  assert.notEqual(r4.codigo, 0);
  assert.match(r4.salida, /falta config\.json → meta\.paginaFacebook.*"paginaFacebook": "1111111111"/);
});

test("cuenta ajena: si el Instagram no es el de proyecto, no publica", async (t) => {
  const sim = await iniciarSimulador({ usuario: "otra.cuenta" });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /solo para las cuentas de proyecto/);
  assert.equal(posts(sim, "/media").length, 0);
});

test("estado: lista lo publicado y el cupo del día", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  assert.equal((await correr(raiz, sim, args("i1", "instagram", "--de-verdad"))).codigo, 0);
  const r = await correr(raiz, sim, ["estado"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, new RegExp(`${TANDA}/i1  instagram imagen  publicado  https://www\\.instagram\\.com/p/`));
  assert.match(r.salida, /Cupo de Instagram: 1 de 50/);
});

test("seguros de uso: META_API_BASE solo local, opciones mal escritas, falta preparar la pieza", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }, { id: "sin-preparar" }] });
  const afuera = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"), { META_API_BASE: "https://graph.example.com" });
  assert.equal(afuera.codigo, 2);
  assert.match(afuera.error, /solo acepta http:\/\/localhost/);
  const typo = await correr(raiz, sim, args("c1", "instagram", "--de-verdat"));
  assert.equal(typo.codigo, 2);
  assert.match(typo.error, /no conozco la opción --de-verdat/);
  const sinPreparar = await correr(raiz, sim, args("sin-preparar", "instagram"));
  assert.notEqual(sinPreparar.codigo, 0);
  assert.match(sinPreparar.error, /prepará los archivos y publicacion\.json en publicar\/2099-01-prueba\/sin-preparar\/ según README\.md/);
  assert.equal(sim.pedidos.length, 0);
});
