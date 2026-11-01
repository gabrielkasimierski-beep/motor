// Los casos de la verificación independiente del publicador de Meta (oct-2026), contra el simulador.
//   node --test        (desde maquina-de-contenido/)
// Los de arriba fallan con el publicador de antes de la corrección y pasan con el de ahora; los de
// "casos límite" cubren bordes que ya andaban y no tenían prueba.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { iniciarSimulador, TOKEN_PRUEBA, TOKEN_PAGINA, PAGE_ID, IG_ID } from "./simulador-meta.mjs";
import { RAIZ, TANDA, jpeg, mp4, crearProyecto, enPieza, correr, args, posts, leer, registro, limpiarTemporales, conTokenAProposito } from "./armado.mjs";
import { tomarCandado } from "../herramientas/meta/registro.mjs";
import { validarTexto } from "../herramientas/meta/validar.mjs";
import { leerJpeg } from "../herramientas/meta/archivos.mjs";
import { esDeDrive, revisarBaseUrl } from "../herramientas/meta/medios.mjs";
import { contieneSecreto } from "../herramientas/meta/entorno.mjs";
import { ErrorMeta } from "../herramientas/meta/errores.mjs";

after(limpiarTemporales);

const RESOLUCION = "Resolution too low. Video must have a minimum resolution of 540p.";
const consultasDeEstado = (sim, videoId) => sim.pedidos.filter((p) => p.metodo === "GET" && p.ruta === `/v26.0/${videoId}` && String(p.query.fields).includes("status"));
const escribirRegistro = (raiz, publicaciones) => {
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  writeFileSync(join(raiz, "registro-meta", "publicaciones.json"), JSON.stringify({ publicaciones }));
};

// ---------- Facebook: el video no se da por publicado hasta que Meta lo confirma ----------
test("reel de Facebook con el error de procesamiento de la doc: corta enseguida y muestra el motivo de Meta", async (t) => {
  const sim = await iniciarSimulador({ errorDeProcesamiento: RESOLUCION });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }] });
  const video = enPieza(raiz, "r1", "reel.mp4", mp4(20));
  const r = await correr(raiz, sim, args("r1", "facebook", `--video=${video}`, "--de-verdad"));
  assert.notEqual(r.codigo, 0, r.todo);
  assert.match(r.error, /falló al procesarlo \(Resolution too low\. Video must have a minimum resolution of 540p\.\)/);
  assert.doesNotMatch(r.todo, /sigue en "processing"/);
  assert.equal(consultasDeEstado(sim, [...sim.estado.videos.keys()][0]).length, 1, "corta en la primera consulta");
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso"]);
});

test("historia en video de Facebook: si el video queda en error después del finish, queda dudoso y no publicado", async (t) => {
  const sim = await iniciarSimulador({ videoStatusTrasFinish: "error" });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { historias: [{ id: "h-video" }] });
  const video = enPieza(raiz, "h-video", "historia.mp4", mp4(15, 40_000, { ancho: 1080, alto: 1920 }));
  const r = await correr(raiz, sim, args("h-video", "facebook", "--formato=historia", `--video=${video}`, "--de-verdad"));
  assert.notEqual(r.codigo, 0, r.todo);
  assert.match(r.error, /Meta aceptó la historia \d+ pero falló al procesarlo \(error\)/);
  const idVideo = [...sim.estado.videos.keys()][0];
  const iFinish = sim.pedidos.findIndex((p) => p.metodo === "POST" && p.ruta.endsWith("/video_stories") && p.cuerpo.upload_phase === "finish");
  assert.ok(consultasDeEstado(sim, idVideo).some((p) => sim.pedidos.indexOf(p) > iFinish), "consultó el estado después del finish");
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso"]);
  assert.match(leer(raiz, "calendario.md"), /\| `perfil\/h-video\.png` \+ compartir el post 01 \| aprobado \|/);
  assert.doesNotMatch(leer(raiz, "registro.md"), /Facebook \(historia\)/);
});

