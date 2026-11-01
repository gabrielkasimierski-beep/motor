// Los casos de falla que encontraron los revisores (oct-2026), contra el simulador local.
//   node --test        (desde maquina-de-contenido/)
// Cada uno falla con el publicador de antes de la corrección y pasa con el de ahora.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { iniciarSimulador, TOKEN_PRUEBA, PAGE_ID, IG_ID } from "./simulador-meta.mjs";
import { TANDA, TEXTO, jpeg, mp4, crearProyecto, enPieza, correr, args, posts, leer, registro, horaBA, limpiarTemporales, conTokenAProposito } from "./armado.mjs";

after(limpiarTemporales);

// ---------- duplicados: nada que pudo haber salido se borra del registro ----------
test("media_publish cortado que Meta procesa tarde: el reintento no duplica ni borra el registro", async (t) => {
  // Meta devuelve el caption sin "@" (usuario del sistema "empleado"): la búsqueda tiene que encontrarlo igual.
  const sim = await iniciarSimulador({ publicarTarde: true, captionSinArroba: true });
  t.after(sim.cerrar);
  const texto = "Hola. Seguinos en @cuenta_demo\n\n#pymes";
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2, texto }] });
  const r = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.doesNotMatch(r.todo, /Meta confirma que no salió/);
  assert.match(r.salida, /lo confirmé consultando/);
  assert.equal(sim.estado.medias.length, 1, "un solo posteo en Instagram");
  assert.equal(registro(raiz)[0].estado, "publicado");
  // Y si alguien repite, el registro lo frena.
  const otra = await correr(raiz, sim, args("c1", "instagram", "--de-verdad"));
  assert.notEqual(otra.codigo, 0);
  assert.match(otra.error, /no publico dos veces lo mismo/);
  assert.equal(sim.estado.medias.length, 1);
});

test("reel de Facebook: si falla la consulta de estado después del finish, queda dudoso (no se borra)", async (t) => {
  const sim = await iniciarSimulador({ estadoReelFalla: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
  const video = enPieza(raiz, "r1", "reel.mp4", mp4(20));
  const r = await correr(raiz, sim, args("r1", "facebook", `--video=${video}`, "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.salida, /Quedó anotado como "dudoso"/);
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso"]);
  const otra = await correr(raiz, sim, args("r1", "facebook", `--video=${video}`, "--de-verdad"));
  assert.notEqual(otra.codigo, 0);
  assert.match(otra.error, /no publico dos veces lo mismo.*mirá la cuenta antes de repetir/s);
  assert.equal([...sim.estado.videos.values()].filter((v) => v.publicado).length, 1, "un solo reel");
});

for (const [estadoVideo, que] of [["upload_failed", /falló al procesarlo \(upload_failed\)/], ["processing", /sigue en "processing" a los 5 minutos/]]) {
  test(`reel de Facebook en "${estadoVideo}": no se anota como publicado ni mueve el calendario`, async (t) => {
    const sim = await iniciarSimulador({ videoStatusTrasFinish: estadoVideo });
    t.after(sim.cerrar);
    const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
    const video = enPieza(raiz, "r1", "reel.mp4", mp4(20));
    const r = await correr(raiz, sim, args("r1", "facebook", `--video=${video}`, "--de-verdad"));
    assert.notEqual(r.codigo, 0, r.todo);
    assert.match(r.todo, que);
    assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso"]);
    assert.match(leer(raiz, "calendario.md"), /\| `guiones\/r1\.md` \(grabar\) \| aprobado \|/);
    assert.doesNotMatch(leer(raiz, "registro.md"), /Facebook \(reel\)/);
  });
}

test("dos corridas a la vez de la misma pieza: el candado deja publicar una sola", async (t) => {
  const sim = await iniciarSimulador({ demoraMs: 40, sondeosEnCurso: 2 });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 3 }] });
  const [a, b] = await Promise.all([correr(raiz, sim, args("c1", "instagram", "--de-verdad")), correr(raiz, sim, args("c1", "instagram", "--de-verdad"))]);
  assert.equal(posts(sim, "/media_publish").length, 1, `${a.todo}\n----\n${b.todo}`);
  assert.deepEqual([a.codigo, b.codigo].sort(), [0, 1]);
  assert.match(a.error + b.error, /hay otra publicación corriendo|no publico dos veces lo mismo/);
  assert.ok(!existsSync(join(raiz, "registro-meta", ".candado")), "el candado se suelta al terminar");
});

