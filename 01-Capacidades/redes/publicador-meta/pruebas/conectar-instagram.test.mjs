import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createSetupServer, verifyInstagramToken, updateEnvAtomically } from "../herramientas/conectar-instagram.mjs";

const TOKEN = "IGAA_TOKEN_FALSO_DE_PRUEBA_12345678901234567890";
const OLD = "IGAA_TOKEN_ANTERIOR_FALSO_12345678901234567890";
const ME = "https://graph.instagram.com/v26.0/me?fields=user_id,username";
const account = (username = "cuenta_demo") => new Response(JSON.stringify({ username, user_id: "17840000000000" }), { status: 200 });

function project(t, env = null) {
  const root = mkdtempSync(join(tmpdir(), "proyecto-meta-setup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "config.json"), JSON.stringify({ meta: { usuarioInstagram: "cuenta_demo" } }));
  if (env !== null) writeFileSync(join(root, ".env"), env);
  return root;
}

async function setup(t, options = {}) {
  const root = options.root ?? project(t);
  let calls = 0;
  const fetchImpl = options.fetchImpl ?? (async (url, request) => {
    calls++;
    assert.equal(url, ME);
    assert.equal(request.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(request.redirect, "error");
    assert.ok(request.signal);
    return account();
  });
  const server = await createSetupServer({ root, fetchImpl });
  t.after(() => server.close());
  return { ...server, root, calls: () => calls };
}

function postOptions(s, overrides = {}) {
  const url = new URL(s.url);
  return {
    method: "POST",
    headers: { Origin: url.origin, "Content-Type": "application/x-www-form-urlencoded", ...overrides.headers },
    body: overrides.body ?? new URLSearchParams({ nonce: url.pathname.split("/").at(-1), token: TOKEN }).toString(),
  };
}

function requestWithHost(url, options, host) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: options.method, headers: { ...options.headers, Host: host } }, (res) => {
      let body = "";
      res.setEncoding("utf8"); res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject); req.end(options.body);
  });
}

test("verifica solo con el endpoint oficial y la cabecera Bearer", async () => {
  const result = await verifyInstagramToken(TOKEN, "cuenta_demo", async (url, options) => {
    assert.equal(url, ME); assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(options.redirect, "error");
    return account("cuenta_demo");
  });
  assert.deepEqual(result, { username: "cuenta_demo", userId: "17840000000000" });
});

test("acepta /me envuelto en data con una sola cuenta y rechaza varias", async () => {
  const user = { username: "cuenta_demo", user_id: "17840000000000" };
  const result = await verifyInstagramToken(TOKEN, "cuenta_demo", async () => new Response(JSON.stringify({ data: [user] })));
  assert.deepEqual(result, { username: "cuenta_demo", userId: "17840000000000" });
  for (const data of [[], [user, { username: "otra", user_id: "17840000000001" }]]) {
    await assert.rejects(verifyInstagramToken(TOKEN, "cuenta_demo", async () => new Response(JSON.stringify({ data }))), /cuenta válida/);
  }
});

test("la conexión correcta preserva otras líneas, BOM, CRLF y el token de Facebook", async (t) => {
  const previous = `\uFEFF# cuenta local\r\nMETA_ACCESS_TOKEN=EAA_TOKEN_DE_FACEBOOK_FALSO\r\nINSTAGRAM_TOKEN=${OLD}\r\n\r\nMETA_PAGE_ID=1111222233334444\nOTRA="valor # interno"`;
  const s = await setup(t, { root: project(t, previous) });
  const landing = await fetch(s.url);
  const landingText = await landing.text();
  assert.match(landingText, /type="password"/);
  assert.match(landingText, /@cuenta_demo/);
  assert.equal(landing.headers.get("cache-control"), "no-store");
  const response = await fetch(s.url, postOptions(s));
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(readFileSync(join(s.root, ".env"), "utf8"), previous.replace(`INSTAGRAM_TOKEN=${OLD}`, `INSTAGRAM_TOKEN=${TOKEN}`));
  assert.equal(await s.done, "connected");
  assert.equal(s.calls(), 1);
  assert.match(text, /Instagram conectado/);
  assert.ok(!text.includes(TOKEN));
  assert.ok(!text.includes(OLD));
  assert.deepEqual(readdirSync(s.root).sort(), [".env", "config.json"]);
});

test("agrega INSTAGRAM_TOKEN sin perder un archivo sin salto final", (t) => {
  const root = project(t, "# comentario\r\nMETA_ACCESS_TOKEN=FACEBOOK_FALSO");
  updateEnvAtomically(root, TOKEN);
  assert.equal(readFileSync(join(root, ".env"), "utf8"), `# comentario\r\nMETA_ACCESS_TOKEN=FACEBOOK_FALSO\r\nINSTAGRAM_TOKEN=${TOKEN}\r\n`);
});

test("actualiza la última definición con export sin tocar otros tokens", (t) => {
  const previous = `INSTAGRAM_TOKEN=duplicado_antiguo\nOTRO_TOKEN=conservar\n export INSTAGRAM_TOKEN = '${OLD}' # antes`;
  const root = project(t, previous);
  updateEnvAtomically(root, TOKEN);
  assert.equal(readFileSync(join(root, ".env"), "utf8"), `INSTAGRAM_TOKEN=duplicado_antiguo\nOTRO_TOKEN=conservar\n export INSTAGRAM_TOKEN = ${TOKEN}`);
});