// ---------- candado colgado: se saca de a uno y solo si sigue siendo el mismo ----------
test("candado colgado: si otra corrida ya lo reemplazó por el suyo, no se borra", () => {
  const raiz = mkdtempSync(join(tmpdir(), "meta-candado-"));
  try {
    mkdirSync(join(raiz, "registro-meta"));
    const candado = join(raiz, "registro-meta", ".candado");
    writeFileSync(candado, JSON.stringify({ pid: 2_000_000_000, desde: "2026-10-01T00:00:00Z" }));
    const otro = JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }) + "\n";
    // Otra corrida saca el colgado y pone el suyo justo después de que esta lo leyó.
    assert.throws(() => tomarCandado(raiz, { alLeerColgado: () => writeFileSync(candado, otro) }), /hay otra publicación corriendo/);
    assert.equal(readFileSync(candado, "utf8"), otro, "el candado de la otra corrida sigue puesto");
    assert.ok(!existsSync(candado + ".rompiendo"));
    // Sin nadie más, el colgado se saca y se toma.
    writeFileSync(candado, JSON.stringify({ pid: 2_000_000_000, desde: "2026-10-01T00:00:00Z" }));
    const soltar = tomarCandado(raiz);
    assert.equal(JSON.parse(readFileSync(candado, "utf8")).pid, process.pid);
    soltar();
    assert.ok(!existsSync(candado));
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// ---------- el token no sale nunca ----------
test("token pegado en la línea META_GRAPH_VERSION: ningún comando lo muestra", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  writeFileSync(join(raiz, ".env"), `META_ACCESS_TOKEN=\nMETA_PAGE_ID=${PAGE_ID}\nMETA_GRAPH_VERSION=v26.0${TOKEN_PRUEBA}\n`);
  // correr() además revisa que no salga ni un pedazo de 8 caracteres del token.
  for (const comando of [["verificar"], ["estado"], args("c1", "facebook")]) {
    const r = await correr(raiz, sim, comando);
    assert.equal(r.codigo, 2, r.todo);
    assert.match(r.error, /META_GRAPH_VERSION tiene que ser como "v26\.0"/);
    assert.ok(!r.todo.includes(TOKEN_PRUEBA));
  }
  assert.equal(sim.pedidos.length, 0);
});

test("un token pegado en .env.ejemplo (que va al repositorio) frena todo", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  writeFileSync(join(raiz, ".env.ejemplo"), `META_ACCESS_TOKEN=${TOKEN_PRUEBA}\nMETA_PAGE_ID=\n`);
  conTokenAProposito.add(join(raiz, ".env.ejemplo"));
  const r = await correr(raiz, sim, ["verificar"]);
  assert.equal(r.codigo, 2);
  assert.match(r.error, /\.env\.ejemplo tiene un META_ACCESS_TOKEN/);
  assert.equal(sim.pedidos.length, 0);
  writeFileSync(join(raiz, ".env.ejemplo"), "META_ACCESS_TOKEN=\nMETA_PAGE_ID=\n");
  const vacio = await correr(raiz, sim, ["verificar"]);
  assert.equal(vacio.codigo, 0, vacio.todo);
});

test("el texto no puede traer el token de la página ni algo con forma de token", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  // El de la página se conoce recién al hablar con Meta: se vuelve a revisar antes de publicar.
  const conPagina = enPieza(raiz, "c1", "pagina.txt", `Promo del mes. ${TOKEN_PAGINA}`);
  conTokenAProposito.add(conPagina);
  const r = await correr(raiz, sim, args("c1", "facebook", `--texto=${conPagina}`, "--de-verdad"));
  assert.equal(r.codigo, 2, r.todo);
  assert.match(r.error, /trae el token de Meta/);
  assert.equal(sim.pedidos.filter((p) => p.metodo === "POST").length, 0);
  // Uno viejo o de otra app: "EAA" + decenas de letras y números.
  const viejo = enPieza(raiz, "c1", "viejo.txt", "Código: EAAB1c2D3e4F5g6H7i8J9k0L1m2N3o4P5q6R7s8");
  const s = await correr(raiz, sim, args("c1", "facebook", `--texto=${viejo}`));
  assert.equal(s.codigo, 2, s.todo);
  assert.doesNotMatch(s.todo, /EAAB1c2D3e4F/);
});