test("candado: uno vivo frena; uno colgado (proceso que ya no existe) se saca solo", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  const candado = join(raiz, "registro-meta", ".candado");
  writeFileSync(candado, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }));
  const vivo = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(vivo.codigo, 0);
  assert.match(vivo.error, /hay otra publicación corriendo/);
  assert.equal(sim.pedidos.length, 0);
  writeFileSync(candado, JSON.stringify({ pid: 2_000_000_000, desde: "2026-10-01T00:00:00Z" }));
  const colgado = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.equal(colgado.codigo, 0, colgado.todo);
  assert.ok(!existsSync(candado));
});

// ---------- el token no sale nunca ----------
test("token: --texto=.env, un texto con el token y un eco recortado de Meta", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const env = await correr(raiz, sim, args("c1", "facebook", `--texto=${join(raiz, ".env")}`));
  assert.equal(env.codigo, 2);
  assert.match(env.error, /es un archivo \.env/);

  const conToken = enPieza(raiz, "c1", "texto.txt", `Promo del mes.\nMETA_ACCESS_TOKEN=${TOKEN_PRUEBA}\n`);
  conTokenAProposito.add(conToken);
  for (const extra of [[], ["--de-verdad"]]) {
    const r = await correr(raiz, sim, args("c1", "facebook", `--texto=${conToken}`, ...extra));
    assert.equal(r.codigo, 2, r.todo);
    assert.match(r.error, /trae el token de Meta/);
  }
  // Un pedazo (sin la palabra META_ACCESS_TOKEN) también se reconoce.
  const pedazo = enPieza(raiz, "c1", "pedazo.txt", `Código: ${TOKEN_PRUEBA.slice(5, 30)}`);
  conTokenAProposito.add(pedazo);
  const p = await correr(raiz, sim, args("c1", "facebook", `--texto=${pedazo}`));
  assert.equal(p.codigo, 2, p.todo);
  assert.equal(sim.pedidos.length, 0);

  // Meta repite 30 caracteres del token en el error: sale tapado (correr() revisa que no haya ni 8 seguidos).
  const simEco = await iniciarSimulador({ tokenInvalido: true, ecoParcial: true });
  t.after(simEco.cerrar);
  const v = await correr(crearProyecto(simEco, {}), simEco, ["verificar"]);
  assert.notEqual(v.codigo, 0);
  assert.match(v.todo, /Malformed access token EAAp…/);
});

test("META_API_BASE en .env, META_RAIZ sin simulador y un .env.txt al lado", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  writeFileSync(join(raiz, ".env"), `META_ACCESS_TOKEN=${TOKEN_PRUEBA}\nMETA_PAGE_ID=${PAGE_ID}\nMETA_API_BASE=${sim.url}\n`);
  const enEnv = await correr(raiz, sim, args("i1", "instagram"));
  assert.equal(enEnv.codigo, 2);
  assert.match(enEnv.error, /META_API_BASE no va en \.env/);

  writeFileSync(join(raiz, ".env"), `META_ACCESS_TOKEN=${TOKEN_PRUEBA}\nMETA_PAGE_ID=${PAGE_ID}\n`);
  const sinSim = await correr(raiz, sim, args("i1", "instagram"), { META_API_BASE: undefined });
  assert.equal(sinSim.codigo, 2);
  assert.match(sinSim.error, /META_RAIZ es solo para las pruebas/);

  writeFileSync(join(raiz, ".env.txt"), "META_ACCESS_TOKEN=\n");
  const txt = await correr(raiz, sim, ["verificar"]);
  assert.match(txt.salida, /hay un archivo "\.env\.txt"/);
  assert.equal(sim.pedidos.filter((p) => p.metodo !== "GET").length, 0);
});

