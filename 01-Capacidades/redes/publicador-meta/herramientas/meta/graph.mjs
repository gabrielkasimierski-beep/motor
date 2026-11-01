// Cliente mínimo de la Graph API, con fetch nativo.
// - El token va siempre en la cabecera Authorization, nunca en la URL (las URL se pueden mostrar).
// - Solo habla con graph.facebook.com, rupload.facebook.com, graph.instagram.com (modo Instagram) o
//   el simulador local, y no sigue redirecciones: el token no sale a otro lado. Cada cliente conoce
//   un solo token y solo sus hosts: el de Instagram no puede mandar su token a graph.facebook.com.
//   La única excepción a "el token va en la cabecera" es la renovación del token de Instagram
//   (token-instagram.mjs): la doc solo la documenta con el token en la URL.
// - Reintenta solo lo que es seguro: lecturas y pedidos que no publican; un pedido que publica
//   se reintenta únicamente si Meta lo rechazó por límite (o sea, seguro que no salió).
// - En simulación no manda nada: muestra cada pedido y devuelve una respuesta de mentira.
import { openAsBlob, statSync } from "node:fs";
import { basename } from "node:path";
import { ErrorMeta, ErrorRed, TOKEN_IG_NO_SIRVE } from "./errores.mjs";
import { decir, registrarSecreto, sanear, Falla } from "./entorno.mjs";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_REINTENTOS = 3;
const ESPERAS_LIMITE = [5_000, 20_000, 60_000];
const ESPERAS_PASAJERO = [2_000, 5_000, 15_000];