test("rechaza CSRF, nonce incorrecto, Host ajeno y ruta incorrecta sin consultar Meta", async (t) => {
  const s = await setup(t);
  const cases = [
    { headers: { Origin: "https://sitio-ajeno.example" } },
    { headers: { Origin: "null" } },
    { body: new URLSearchParams({ nonce: "falso", token: TOKEN }).toString() },
    { body: new URLSearchParams({ token: TOKEN }).toString() },
  ];
  for (const change of cases) {
    const response = await fetch(s.url, postOptions(s, change));
    assert.equal(response.status, 403); assert.ok(!(await response.text()).includes(TOKEN));
  }
  // fetch impide sobrescribir Host en algunas versiones de Node; usar HTTP para probar el encabezado real.
  const wrongHost = await requestWithHost(s.url, postOptions(s), "sitio-ajeno.example");
  assert.equal(wrongHost.status, 403); assert.ok(!wrongHost.body.includes(TOKEN));
  const withoutOrigin = postOptions(s); delete withoutOrigin.headers.Origin;
  const missingOrigin = await fetch(s.url, withoutOrigin);
  assert.equal(missingOrigin.status, 403);
  const response = await fetch(s.url.replace(/\/conectar\/[^/]+$/, "/conectar/otro"));
  assert.equal(response.status, 403);
  assert.equal(s.calls(), 0);
  assert.equal(existsSync(join(s.root, ".env")), false);
});

test("la política conserva Origin de formularios locales y sigue rechazando null", async (t) => {
  const s = await setup(t);
  const landing = await fetch(s.url);
  assert.equal(landing.headers.get("referrer-policy"), "same-origin");
  assert.equal(landing.headers.get("cache-control"), "no-store");
  assert.match(landing.headers.get("content-security-policy"), /form-action 'self'/);
  await landing.text();
  const rejected = await fetch(s.url, postOptions(s, { headers: { Origin: "null" } }));
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("referrer-policy"), "same-origin");
  assert.equal(s.calls(), 0);
  assert.equal(existsSync(join(s.root, ".env")), false);
  const accepted = await fetch(s.url, postOptions(s));
  assert.equal(accepted.status, 200);
  await accepted.text();
  assert.equal(s.calls(), 1);
  assert.equal(await s.done, "connected");
});

test("rechaza tipo de cuerpo, campos duplicados y exceso de tamaño", async (t) => {
  const s = await setup(t);
  const nonce = new URL(s.url).pathname.split("/").at(-1);
  const invalidType = await fetch(s.url, postOptions(s, { headers: { "Content-Type": "text/plain" } }));
  assert.equal(invalidType.status, 415);
  const duplicate = await fetch(s.url, postOptions(s, { body: `nonce=${nonce}&nonce=${nonce}&token=${TOKEN}` }));
  assert.equal(duplicate.status, 403);
  const large = await fetch(s.url, postOptions(s, { body: "token=" + "x".repeat(9000) }));
  assert.equal(large.status, 413);
  assert.equal(s.calls(), 0);
  assert.equal(existsSync(join(s.root, ".env")), false);
});

test("una cuenta incorrecta no modifica .env ni devuelve el token", async (t) => {
  const previous = `META_ACCESS_TOKEN=FACEBOOK_FALSO\nINSTAGRAM_TOKEN=${OLD}\n`;
  const s = await setup(t, { root: project(t, previous), fetchImpl: async () => account("otra_cuenta") });
  const response = await fetch(s.url, postOptions(s));
  const text = await response.text();
  assert.equal(response.status, 422);
  assert.match(text, /pertenece a otra cuenta/);
  assert.ok(!text.includes(TOKEN)); assert.ok(!text.includes(OLD));
  assert.equal(readFileSync(join(s.root, ".env"), "utf8"), previous);
});

test("no filtra errores externos aunque Meta o la red repitan el token", async (t) => {
  for (const fetchImpl of [
    async () => new Response(JSON.stringify({ error: { message: `error secreto ${TOKEN}` } }), { status: 400 }),
    async () => { throw new Error(`fallo de red ${TOKEN}`); },
  ]) {
    const s = await setup(t, { fetchImpl });
    const response = await fetch(s.url, postOptions(s));
    const text = await response.text();
    assert.equal(response.status, 502);
    assert.ok(!text.includes(TOKEN)); assert.ok(!text.includes(TOKEN.slice(4, 20)));
    assert.equal(existsSync(join(s.root, ".env")), false);
  }
});

test("evita dos verificaciones concurrentes y guarda una sola vez", async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const s = await setup(t, { fetchImpl: async () => { entered(); await gate; return account(); } });
  const first = fetch(s.url, postOptions(s));
  await started;
  const second = await fetch(s.url, postOptions(s));
  assert.equal(second.status, 409);
  release();
  const response = await first;
  assert.equal(response.status, 200);
  await response.text();
  assert.equal(await s.done, "connected");
});

test("rechaza UTF-16 sin cambiar el archivo", (t) => {
  const original = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("INSTAGRAM_TOKEN=", "utf16le")]);
  const root = project(t, original);
  assert.throws(() => updateEnvAtomically(root, TOKEN), /UTF-16/);
  assert.deepEqual(readFileSync(join(root, ".env")), original);
});