// ---------- repetir y resolver ----------
test("--repetir con --red=ambas se niega si una red ya salió; con la red que falta, sí (y el dudoso viejo queda descartado)", async (t) => {
  const sim = await iniciarSimulador({ feedFalla500: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, args("c1", "ambas", "--de-verdad"));
  assert.notEqual(r.codigo, 0, r.todo);
  assert.deepEqual(registro(raiz).map((p) => `${p.red}:${p.estado}`), ["instagram:publicado", "facebook:dudoso"]);
  assert.match(r.salida, /resolver --tanda=2099-01-prueba --id=c1 --red=facebook --salio=si --link=/);
  assert.match(r.salida, /--red=facebook --repetir/);
  const ambas = await correr(raiz, sim, args("c1", "ambas", "--de-verdad", "--repetir"));
  assert.notEqual(ambas.codigo, 0);
  assert.match(ambas.error, /con --red=ambas, --repetir publicaría otra vez donde ya salió.*Repetí solo Facebook: --red=facebook --repetir/s);
  assert.equal(sim.estado.medias.length, 1, "Instagram no se repitió");
  const fb = await correr(raiz, sim, args("c1", "facebook", "--de-verdad", "--repetir"));
  assert.equal(fb.codigo, 0, fb.todo);
  assert.equal(sim.estado.medias.length, 1);
  assert.equal(sim.estado.posts.length, 1);
  assert.deepEqual(registro(raiz).map((p) => `${p.red}:${p.estado}`), ["instagram:publicado", "facebook:descartado", "facebook:publicado"]);
  const e = await correr(raiz, sim, ["estado"]);
  assert.doesNotMatch(e.salida, /↳/);
});

test("resolver: --salio=si cierra un dudoso con el link; --salio=no lo saca y deja publicar sin --repetir", async (t) => {
  const sim = await iniciarSimulador({ videoStatusTrasFinish: "processing" });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { reels: [{ id: "r1" }, { id: "r2" }] });
  const v1 = enPieza(raiz, "r1", "reel.mp4", mp4(20));
  const v2 = enPieza(raiz, "r2", "reel.mp4", mp4(20));
  assert.notEqual((await correr(raiz, sim, args("r1", "facebook", `--video=${v1}`, "--de-verdad"))).codigo, 0);
  assert.notEqual((await correr(raiz, sim, args("r2", "facebook", `--video=${v2}`, "--de-verdad"))).codigo, 0);
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["dudoso", "dudoso"]);
  const resolver = (id, ...mas) => ["resolver", `--tanda=${TANDA}`, `--id=${id}`, "--red=facebook", ...mas];

  // Mal pedido: sin link, un link de otra red o de otro lado.
  for (const mal of [["--salio=si"], ["--salio=si", "--link=https://www.instagram.com/p/x/"], ["--salio=si", "--link=http://www.facebook.com/x"], ["--salio=quizas"]]) {
    const x = await correr(raiz, sim, resolver("r1", ...mal));
    assert.equal(x.codigo, 2, `${mal}: ${x.todo}`);
  }
  const link = "https://www.facebook.com/reel/123456";
  const si = await correr(raiz, sim, resolver("r1", "--salio=si", `--link=${link}`));
  assert.equal(si.codigo, 0, si.todo);
  assert.equal(registro(raiz).find((p) => p.id === "r1").estado, "publicado");
  assert.match(leer(raiz, "calendario.md"), /\| `guiones\/r1\.md` \(grabar\) \| publicado \(\[FB reel\]\(https:\/\/www\.facebook\.com\/reel\/123456\)\) \|/);
  assert.equal(leer(raiz, "registro.md").split("\n").filter((l) => l.includes("Facebook (reel)")).length, 1);

  const no = await correr(raiz, sim, resolver("r2", "--salio=no"));
  assert.equal(no.codigo, 0, no.todo);
  assert.deepEqual(registro(raiz).map((p) => `${p.id}:${p.estado}`), ["r1:publicado"]);
  const e = await correr(raiz, sim, ["estado"]);
  assert.doesNotMatch(e.salida, /↳/);
  // Ya no queda nada abierto: resolver se niega; y la pieza se publica sin --repetir.
  assert.notEqual((await correr(raiz, sim, resolver("r2", "--salio=no"))).codigo, 0);
  sim.escenario.videoStatusTrasFinish = null;
  const otra = await correr(raiz, sim, args("r2", "facebook", `--video=${v2}`, "--de-verdad"));
  assert.equal(otra.codigo, 0, otra.todo);
  assert.equal(registro(raiz).find((p) => p.id === "r2").estado, "publicado");
});