// ---------- la aprobación está atada a la pieza ----------
test("calendario: el id tiene que coincidir exacto y el estado decir exactamente 'aprobado'", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { historias: [{ id: "historia-hola" }] });
  // --id=aprobado ya no encuentra la historia por la palabra de la celda Estado.
  mkdirSync(join(raiz, "publicar", "tanda-inventada", "aprobado"), { recursive: true });
  const cualquiera = join(raiz, "publicar", "tanda-inventada", "aprobado", "x.jpg");
  writeFileSync(cualquiera, jpeg(1080, 1920));
  const r = await correr(raiz, sim, ["publicar", "--tanda=tanda-inventada", "--id=aprobado", "--red=instagram", "--formato=historia", `--imagen=${cualquiera}`, "--de-verdad"]);
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /no encuentro la pieza en calendario\.md/);
  assert.equal(sim.pedidos.length, 0);

  for (const estado of ["aprobado?", "Aprobado", "**aprobado**", "aprobado (falta la persona responsable)"]) {
    const otra = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2, estado }] });
    const x = await correr(otra, sim, args("c1", "facebook", "--de-verdad"));
    assert.notEqual(x.codigo, 0, `${estado}: ${x.todo}`);
    assert.match(x.error, /tiene que decir exactamente "aprobado"/);
  }
  assert.equal(sim.pedidos.length, 0);
});

test("con --de-verdad se publica lo de la carpeta de la pieza, y otro formato u otro texto piden aprobación nueva", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  // Un reel cualquiera, de fuera de la carpeta, con el id de un carrusel aprobado: no.
  const ajeno = join(raiz, "cualquiera.mp4");
  writeFileSync(ajeno, mp4(20));
  const r0 = await correr(raiz, sim, args("c1", "facebook", `--video=${ajeno}`, "--de-verdad"));
  assert.equal(r0.codigo, 2);
  assert.match(r0.error, /tiene que estar en publicar\/2099-01-prueba\/c1\//);
  // En simulación sí se puede mirar.
  assert.equal((await correr(raiz, sim, args("c1", "facebook", `--video=${ajeno}`))).codigo, 0);

  assert.equal((await correr(raiz, sim, args("c1", "instagram", "--de-verdad"))).codigo, 0);
  // Ya publicada en Instagram: una historia con el mismo id no pasa.
  const hist = enPieza(raiz, "c1", "historia.jpg", jpeg(1080, 1920));
  const h = await correr(raiz, sim, args("c1", "facebook", "--formato=historia", `--imagen=${hist}`, "--de-verdad"));
  assert.notEqual(h.codigo, 0);
  assert.match(h.error, /otro formato u otro contenido/);
  // Ni el mismo carrusel con otro texto.
  const otroTexto = enPieza(raiz, "c1", "otro.txt", "TEXTO QUE NADIE APROBÓ. #oferta");
  const tx = await correr(raiz, sim, args("c1", "facebook", `--texto=${otroTexto}`, "--de-verdad"));
  assert.notEqual(tx.codigo, 0);
  assert.match(tx.error, /otro formato u otro contenido/);
  assert.equal(posts(sim, `/${PAGE_ID}/photos`).length + posts(sim, `/${PAGE_ID}/feed`).length, 0);
  // El mismo carrusel, igual, en la red que falta: sí.
  assert.equal((await correr(raiz, sim, args("c1", "facebook", "--de-verdad"))).codigo, 0);
});

test("nada de páginas de terceros: META_PAGE_ID tiene que ser config.json → meta.paginaFacebook", async (t) => {
  const sim = await iniciarSimulador({ paginaNombre: "Ginotto (cliente)" });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }], pagina: "2222222222" });
  const r = await correr(raiz, sim, args("c1", "facebook", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /no es la página de proyecto de config\.json \(2222222222\)/);
  assert.equal(sim.pedidosAMeta().length, 0, "ni siquiera consulta la página");
  const sinConfig = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }], pagina: "" });
  const r2 = await correr(sinConfig, sim, args("c1", "facebook", "--de-verdad"));
  assert.notEqual(r2.codigo, 0);
  assert.match(r2.error, /falta config\.json → meta\.paginaFacebook/);
  assert.equal(sim.pedidosAMeta().length, 0);
});