// Para mostrar un valor en una línea: los textos largos (caption, message…) se recortan.
const TEXTOS = new Set(["caption", "message", "description"]);
function resumir(clave, valor) {
  if (typeof valor !== "string") return sanear(JSON.stringify(valor));
  // Se sanea antes de recortar: un token cortado a la mitad ya no se reconocería entero.
  valor = sanear(valor);
  const plano = valor.replace(/\r?\n/g, " ⏎ ");
  const n = [...valor].length;
  return TEXTOS.has(clave) && n > 70 ? `"${[...plano].slice(0, 60).join("")}…" (${n} caracteres)` : `"${plano}"`;
}
// Query string legible: las comas de fields quedan como comas (Meta las acepta así).
const consulta = (params) =>
  Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2C/gi, ",")}`).join("&");

// Cliente para "Instagram API with Instagram Login": graph.instagram.com con INSTAGRAM_TOKEN, en la
// cabecera Authorization: Bearer (así lo muestran los ejemplos de la guía de publicación). Sin carga
// reanudable: la doc dice que rupload es "only for apps that have implemented Facebook Login for Business".
export function clienteInstagram(entorno, { simular }) {
  return crearCliente(
    { ...entorno, graph: entorno.igGraph, rupload: entorno.igGraph, token: entorno.igToken },
    { simular, nombreToken: "INSTAGRAM_TOKEN", sinRupload: true },
  );
}

export function crearCliente(entorno, { simular, nombreToken = "META_ACCESS_TOKEN", sinRupload = false }) {
  const base = `${entorno.graph}/${entorno.version}`;
  const origenes = new Set([new URL(entorno.graph).origin, ...(sinRupload ? [] : [new URL(entorno.rupload).origin])]);
  const tokens = { usuario: entorno.token, pagina: null };
  const msReintento = Number(process.env.META_REINTENTO_MS) || 0; // solo para pruebas
  const contadores = {};
  let pedidosSimulados = 0;

  const cli = {
    simular,
    version: entorno.version,
    base,
    rupload: entorno.rupload,
    // En simulación los ids se ven así: <contenedor-1>, <foto-2>…
    idFalso(tipo) {
      contadores[tipo] = (contadores[tipo] || 0) + 1;
      return `<${tipo}-${contadores[tipo]}>`;
    },
    usarTokenPagina(token) {
      registrarSecreto(token);
      tokens.pagina = token;
    },
    tieneTokenPagina: () => Boolean(tokens.pagina),
    get pedidosSimulados() { return pedidosSimulados; },
    mostrar(metodo, url, campos, nota) {
      pedidosSimulados++;
      decir(`  ${metodo.padEnd(4)} ${url}`);
      for (const [k, v] of Object.entries(campos || {})) if (v !== undefined) decir(`         ${k}: ${resumir(k, v)}`);
      if (nota) decir(`         (${nota})`);
    },

    async get(ruta, params = {}, op = {}) {
      const qs = consulta(params);
      const url = `${base}/${ruta}${qs ? "?" + qs : ""}`;
      if (simular) { cli.mostrar("GET", url, null, op.nota); return op.simulado ?? {}; }
      return pedir("GET", url, { token: op.token, idempotente: true, donde: `GET /${ruta}` });
    },

    // op.publica = true cuando el pedido puede dejar algo publicado (no se reintenta a ciegas).
    async post(ruta, cuerpo = {}, op = {}) {
      const url = `${base}/${ruta}`;
      if (simular) { cli.mostrar("POST", url, cuerpo, op.nota); return op.simulado ?? {}; }
      return pedir("POST", url, {
        token: op.token,
        idempotente: !op.publica,
        donde: `POST /${ruta}`,
        cabeceras: { "Content-Type": "application/json" },
        cuerpo: () => JSON.stringify(cuerpo),
      });
    },

    // Foto como archivo (multipart/form-data), campo "source".
    async postArchivo(ruta, campos, archivo, op = {}) {
      const url = `${base}/${ruta}`;
      const kb = Math.round(statSync(archivo).size / 1024);
      if (simular) {
        cli.mostrar("POST", url, { "[multipart] source": `${basename(archivo)} (${kb} KB)`, ...campos }, op.nota);
        return op.simulado ?? {};
      }
      return pedir("POST", url, {
        token: op.token,
        idempotente: !op.publica,
        donde: `POST /${ruta}`,
        cuerpo: async () => {
          const datos = new FormData();
          for (const [k, v] of Object.entries(campos)) if (v !== undefined) datos.append(k, typeof v === "string" ? v : JSON.stringify(v));
          datos.append("source", await openAsBlob(archivo, { type: "image/jpeg" }), basename(archivo));
          return datos;
        },
      });
    },

    // Carga reanudable a rupload.facebook.com (Instagram y videos de la página): el archivo entero
    // desde el principio (offset 0). La cabecera de autorización acá es "OAuth", como dice la doc.
    async subir(url, archivo, op = {}) {
      if (sinRupload) throw new Falla("la carga reanudable (rupload) no está disponible con el inicio de sesión de Instagram: el video va por URL pública (config.json → medios.baseUrl)");
      const bytes = statSync(archivo).size;
      if (simular) {
        cli.mostrar("POST", url, {
          "Authorization": "OAuth (token de .env, no se muestra)",
          offset: "0",
          file_size: String(bytes),
          cuerpo: `${basename(archivo)} (${(bytes / 1048576).toFixed(1)} MB, binario)`,
        }, op.nota);
        return op.simulado ?? { success: true };
      }
      return pedir("POST", url, {
        token: op.token,
        idempotente: true,
        oauth: true,
        tope: 15 * 60_000,
        donde: `subida de ${basename(archivo)}`,
        cabeceras: { offset: "0", file_size: String(bytes), "Content-Type": "application/octet-stream" },
        cuerpo: () => openAsBlob(archivo),
      });
    },
  };

  async function pedir(metodo, url, { token = "usuario", idempotente, oauth = false, tope = 60_000, donde, cabeceras = {}, cuerpo }) {
    if (!origenes.has(new URL(url).origin)) throw new Error(`no mando el token a ${new URL(url).origin}: solo a Meta o al simulador`);
    const valor = token === "pagina" ? tokens.pagina || tokens.usuario : tokens.usuario;
    if (!valor) throw new Error(`falta ${nombreToken} en maquina-de-contenido/.env (ver .env.ejemplo)`);

    for (let intento = 0; ; intento++) {
      let respuesta;
      let datos;
      try {
        respuesta = await fetch(url, {
          method: metodo,
          headers: { ...cabeceras, Authorization: `${oauth ? "OAuth" : "Bearer"} ${valor}` },
          body: cuerpo ? await cuerpo() : undefined,
          // Una redirección llevaría la cabecera (y la URL) a otro host: se corta.
          redirect: "error",
          signal: AbortSignal.timeout(tope),
        });
        const texto = await respuesta.text();
        try { datos = texto ? JSON.parse(texto) : {}; } catch { datos = { crudo: texto.slice(0, 300) }; }
      } catch (e) {
        const err = new ErrorRed(donde, e?.cause?.code || e?.name || e?.message || "sin detalle");
        if (idempotente && intento < MAX_REINTENTOS) { await espera(msReintento || ESPERAS_PASAJERO[intento]); continue; }
        err.ambiguo = !idempotente; // un pedido que publica y no contestó: no sabemos si salió
        throw err;
      }
      if (respuesta.ok && !datos.error) return datos;

      // rupload no contesta con "error" sino con "debug_info" (type, message, retriable).
      const info = datos.debug_info;
      const error = datos.error
        || (info && { message: [info.type, info.message].filter(Boolean).join(": "), is_transient: info.retriable === true })
        || { message: datos.crudo };
      const err = new ErrorMeta({ http: respuesta.status, error, donde });
      // Con INSTAGRAM_TOKEN, el token nuevo sale del panel de la app y va en su línea de .env.
      if (nombreToken === "INSTAGRAM_TOKEN" && (err.code === 190 || err.code === 102)) err.sugerencia = TOKEN_IG_NO_SIRVE;
      if (err.limite && intento < MAX_REINTENTOS) { await espera(msReintento || ESPERAS_LIMITE[intento]); continue; }
      if (err.pasajero && idempotente && intento < MAX_REINTENTOS) { await espera(msReintento || ESPERAS_PASAJERO[intento]); continue; }
      if (err.pasajero && !idempotente) err.ambiguo = true;
      throw err;
    }
  }

  return cli;
}