test("resolver cierra un en-curso (una corrida que se cortó a mitad)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  escribirRegistro(raiz, [{ ref: "x@1", clave: `${TANDA}/c1/instagram/carrusel`, tanda: TANDA, id: "c1", red: "instagram", formato: "carrusel", estado: "en-curso", desde: new Date().toISOString() }]);
  const e = await correr(raiz, sim, ["estado"]);
  assert.match(e.salida, /se cortó/);
  assert.match(e.salida, /resolver --tanda=2099-01-prueba --id=c1 --red=instagram --salio=si/);
  const antes = sim.pedidos.length;
  const r = await correr(raiz, sim, ["resolver", `--tanda=${TANDA}`, "--id=c1", "--red=instagram", "--salio=si", "--link=https://www.instagram.com/p/ABC123/"]);
  assert.equal(r.codigo, 0, r.todo);
  assert.equal(registro(raiz)[0].estado, "publicado");
  assert.match(leer(raiz, "calendario.md"), /\| publicado \(\[IG\]\(https:\/\/www\.instagram\.com\/p\/ABC123\/\)\) \|/);
  assert.equal(sim.pedidos.length, antes, "resolver no habla con Meta");
});

test("historias y reels: la misma pieza con otra --tanda no se vuelve a publicar", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { historias: [{ id: "historia-hola" }] });
  // Se publicó con la tanda A y el proceso murió antes de anotar "publicado".
  escribirRegistro(raiz, [{ ref: "A@1", clave: "A/historia-hola/instagram/historia", tanda: "A", id: "historia-hola", red: "instagram", formato: "historia", estado: "en-curso", desde: new Date().toISOString() }]);
  mkdirSync(join(raiz, "publicar", "B", "historia-hola"), { recursive: true });
  const imagen = join(raiz, "publicar", "B", "historia-hola", "historia.jpg");
  writeFileSync(imagen, jpeg(1080, 1920));
  const r = await correr(raiz, sim, ["publicar", "--tanda=B", "--id=historia-hola", "--red=instagram", "--formato=historia", `--imagen=${imagen}`, "--de-verdad"]);
  assert.notEqual(r.codigo, 0, r.todo);
  assert.match(r.error, /Instagram quedó "en-curso".*mirá la cuenta antes de repetir/s);
  assert.equal(posts(sim, "/media_publish").length, 0);
});