// ---------- Facebook ----------
test("Facebook: una foto programada lleva unpublished_content_type; carrusel cortado avisa las fotos sueltas", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const cuando = horaBA(Math.floor((Date.now() + 86_400_000) / 60_000) * 60_000);
  const r = await correr(raiz, sim, args("i1", "facebook", `--programar=${cuando}`, "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  const foto = posts(sim, `/${PAGE_ID}/photos`)[0];
  assert.equal(foto.cuerpo.published, "false");
  assert.equal(foto.cuerpo.unpublished_content_type, "SCHEDULED");

  const simCorte = await iniciarSimulador({ fallarFotoN: 3 });
  t.after(simCorte.cerrar);
  const raiz2 = crearProyecto(simCorte, { piezas: [{ id: "c1", laminas: 4 }] });
  const c = await correr(raiz2, simCorte, args("c1", "facebook", "--de-verdad"));
  assert.notEqual(c.codigo, 0);
  assert.match(c.salida, /quedaron 2 foto\(s\) subidas SIN publicar en la página \(ids \d+, \d+\)/);
  assert.equal(registro(raiz2).length, 0, "no llegó a publicar: no queda nada en el registro");
});

test("historia en video: is_ai_generated va en el finish de video_stories y no en STORIES de Instagram", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { historias: [{ id: "h-video" }] });
  const video = enPieza(raiz, "h-video", "historia.mp4", mp4(15, 40_000, { ancho: 1080, alto: 1920 }));
  const r = await correr(raiz, sim, args("h-video", "ambas", "--formato=historia", `--video=${video}`, "--hecho-con-ia", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.deepEqual(posts(sim, `/${IG_ID}/media`)[0].cuerpo, { media_type: "STORIES", upload_type: "resumable" });
  const fin = posts(sim, `/${PAGE_ID}/video_stories`).find((p) => p.cuerpo.upload_phase === "finish");
  assert.equal(fin.cuerpo.is_ai_generated, true);
});

test("reels de Facebook: tope de 30 cada 24 h contado en el registro, y medidas del video", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
  // Por debajo de 540×960 Facebook lo rechaza al procesarlo ("Resolution too low… 540p"): se frena antes.
  const cuadrado = enPieza(raiz, "r1", "reel.mp4", mp4(20, 40_000, { ancho: 480, alto: 480 }));
  const s = await correr(raiz, sim, args("r1", "facebook", `--video=${cuadrado}`));
  assert.notEqual(s.codigo, 0, s.todo);
  assert.match(s.error, /480×480: Facebook pide como mínimo 540×960/);
  // En Instagram no hay ese mínimo: solo el aviso de 9:16.
  const ig = await correr(raiz, sim, args("r1", "instagram", `--video=${cuadrado}`));
  assert.equal(ig.codigo, 0, ig.todo);
  assert.match(ig.salida, /480×480: Meta pide 9:16/);
  const vertical = enPieza(raiz, "r1", "vertical.mp4", mp4(20, 40_000, { ancho: 1080, alto: 1920 }));

  const ahora = new Date().toISOString();
  const previas = Array.from({ length: 30 }, (_, i) => ({ ref: `x${i}`, clave: `t/r${i}/facebook/reel`, tanda: "t", id: `r${i}`, red: "facebook", formato: "reel", estado: "publicado", fecha: ahora }));
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  writeFileSync(join(raiz, "registro-meta", "publicaciones.json"), JSON.stringify({ publicaciones: previas }));
  const r = await correr(raiz, sim, args("r1", "facebook", `--video=${vertical}`, "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /ya van 30 reels de Facebook en las últimas 24 h/);
  assert.equal(sim.pedidos.length, 0);
});

// ---------- errores de Meta ----------
test("carga reanudable rechazada: se muestra el debug_info de rupload", async (t) => {
  const sim = await iniciarSimulador({ subidaFalla: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
  const video = enPieza(raiz, "r1", "reel.mp4", mp4(20));
  const r = await correr(raiz, sim, args("r1", "instagram", `--video=${video}`, "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /Mensaje original de Meta: "ProcessingFailedError: unauthorized user request"/);
  assert.equal(posts(sim, "/media_publish").length, 0);
});

test("mensajes: --red mal escrita no dice 'falta'", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, args("c1", "Instagram"));
  assert.equal(r.codigo, 2);
  assert.match(r.error, /--red=Instagram no vale/);
});