// ---------- lo que se publica es lo que está en la carpeta ----------
test("la imagen de la web tiene que ser byte a byte la copia local (mismo peso o distinto)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const local = readFileSync(join(raiz, "publicar", TANDA, "i1", "01.jpg"));
  const web = join(raiz, "web-vieja");
  mkdirSync(join(web, TANDA, "i1"), { recursive: true });
  sim.escenario.carpetaMedios = web;
  const mismoPeso = Buffer.from(local);
  mismoPeso[local.length - 10] ^= 0xff;
  for (const vieja of [mismoPeso, jpeg(1080, 1350, 5000)]) {
    writeFileSync(join(web, TANDA, "i1", "01.jpg"), vieja);
    const r = await correr(raiz, sim, args("i1", "ambas", "--de-verdad"));
    assert.notEqual(r.codigo, 0, r.todo);
    assert.match(r.error, /01\.jpg en la web .* no es igual a la copia local/);
    assert.equal(sim.pedidosAMeta().filter((p) => p.metodo === "POST").length, 0);
  }
  assert.equal(registro(raiz).length, 0);
});

test("si no se puede escribir calendario.md, avisa en castellano, sigue con Facebook y no deja el .tmp", { skip: process.platform !== "win32" && "en Windows reemplazar un archivo de solo lectura da EPERM; en Linux o Mac no falla" }, async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const cal = join(raiz, "calendario.md");
  chmodSync(cal, 0o444);
  t.after(() => chmodSync(cal, 0o644));
  const r = await correr(raiz, sim, args("c1", "ambas", "--de-verdad"));
  assert.notEqual(r.codigo, 0, r.todo);
  assert.match(r.salida, /Instagram ya quedó publicado, pero no pude anotarlo en registro\.md \/ calendario\.md \(el archivo está en solo lectura o abierto en otro programa\)/);
  assert.match(r.error, /ya quedó todo publicado .* No vuelvas a publicar/s);
  assert.equal(sim.estado.medias.length, 1);
  assert.equal(sim.estado.posts.length, 1, "Facebook se publicó igual");
  assert.deepEqual(registro(raiz).map((p) => p.estado), ["publicado", "publicado"]);
  assert.ok(!existsSync(cal + ".tmp"));
});

// ---------- seguros chicos ----------
test("si Meta no devuelve el usuario de Instagram, no publica (el seguro no queda abierto)", async (t) => {
  const sim = await iniciarSimulador({ usuario: "" });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /Meta no devolvió el usuario de la cuenta de Instagram/);
  assert.equal(posts(sim, `/${IG_ID}/media`).length, 0);
});

test("un publicaciones.json con otra forma no se toma como vacío", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  mkdirSync(join(raiz, "registro-meta"), { recursive: true });
  writeFileSync(join(raiz, "registro-meta", "publicaciones.json"), JSON.stringify({ publicaciones: { "i1": "publicado" } }));
  const r = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /no tiene la forma \{ "publicaciones": \[ … \] \}/);
  assert.equal(sim.pedidos.length, 0);
});

test("solo Facebook con un texto que Instagram no acepta: avisa (no dice OK)", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const texto = "Hola. " + Array.from({ length: 31 }, (_, i) => `#tema${i}`).join(" ");
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1, texto }] });
  const r = await correr(raiz, sim, args("i1", "facebook"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /31 hashtags.*: NO pasa en Instagram \(solo Facebook\)/);
  assert.match(r.salida, /no se va a poder publicar igual en Instagram/);
  const ig = await correr(raiz, sim, args("i1", "instagram"));
  assert.notEqual(ig.codigo, 0);
  assert.match(ig.error, /31 hashtags/);
});

test("con --red=ambas, si Instagram falla antes de publicar: dice que no salió nada y que Facebook no se intentó", async (t) => {
  const sim = await iniciarSimulador({ permisosFaltantes: ["instagram_content_publish"] });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  const r = await correr(raiz, sim, args("i1", "ambas", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.salida, /No se publicó nada en Instagram/);
  assert.match(r.salida, /Facebook no se intentó: .*--red=facebook/);
  assert.equal(posts(sim, `/${PAGE_ID}/photos`).length, 0);
});

test("unidades: Drive con punto final, forma de token y el pedido de ads_management", () => {
  for (const u of ["https://drive.google.com./x", "https://lh3.googleusercontent.com./x"]) {
    assert.ok(esDeDrive(u), u);
    assert.throws(() => revisarBaseUrl(u), /Google/);
  }
  assert.ok(contieneSecreto("viejo EAAB1c2D3e4F5g6H7i8J9k0L1m2N3o4P5q6R7s8"));
  assert.ok(!contieneSecreto("EAA es una sigla. EAAB corto."));
  const conRead = new ErrorMeta({ http: 403, error: { code: 200, message: "The calling app is missing the ads_management permission for the target." } });
  assert.match(conRead.sugerencia, /si el token ya tiene ads_read, generalo de nuevo sumando ads_management/);
  const sinNada = new ErrorMeta({ http: 403, error: { code: 200, message: "Requires ads_read permission" } });
  assert.match(sinNada.sugerencia, /al token le falta ads_read/);
});

test("verificar: opcionales según la doc, el pedido de ads_management y el aviso del modo desarrollo", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const ok = await correr(crearProyecto(sim, {}), sim, ["verificar"]);
  assert.equal(ok.codigo, 0, ok.todo);
  assert.match(ok.salida, /--    pages_read_user_content \(opcional/);
  assert.match(ok.salida, /publish_video \(opcional: según la referencia de permisos es para video en vivo/);
  assert.match(ok.salida, /ads_read alcanza según las referencias de Instagram/);
  assert.match(ok.salida, /en Facebook la doc de Meta dice que lo publicado lo ven solo quienes tienen rol en la app; en Instagram no está documentado/);

  // El token ya tiene ads_read y Meta pide ads_management: no tiene que decir "falta ads_read".
  const simAds = await iniciarSimulador({ igPideAdsManagement: true });
  t.after(simAds.cerrar);
  const r = await correr(crearProyecto(simAds, {}), simAds, ["verificar"]);
  assert.notEqual(r.codigo, 0);
  assert.match(r.salida, /OK    ads_read/);
  assert.match(r.salida, /Instagram pide ads_management: generá el token de nuevo sumando ads_management/);
  assert.doesNotMatch(r.salida, /Todo en orden/);
});

// ---------- casos límite que ya andaban (sin prueba hasta ahora) ----------
test("límites: 2200/2201 caracteres, 30/31 hashtags, 20/21 menciones, PNG con nombre .jpg y JPEG progresivo", () => {
  assert.deepEqual(validarTexto("a".repeat(2200)).errores, []);
  assert.match(validarTexto("a".repeat(2201)).errores.join(), /2201 caracteres/);
  const tags = (n) => Array.from({ length: n }, (_, i) => `#t${i}`).join(" ");
  assert.deepEqual(validarTexto(tags(30)).errores, []);
  assert.match(validarTexto(tags(31)).errores.join(), /31 hashtags/);
  const menciones = (n) => Array.from({ length: n }, (_, i) => `@u${i}`).join(" ");
  assert.deepEqual(validarTexto(menciones(20)).errores, []);
  assert.match(validarTexto(menciones(21)).errores.join(), /21 menciones/);

  const raiz = mkdtempSync(join(tmpdir(), "meta-jpeg-"));
  try {
    const png = join(raiz, "lamina.jpg");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    assert.throws(() => leerJpeg(png), /no es JPEG/);
    // Progresivo: SOF2 (0xFFC2) en lugar de SOF0.
    const progresivo = join(raiz, "progresivo.jpg");
    writeFileSync(progresivo, Buffer.from(jpeg(1080, 1350).toString("latin1").replace("\xff\xc0", "\xff\xc2"), "latin1"));
    const info = leerJpeg(progresivo);
    assert.deepEqual([info.ancho, info.alto], [1080, 1350]);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("límites: carrusel de 11 en Instagram, contenedor EXPIRED, contenedor que nunca termina y cupo 49/50", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c11", laminas: 11 }] });
  const once = await correr(raiz, sim, args("c11", "instagram"));
  assert.notEqual(once.codigo, 0);
  assert.match(once.error, /Instagram acepta hasta 10/);
  assert.equal(sim.pedidos.length, 0);

  const simExp = await iniciarSimulador({ contenedorEstado: "EXPIRED" });
  t.after(simExp.cerrar);
  const rExp = crearProyecto(simExp, { piezas: [{ id: "i1", laminas: 1 }] });
  const exp = await correr(rExp, simExp, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(exp.codigo, 0);
  assert.match(exp.error, /quedó en EXPIRED.*No se publicó nada/s);
  assert.match(exp.error, /venció sin publicarse; volvé a correr el comando: se crea un contenedor nuevo/, "dice qué hacer (antes decía 'sin detalle')");
  assert.equal(posts(simExp, "/media_publish").length, 0);
  assert.equal(registro(rExp).length, 0);

  const simLento = await iniciarSimulador({ sondeosEnCurso: 99 });
  t.after(simLento.cerrar);
  const rLento = crearProyecto(simLento, { piezas: [{ id: "i1", laminas: 1 }] });
  const lento = await correr(rLento, simLento, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(lento.codigo, 0);
  assert.match(lento.error, /sigue en IN_PROGRESS después de 5 minutos: no publico/);
  // No promete retomar ese contenedor: cada corrida crea uno nuevo.
  assert.match(lento.error, /no se publicó nada .*se crea un contenedor nuevo/s);
  assert.doesNotMatch(lento.error, /Probá de nuevo más tarde \(el contenedor/);
  assert.equal(posts(simLento, "/media_publish").length, 0);

  const simCupo = await iniciarSimulador({ cupoUsado: 49 });
  t.after(simCupo.cerrar);
  const rCupo = crearProyecto(simCupo, { piezas: [{ id: "i1", laminas: 1 }, { id: "i2", laminas: 1 }] });
  assert.equal((await correr(rCupo, simCupo, args("i1", "instagram", "--de-verdad"))).codigo, 0);
  const lleno = await correr(rCupo, simCupo, args("i2", "instagram", "--de-verdad"));
  assert.notEqual(lleno.codigo, 0);
  assert.match(lleno.error, /50 de 50/);
});

test("límites: /feed contesta 500 pero el posteo se creó → se confirma consultando y no se duplica", async (t) => {
  const sim = await iniciarSimulador({ feedFalla500ConPost: true });
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "c1", laminas: 2 }] });
  const r = await correr(raiz, sim, args("c1", "facebook", "--de-verdad"));
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida, /lo confirmé consultando/);
  assert.equal(sim.estado.posts.length, 1);
  assert.equal(posts(sim, `/${PAGE_ID}/feed`).length, 1, "no se pidió dos veces");
  assert.equal(registro(raiz)[0].estado, "publicado");
});

test("límites: proceso muerto en media_publish (en-curso + candado colgado): se saca el candado y se frena por el registro", async (t) => {
  const sim = await iniciarSimulador();
  t.after(sim.cerrar);
  const raiz = crearProyecto(sim, { piezas: [{ id: "i1", laminas: 1 }] });
  escribirRegistro(raiz, [{ ref: "x@1", clave: `${TANDA}/i1/instagram/imagen`, tanda: TANDA, id: "i1", red: "instagram", formato: "imagen", estado: "en-curso", desde: new Date().toISOString() }]);
  writeFileSync(join(raiz, "registro-meta", ".candado"), JSON.stringify({ pid: 2_000_000_000, desde: "2026-10-01T00:00:00Z" }));
  const r = await correr(raiz, sim, args("i1", "instagram", "--de-verdad"));
  assert.notEqual(r.codigo, 0);
  assert.match(r.error, /no publico dos veces lo mismo: Instagram quedó "en-curso".*resolver --tanda=2099-01-prueba --id=i1 --red=instagram/s);
  assert.ok(!existsSync(join(raiz, "registro-meta", ".candado")));
  assert.equal(sim.pedidos.length, 0);
});
