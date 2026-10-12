// Diagnóstico automático de la presencia web de una empresa.
//
// Mide lo que se puede medir sin abrir un navegador: si el dominio existe y cuándo vence,
// si la web carga, si tiene candado, si está adaptada al celular, si el WhatsApp tiene el
// número bien escrito, si el formulario envía a algún lado, si Google la puede mostrar, si la
// tienda está abierta, links e imágenes rotos y cuánto pesa.
// Lo que no se puede medir acá (Instagram, ficha de Google, cómo se lee) lo completa la
// skill `diagnostico-digital` con el navegador.
//
// Uso:
//   node diagnostico.js <dominio o url> [otro...]                      informe completo
//   node diagnostico.js --rapido <dominio> [otro...]                   una fila por dominio (listas de prospectos)
//   node diagnostico.js <dominio> --lighthouse --salida <carpeta>      + puntajes de Google y captura en celular
//
// Sin dependencias (Node 18+). --lighthouse usa `npx lighthouse` y el Chrome instalado.

"use strict";
const dns = require("dns").promises;
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36";
const HOY = new Date();
const ANIO = HOY.getFullYear();

// Subdominios de plataformas: si la web vive acá, la empresa no tiene dominio propio.
const PLATAFORMAS = ["netlify.app", "vercel.app", "github.io", "wixsite.com", "blogspot.com", "wordpress.com",
  "mitiendanube.com", "mercadoshops.com.ar", "empretienda.com.ar", "business.site", "linktr.ee", "carrd.co",
  "webnode.com", "webnode.com.ar", "site123.me", "godaddysites.com", "square.site", "weebly.com", "jimdosite.com",
  "my.canva.site", "framer.website", "taplink.cc", "beacons.ai", "bio.link"];
const REDES = /(^|\.)(instagram\.com|facebook\.com|fb\.com|wa\.me|whatsapp\.com|linktr\.ee|tiktok\.com)$/i;

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const opc = { rapido: false, lighthouse: false, salida: null };
const objetivos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--rapido") opc.rapido = true;
  else if (args[i] === "--lighthouse") opc.lighthouse = true;
  else if (args[i] === "--salida") opc.salida = args[++i];
  else objetivos.push(args[i]);
}
if (!objetivos.length) {
  console.error("Uso: node diagnostico.js [--rapido] <dominio o url> [otro...] [--lighthouse --salida <carpeta>]");
  process.exit(1);
}

// ---------------------------------------------------------------- utilidades
const fecha = iso => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
const seg = ms => (ms / 1000).toFixed(1).replace(".", ",") + " s";
const kb = b => Math.round(b / 1024).toLocaleString("es-AR") + " KB";
const dias = iso => Math.round((new Date(iso) - HOY) / 864e5);

function normalizar(entrada) {
  let s = entrada.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  return { url: u.href, host: u.hostname.toLowerCase(), dominio: registrable(u.hostname.toLowerCase()) };
}

// ejemplo.com.ar -> 3 partes · ejemplo.com / ejemplo.ar -> 2 partes
function registrable(host) {
  const p = host.replace(/^www\./, "").split(".");
  const segundoNivelAr = ["com", "org", "net", "gob", "gov", "edu", "int", "mil", "tur", "coop", "mutual", "musica", "senasa"];
  if (p.length >= 3 && p.at(-1) === "ar" && segundoNivelAr.includes(p.at(-2))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}

async function traer(url, { redirect = "follow", timeout = 20000, metodo = "GET", cuerpo = true } = {}) {
  const t0 = performance.now();
  const r = await fetch(url, {
    method: metodo, redirect, signal: AbortSignal.timeout(timeout),
    headers: { "user-agent": UA, "accept-language": "es-AR,es;q=0.9", accept: "text/html,*/*" },
  });
  const msCabeceras = Math.round(performance.now() - t0);
  const texto = cuerpo && metodo !== "HEAD" ? await r.text() : "";
  return { r, texto, ms: Math.round(performance.now() - t0), msCabeceras };
}

async function enTandas(items, tam, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += tam) out.push(...await Promise.all(items.slice(i, i + tam).map(fn)));
  return out;
}

// ---------------------------------------------------------------- dominio
async function rdap(dominio) {
  const tld = dominio.split(".").pop();
  const url = tld === "ar" ? `https://rdap.nic.ar/domain/${dominio}`
    : ["com", "net"].includes(tld) ? `https://rdap.verisign.com/${tld}/v1/domain/${dominio}`
    : `https://rdap.org/domain/${dominio}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { accept: "application/rdap+json" } });
    if (r.status === 404) return { registrado: false };
    if (!r.ok) return { error: `el registro respondió ${r.status}` };
    const j = await r.json();
    const ev = Object.fromEntries((j.events || []).map(e => [e.eventAction, e.eventDate]));
    const ns = (j.nameservers || j.fred_nsset?.nameservers || []).map(n => (n.ldhName || "").toLowerCase());
    const reg = (j.entities || []).find(e => (e.roles || []).includes("registrar"));
    const registrador = reg?.vcardArray?.[1]?.find(x => x[0] === "fn")?.[3] || null;
    return { registrado: true, alta: ev.registration || null, vence: ev.expiration || null, ns, registrador };
  } catch (e) {
    return { error: e.cause?.code || e.message };
  }
}

async function resolver(host) {
  let ips = [];
  try { ips = await dns.resolve4(host); } catch {}
  if (!ips.length) try { ips = await dns.resolve6(host); } catch {}
  return ips;
}

function certificado(host) {
  return new Promise(res => {
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 10000 }, () => {
      const c = s.getPeerCertificate();
      res({ valido: s.authorized, error: s.authorizationError || null, vence: c.valid_to || null, emisor: c.issuer?.O || null });
      s.end();
    });
    s.on("error", e => res({ error: e.code || e.message }));
    s.on("timeout", () => { s.destroy(); res({ error: "timeout" }); });
  });
}

// Cuando la web no anda: confirmarlo con el DNS público de Google (que no sea un problema de
// esta conexión) y buscar la última vez que el Archivo de Internet la vio funcionando.
async function pistasDeCaida(host) {
  let s = "";
  try {
    const j = await (await fetch(`https://dns.google/resolve?name=${host}&type=A`, { signal: AbortSignal.timeout(10000) })).json();
    if (!(j.Answer || []).length) {
      s += j.Status === 3 ? " Confirmado con el DNS público de Google: el nombre no existe."
        : j.Status === 2 ? " Confirmado con el DNS público de Google: los servidores del dominio no responden."
        : " Confirmado con el DNS público de Google: no tiene ninguna dirección cargada.";
    }
  } catch {}
  try {
    const url = `https://web.archive.org/cdx/search/cdx?url=${host.replace(/^www\./, "")}&output=json&fl=timestamp&filter=statuscode:200&limit=-1`;
    const filas = await (await fetch(url, { signal: AbortSignal.timeout(25000) })).json();
    const t = filas[1]?.[0];
    if (t) s += ` El Archivo de Internet la registró funcionando por última vez el ${fecha(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T12:00:00`)}.`;
  } catch {}
  return s;
}

// ---------------------------------------------------------------- html
function decodificar(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&([aeiou])acute;/gi, (_, v) => ({ a: "á", e: "é", i: "í", o: "ó", u: "ú", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú" })[v])
    .replace(/&ntilde;/g, "ñ").replace(/\s+/g, " ").trim();
}

function meta(html, nombre) {
  const a = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${nombre}["'][^>]*content=["']([^"']*)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nombre}["']`, "i"));
  return (a || b) ? decodificar((a || b)[1]) : null;
}

function analizarHtml(html, urlFinal) {
  const base = new URL(urlFinal);
  const todos = re => [...html.matchAll(re)];
  const sinScripts = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ");
  const texto = decodificar(sinScripts.replace(/<[^>]+>/g, " "));
  const palabras = texto.split(" ").filter(Boolean);

  const a = {};
  a.titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  a.titulo = a.titulo ? decodificar(a.titulo) : null;
  a.descripcion = meta(html, "description");
  a.ogImagen = meta(html, "og:image");
  a.generador = meta(html, "generator");
  a.robotsMeta = meta(html, "robots");
  a.canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || null;
  a.viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  a.idioma = (html.match(/<html[^>]*\slang=["']([^"']+)["']/i) || [])[1] || null;
  a.h1 = todos(/<h1[\s>]/gi).length;
  a.favicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html);
  a.palabras = palabras.length;
  a.textoInicial = palabras.slice(0, 45).join(" ");

  // contacto
  const wa = todos(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^"'\s]*?)phone=|whatsapp:\/\/send\?(?:[^"'\s]*?)phone=|web\.whatsapp\.com\/send\?(?:[^"'\s]*?)phone=)\+?(\d{8,15})([^"'\s<]*)/gi);
  a.whatsapp = [...new Set(wa.map(m => m[1]))];
  a.whatsappConMensaje = wa.some(m => /text=/i.test(m[2]));
  a.whatsappSinNumero = /whatsapp\.com\/send\/?\?(?:[^"'\s]*?)phone=(?:&|["'])/i.test(html);
  a.telefonos = [...new Set(todos(/href=["']tel:([^"']+)["']/gi).map(m => m[1].replace(/\s/g, "")))];
  a.telefonoEnTexto = /(?:\+?54\s?9?\s?)?\(?(?:011|11|15)\)?[\s.-]?\d{4}[\s.-]?\d{4}|\b4\d{3}[\s.-]\d{4}\b/.test(texto);
  a.mails = [...new Set(todos(/mailto:([^"'?\s>]+)/gi).map(m => decodificar(m[1]).toLowerCase()))];
  a.formularios = todos(/<form[\s>]/gi).length;
  a.formularioMailto = /<form[^>]*\saction=["']mailto:/i.test(html);
  a.accionesFormulario = [...new Set(todos(/<form[^>]*\saction=["']([^"'#][^"']*)["']/gi)
    .map(m => { try { return new URL(decodificar(m[1]), base).href; } catch { return null; } })
    .filter(u => u && /^https?:/.test(u)))].slice(0, 3);

  // medición y plataforma
  a.analitica = [];
  if (/gtag\/js\?id=G-|["'\s]G-[A-Z0-9]{8,12}["'\s]/.test(html)) a.analitica.push("Google Analytics 4");
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{5,8}/.test(html)) a.analitica.push("Google Tag Manager");
  if (/["'\s]UA-\d{4,10}-\d{1,4}["'\s]/.test(html)) a.analitica.push("Universal Analytics (apagado por Google)");
  if (/plausible\.io\/js/.test(html)) a.analitica.push("Plausible");
  if (/clarity\.ms/.test(html)) a.analitica.push("Microsoft Clarity");
  if (/connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/.test(html)) a.analitica.push("Píxel de Meta");

  const plataformas = [
    [/woocommerce/i, "WooCommerce"], [/wp-content|wp-includes/i, "WordPress"],
    [/wixstatic\.com|static\.parastorage\.com/i, "Wix"],
    [/tiendanube|nuvemshop|d26lpennugtm8s/i, "Tiendanube"], [/cdn\.shopify\.com/i, "Shopify"],
    [/squarespace/i, "Squarespace"], [/webflow/i, "Webflow"], [/empretienda/i, "Empretienda"],
    [/mercadoshops/i, "Mercado Shops"], [/img1\.wsimg\.com/i, "GoDaddy (constructor)"],
    [/zyrosite|hostinger/i, "Hostinger (constructor)"], [/\/_next\//, "Next.js"], [/framerusercontent/i, "Framer"],
    [/joomla/i, "Joomla"], [/drupal/i, "Drupal"], [/sites\.google\.com/i, "Google Sites"], [/blogger\.com|blogspot/i, "Blogger"],
  ];
  a.plataforma = (plataformas.find(([re]) => re.test(html)) || [])[1] || null;
  const vWp = (a.generador || "").match(/WordPress\s+([\d.]+)/i);
  a.versionWordpress = vWp ? vWp[1] : null;

  // al día y roturas visibles
  const anios = todos(/(?:©|&copy;|&#169;|copyright)\s*(?:(?:19|20)\d{2}\s*[-–—]\s*)?((?:19|20)\d{2})/gi).map(m => +m[1]).filter(n => n <= ANIO);
  a.anioPie = anios.length ? Math.max(...anios) : null;
  a.anioAutomatico = /getFullYear\(\)/.test(html);
  a.flash = /\.swf\b|shockwave-flash/i.test(html);
  a.enConstruccion = palabras.length < 200 && /(en construcci[oó]n|coming soon|under construction|sitio en mantenimiento|domain (?:is )?for sale|dominio (?:est[aá] )?en venta|sedoparking|parkingcrew|bodis\.com|Index of \/|Default Page|Welcome to nginx|Future home of|p[aá]gina (?:por defecto|predeterminada)|cPanel)/i.test(texto + " " + (a.titulo || ""));
  a.tiendaCerrada = palabras.length < 400 && /(tienda (?:est[aá] )?(?:temporalmente )?(?:cerrada|en mantenimiento|no disponible)|tienda fue (?:moment[aá]neamente )?suspendida|store is (?:currently )?(?:unavailable|closed)|enter (?:store )?using password|password protected|opening soon|estamos en mantenimiento)/i.test(texto + " " + (a.titulo || ""));
  a.errorTecnico = /<b>\s*(?:Fatal error|Parse error|Warning|Deprecated|Notice)\s*<\/b>\s*:|Error establishing a database connection|Uncaught (?:Exception|Error)/i.test(html);
  // "$0" en productos; no cuenta el del carrito vacío, el subtotal, el envío ni el monto mínimo
  a.preciosCero = [...texto.matchAll(/\$\s?0(?:[.,]00)?(?![\d.,])/g)]
    .filter(m => !/((sub)?total[^$\d]{0,30}|m[ií]nimo[^$\d]{0,40}|carrito[^$\d]{0,40}|env[ií]o[^$\d]{0,20}|productos?\)?\s*:?\s*)$/i.test(texto.slice(Math.max(0, m.index - 60), m.index))).length;

  // datos para Google
  a.tiposJsonLd = [...new Set(todos(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)
    .flatMap(m => [...m[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(x => x[1])))];

  // imágenes y contenido mixto
  const imgs = todos(/<img\b[^>]*>/gi).map(m => m[0]);
  a.imagenes = imgs.length;
  a.imagenesSinAlt = imgs.filter(t => !/\salt=["'][^"']+["']/i.test(t)).length;
  a.urlsImagenes = [...new Set(imgs.map(t => (t.match(/\ssrc=["']([^"']+)["']/i) || [])[1]).filter(s => s && !s.startsWith("data:"))
    .map(s => { try { return new URL(s, base).href; } catch { return null; } }).filter(Boolean))];
  a.contenidoMixto = base.protocol === "https:" ? todos(/(?:src|href)=["']http:\/\/[^"']+\.(?:js|css|png|jpe?g|gif|webp|svg)["']/gi).length : 0;

  // redes y links internos
  const hrefs = todos(/href=["']([^"'#\s]+)["']/gi).map(m => decodificar(m[1]));
  a.instagram = [...new Set(hrefs.map(h => (h.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i) || [])[1]).filter(h => h && !["p", "reel", "explore", "stories"].includes(h.toLowerCase())))];
  a.facebook = [...new Set(hrefs.map(h => (h.match(/facebook\.com\/([A-Za-z0-9_.-]{2,60})/i) || [])[1]).filter(h => h && !["sharer", "sharer.php", "tr", "plugins", "dialog"].includes(h.toLowerCase())))];
  a.linksInternos = [...new Set(hrefs.filter(h => !/^(mailto|tel|javascript|whatsapp|data):/i.test(h))
    .map(h => { try { return new URL(h, base); } catch { return null; } })
    .filter(u => u && u.hostname === base.hostname && !/\.(css|js|png|jpe?g|gif|webp|svg|ico|pdf|xml|json|woff2?)$/i.test(u.pathname))
    .map(u => u.origin + u.pathname))].filter(u => u !== base.origin + base.pathname).slice(0, 30);
  return a;
}

// ---------------------------------------------------------------- lo que corta ventas
// Un WhatsApp mal escrito es de los errores más caros: el cliente toca, no abre y se va.
// Celular argentino: 54 + 9 + área sin 0 + número sin 15 = 13 dígitos. Un fijo con WhatsApp
// Business va sin el 9 (12 dígitos): ese no se da por malo, se marca para probarlo a mano.
function revisarWhatsapp(numeros) {
  const mal = [], revisar = [];
  for (const n of numeros) {
    if (!n.startsWith("54")) {
      if (/^(0|15)/.test(n) || (n.startsWith("11") && n.length === 10)) mal.push(`${n}: sin el 54 de Argentina, WhatsApp lo toma como un número de otro país`);
    } else if (n.startsWith("540")) mal.push(`${n}: tiene el 0 del código de área`);
    else if (n.length >= 14) mal.push(`${n}: sobran dígitos, probablemente tiene el 15`);
    else if (n.length <= 11) mal.push(`${n}: le faltan dígitos`);
    else if (n.length === 12) revisar.push(`${n}: sin el 9, si es un celular no abre`);
  }
  return { mal, revisar };
}

// ¿El robots.txt le cierra la puerta a Google? Se mira el grupo de Googlebot o, si no hay, el de *.
function robotsBloqueaGoogle(txt) {
  const grupos = [];
  let actual = null, venianAgentes = false;
  for (const linea of txt.split(/\r?\n/)) {
    const l = linea.replace(/#.*/, "").trim();
    const i = l.indexOf(":");
    if (i < 0) continue;
    const clave = l.slice(0, i).trim().toLowerCase(), valor = l.slice(i + 1).trim();
    if (clave === "user-agent") {
      if (!venianAgentes) { actual = { agentes: [], reglas: [] }; grupos.push(actual); }
      actual.agentes.push(valor.toLowerCase());
      venianAgentes = true;
    } else if (actual) {
      venianAgentes = false;
      if (clave === "disallow" || clave === "allow") actual.reglas.push([clave, valor]);
    }
  }
  const g = grupos.find(x => x.agentes.includes("googlebot")) || grupos.find(x => x.agentes.includes("*"));
  return !!g && g.reglas.some(([c, v]) => c === "disallow" && v === "/") && !g.reglas.some(([c, v]) => c === "allow" && v === "/");
}

// Se visita (sin mandar nada) la dirección a la que envía cada formulario.
async function revisarFormularios(acciones) {
  const inexistentes = [], dudosos = [];
  for (const u of acciones) {
    try {
      const { r } = await traer(u, { timeout: 10000, cuerpo: false });
      if ([404, 410].includes(r.status)) dudosos.push(`${u} (${r.status})`);
    } catch (e) {
      const c = e.cause?.code || "";
      if (/ENOTFOUND|EAI_AGAIN/.test(c)) inexistentes.push(`${u} (${c})`);
    }
  }
  return { inexistentes, dudosos };
}

// ---------------------------------------------------------------- lighthouse
function correrLighthouse(url, carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  const json = path.join(carpeta, "lighthouse-tmp.json");
  const cmd = `npx -y lighthouse "${url}" --quiet --output=json --output-path="${json}" --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new"`;
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: 300000 });
  if (!fs.existsSync(json)) return { error: ((r.stderr || "") + (r.error?.message || "")).trim().slice(-400) || "Lighthouse no generó resultado" };
  const j = JSON.parse(fs.readFileSync(json, "utf8"));
  fs.unlinkSync(json);
  const cat = k => j.categories[k] ? Math.round(j.categories[k].score * 100) : null;
  const au = k => j.audits[k] || {};
  const out = {
    version: j.lighthouseVersion, rendimiento: cat("performance"), accesibilidad: cat("accessibility"),
    buenasPracticas: cat("best-practices"), seo: cat("seo"),
    lcpMs: au("largest-contentful-paint").numericValue ?? null, fcpMs: au("first-contentful-paint").numericValue ?? null,
    pesoBytes: au("total-byte-weight").numericValue ?? null, textoLegible: au("font-size").score ?? null,
  };
  const cap = au("final-screenshot").details?.data;
  if (cap) {
    fs.mkdirSync(path.join(carpeta, "assets"), { recursive: true });
    out.captura = path.join(carpeta, "assets", "captura-celular.jpg");
    fs.writeFileSync(out.captura, Buffer.from(cap.split(",")[1], "base64"));
  }
  return out;
}

// ---------------------------------------------------------------- diagnóstico
async function diagnosticar(entrada, rapido) {
  const d = { entrada, relevado: HOY.toISOString(), hallazgos: [] };
  const add = (area, nivel, titulo, detalle = "") => d.hallazgos.push({ area, nivel, titulo, detalle });
  const cerrar = () => {
    const n = k => d.hallazgos.filter(h => h.nivel === k).length;
    d.cuenta = { urgente: n("urgente"), mejorable: n("mejorable"), bien: n("bien") };
    d.hueco = d.cuenta.urgente ? 3 : d.cuenta.mejorable >= 4 ? 2 : d.cuenta.mejorable ? 1 : 0;
    return d;
  };

  try { Object.assign(d, normalizar(entrada)); }
  catch { add("Web", "urgente", "No es un dominio ni una dirección válida", entrada); return cerrar(); }

  // 1. Dominio
  const plataforma = PLATAFORMAS.find(p => d.host === p || d.host.endsWith("." + p));
  if (plataforma === "business.site") {
    add("Dominio", "urgente", "La web es de business.site, el servicio que Google dio de baja en 2024", "Todo link a esa dirección está muerto.");
  } else if (plataforma) {
    add("Dominio", "mejorable", `No tiene dominio propio: la web vive en ${d.host}`, "Se ve provisoria y la dirección no es de la empresa.");
  } else {
    d.registro = await rdap(d.dominio);
    if (d.registro.registrado === false) {
      add("Dominio", "urgente", `El dominio ${d.dominio} no está registrado`, "Cualquiera lo puede comprar, incluso un competidor. Todo link a esa dirección lleva a la nada.");
      return cerrar();
    }
    if (d.registro.vence) {
      const n = dias(d.registro.vence);
      if (n < 0) {
        // NIC Argentina: 45 días de gracia; los primeros 30 el dominio sigue funcionando, los últimos 15 no.
        const mas = k => fecha(new Date(new Date(d.registro.vence).getTime() + k * 864e5).toISOString());
        const gracia = d.dominio.endsWith(".ar") ? ` Según NIC Argentina hay 45 días de gracia: la web y los mails siguen andando hasta el ${mas(30)}, y el ${mas(45)} se pierde la titularidad.` : "";
        add("Dominio", "urgente", `El dominio venció hace ${-n} días`, `Venció el ${fecha(d.registro.vence)}.${gracia}`);
      }
      else if (n <= 30) add("Dominio", "mejorable", `El dominio vence en ${n} días`, `El ${fecha(d.registro.vence)}. Confirmar que se renueve: si no, dejan de andar la web y los mails.`);
      else add("Dominio", "bien", `Dominio propio${d.registro.alta ? ", registrado en " + d.registro.alta.slice(0, 4) : ""}`, `Vence el ${fecha(d.registro.vence)}.`);
    } else if (d.registro.error) {
      add("Dominio", "info", "No se pudo consultar el registro del dominio", d.registro.error);
    }
  }

  // 2. ¿Apunta a algún lado?
  if (!(await resolver(d.host)).length) {
    const alt = d.host.startsWith("www.") ? d.host.slice(4) : "www." + d.host;
    if ((await resolver(alt)).length) {
      add("Web", "mejorable", `${d.host} no existe, pero ${alt} sí`, "Quien escriba la dirección de la otra forma no llega a la web.");
      d.host = alt; d.url = `https://${alt}/`;
    } else {
      add("Web", "urgente", "El dominio existe pero no hay ninguna web detrás", "Quien escribe la dirección no ve nada." + (rapido ? "" : await pistasDeCaida(d.host)));
      return cerrar();
    }
  }

  // 3. Carga y candado
  let pag;
  try {
    pag = await traer(d.url);
  } catch (e) {
    d.errorHttps = e.cause?.code || e.name || e.message;
    try {
      pag = await traer(d.url.replace(/^https:/, "http:"));
      if (/CERT|SSL|TLS|ALTNAME|SELF_SIGNED|VERIFY/i.test(d.errorHttps)) add("Seguridad", "urgente", "El certificado de seguridad está roto", `El navegador avisa "No seguro" o muestra una alerta antes de entrar (${d.errorHttps}).`);
      else add("Seguridad", "urgente", "La web no tiene candado (HTTPS)", `Chrome la marca como "No segura" (${d.errorHttps}).`);
    } catch (e2) {
      add("Web", "urgente", "La web no carga", `${d.errorHttps} / ${e2.cause?.code || e2.message}.` + (rapido ? "" : await pistasDeCaida(d.host)));
      return cerrar();
    }
  }
  d.urlFinal = pag.r.url; d.estado = pag.r.status; d.msRespuesta = pag.msCabeceras; d.msCarga = pag.ms;
  const final = new URL(d.urlFinal);

  if (REDES.test(final.hostname)) {
    add("Web", "mejorable", `No hay web: el dominio redirige a ${final.hostname}`, "La empresa depende de una red social para que la encuentren.");
    return cerrar();
  }
  const bloqueo = [403, 429, 503].includes(pag.r.status) && (pag.r.headers.get("cf-ray") || /just a moment|attention required|captcha/i.test(pag.texto));
  if (bloqueo) {
    add("Web", "info", "La web bloquea lecturas automáticas", "Revisarla a mano en el navegador.");
    return cerrar();
  }
  if (pag.r.status >= 400) {
    add("Web", "urgente", `La web devuelve un error (${pag.r.status})`, "Quien entra ve una página de error.");
    return cerrar();
  }
  if (!d.errorHttps && final.protocol === "http:") add("Seguridad", "urgente", "La web termina en una dirección sin candado", `Redirige a ${d.urlFinal}.`);
  else if (!d.errorHttps) add("Seguridad", "bien", "Tiene candado (HTTPS) con certificado válido");

  if (!rapido && !d.errorHttps) {
    try {
      const r = await fetch(`http://${final.hostname}/`, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "user-agent": UA } });
      if (r.status < 300) add("Seguridad", "mejorable", "La versión sin candado (http://) sigue abierta", "Quien entra por un link viejo navega sin HTTPS.");
    } catch {}
    d.certificado = await certificado(final.hostname);
    if (d.certificado.vence && dias(d.certificado.vence) <= 7) add("Seguridad", "urgente", `El certificado vence en ${dias(d.certificado.vence)} días`, "Si no se renueva, el navegador va a bloquear la entrada.");
  }

  if (d.msRespuesta > 1500) add("Velocidad", "mejorable", `El servidor tarda ${seg(d.msRespuesta)} en empezar a responder`, "Medido desde una conexión fija; en un celular con datos es peor.");

  // 4. Contenido
  const a = analizarHtml(pag.texto, d.urlFinal);
  d.html = a;
  if (a.enConstruccion) {
    add("Web", "urgente", "La web está \"en construcción\" o es una página por defecto", `Lo único que dice: "${a.textoInicial.slice(0, 120)}"`);
    return cerrar();
  }
  if (a.tiendaCerrada) add("Web", "urgente", "La tienda online está cerrada o en mantenimiento", `Lo que se ve: "${a.textoInicial.slice(0, 140)}"`);
  if (a.errorTecnico) add("Web", "urgente", "La página muestra un mensaje de error técnico", "Se ve un error de programación en la portada: da imagen de abandono.");
  if (a.flash) add("Web", "urgente", "Usa Flash", "Ningún navegador lo muestra desde 2021: hay partes de la web que no se ven.");

  if (!a.viewport) add("Celular", "urgente", "No está adaptada al celular", "En el teléfono se ve la versión de computadora en miniatura: hay que hacer zoom para leer y tocar.");
  else add("Celular", "bien", "Está preparada para verse en celular", "Falta ver cómo queda de verdad (--lighthouse).");

  // WhatsApp, teléfono y formulario: por donde entran las consultas
  const wa = revisarWhatsapp(a.whatsapp);
  if (a.whatsappSinNumero) add("Contacto", "urgente", "Un botón de WhatsApp no tiene número", "Al tocarlo no se abre ningún chat.");
  if (wa.mal.length) add("Contacto", "urgente", "El número del botón de WhatsApp está mal escrito", `${wa.mal.join(" · ")}. Al tocarlo, no se abre el chat con la empresa.`);
  if (wa.revisar.length) add("Contacto", "mejorable", "Probar a mano el botón de WhatsApp", `${wa.revisar.join(" · ")}. Tocarlo desde un celular.`);
  if (a.whatsapp.length && !wa.mal.length) add("Contacto", "bien", `Tiene botón de WhatsApp${a.whatsappConMensaje ? " con el mensaje ya escrito" : ""}`, `Número: ${a.whatsapp.join(", ")}`);
  else if (!a.whatsapp.length && !a.whatsappSinNumero) add("Contacto", "mejorable", "No hay botón de WhatsApp", "Para escribir hay que copiar el número a mano.");
  if (!a.telefonos.length && a.telefonoEnTexto) add("Contacto", "mejorable", "El teléfono está escrito pero no se puede tocar para llamar");
  if (!a.formularios) add("Contacto", "info", "No tiene formulario de contacto");
  if (a.formularioMailto) add("Contacto", "mejorable", "El formulario abre el programa de mail en vez de enviar el mensaje", "En muchos celulares, al tocar Enviar no pasa nada.");
  // En Tiendanube, Shopify, WooCommerce o Wix los formularios propios los maneja la plataforma
  // (algunos son trampas para bots que dan 404 a propósito): solo se revisan los que van a otro dominio.
  const acciones = /Tiendanube|Shopify|WooCommerce|Wix|Squarespace/.test(a.plataforma || "")
    ? a.accionesFormulario.filter(u => new URL(u).hostname !== final.hostname) : a.accionesFormulario;
  const forms = await revisarFormularios(acciones);
  if (forms.inexistentes.length) add("Contacto", "urgente", "El formulario envía los mensajes a una dirección que no existe", `${forms.inexistentes.join(" · ")}. Los mensajes no pueden llegarle a nadie.`);
  if (forms.dudosos.length) add("Contacto", "mejorable", "Revisar el formulario: la dirección a la que envía responde 404", `${forms.dudosos.join(" · ")}. Puede estar roto; confirmarlo antes de afirmarlo.`);
  const mailsGratis = a.mails.filter(m => /@(gmail|hotmail|yahoo|outlook|live)\./.test(m));
  if (mailsGratis.length) add("Confianza", "mejorable", `Atiende con un mail gratuito (${mailsGratis[0]})`, "Un mail con el nombre de la empresa da más confianza y no depende de una cuenta personal.");

  // Google: ¿la puede mostrar?
  const xRobots = pag.r.headers.get("x-robots-tag") || "";
  if (/noindex/i.test(a.robotsMeta || "") || /noindex/i.test(xRobots)) add("Google", "urgente", "La web le pide a Google que no la muestre", "Tiene la instrucción \"noindex\": Google la saca de los resultados. Suele quedar olvidada de cuando se estaba armando.");
  if (a.canonical) {
    try {
      const hc = new URL(a.canonical, d.urlFinal).hostname.replace(/^www\./, "");
      if (hc !== final.hostname.replace(/^www\./, "")) add("Google", "urgente", "Le dice a Google que la web verdadera está en otra dirección", `La etiqueta "canonical" apunta a ${a.canonical}: Google puede mostrar esa otra dirección, o ninguna.`);
    } catch {}
  }
  try {
    const { r, texto } = await traer(`${final.origin}/robots.txt`, { timeout: 10000 });
    if (r.ok && /user-agent/i.test(texto)) {
      d.robots = true;
      d.sitemap = (texto.match(/sitemap:\s*(\S+)/i) || [])[1] || null;
      if (robotsBloqueaGoogle(texto)) add("Google", "urgente", "El robots.txt le prohíbe a Google entrar a la web", "Con esa regla, Google no puede leer ninguna página y la web no aparece en las búsquedas.");
    }
  } catch {}

  if (!a.titulo) add("Google", "urgente", "La página no tiene título", "Google no sabe cómo nombrarla en los resultados.");
  else if (a.titulo.length < 15 || /^(inicio|home|index|mi sitio|p[aá]gina de inicio|untitled|just another wordpress site)\b/i.test(a.titulo)) add("Google", "mejorable", `El título que muestra Google es "${a.titulo}"`, "No dice qué hace la empresa ni dónde.");
  else add("Google", "bien", `Título: "${a.titulo}"`);
  if (!a.descripcion) add("Google", "mejorable", "No tiene descripción para Google", "Google arma solo el texto que aparece debajo del nombre.");
  if (!a.h1) add("Google", "mejorable", "La página no tiene un título principal (h1)");
  if (!a.ogImagen) add("Google", "mejorable", "Al compartir el link por WhatsApp no aparece ninguna imagen", "El link se ve pelado y se abre menos.");
  if (!a.tiposJsonLd.some(t => /LocalBusiness|Organization|Store|AutoPartsStore|ProfessionalService/i.test(t))) add("Google", "info", "Sin datos estructurados de empresa (JSON-LD)");

  if (a.preciosCero && /Tiendanube|Shopify|WooCommerce|Empretienda|Mercado Shops/.test(a.plataforma || "")) add("Web", "mejorable", `${a.preciosCero} producto(s) de la portada muestran precio $0`, "Suele ser un producto sin precio o sin stock que quedó en destacados. Confirmarlo en el navegador.");
  if (a.anioPie && !a.anioAutomatico && a.anioPie < ANIO - 1) add("Al día", "mejorable", `El pie de la web dice © ${a.anioPie}`, "Da la impresión de que nadie la toca desde entonces.");
  if (a.versionWordpress && parseInt(a.versionWordpress) < 6) add("Al día", "mejorable", `WordPress sin actualizar (versión ${a.versionWordpress})`, "Las versiones viejas son la puerta de entrada más común de los hackeos.");

  const soloUA = a.analitica.length === 1 && a.analitica[0].startsWith("Universal");
  if (!a.analitica.length || soloUA) add("Medición", "mejorable", soloUA ? "Mide visitas con Universal Analytics, que Google apagó en 2024" : "No mide visitas", "No hay forma de saber cuánta gente entra ni de dónde viene.");
  else add("Medición", "bien", `Mide visitas (${a.analitica.join(", ")})`);

  if (a.contenidoMixto) add("Seguridad", "mejorable", `Carga ${a.contenidoMixto} archivo(s) sin candado`, "Algunos navegadores los bloquean o muestran el aviso de 'No seguro'.");
  if (a.imagenes >= 5 && a.imagenesSinAlt / a.imagenes > 0.5) add("Google", "info", `${a.imagenesSinAlt} de ${a.imagenes} imágenes sin texto alternativo`);

  if (!rapido) {
    // imágenes pesadas o rotas
    const imgs = await enTandas(a.urlsImagenes.slice(0, 20), 6, async u => {
      try {
        let { r } = await traer(u, { metodo: "HEAD", timeout: 10000 });
        if ([403, 405, 501].includes(r.status)) ({ r } = await traer(u, { timeout: 10000, cuerpo: false }));
        return { u, b: +(r.headers.get("content-length") || 0), s: r.status };
      } catch (e) { return { u, b: 0, s: e.cause?.code || "error" }; }
    });
    const rotas = imgs.filter(x => typeof x.s !== "number" || x.s >= 400);
    if (rotas.length) add("Web", "mejorable", `${rotas.length} imagen(es) de la portada no cargan`, "Se ven recuadros vacíos. " + rotas.slice(0, 3).map(x => `${x.u.split("/").pop()} (${x.s})`).join(" · "));
    const pesadas = imgs.filter(x => x.b > 500 * 1024).sort((x, y) => y.b - x.b);
    d.imagenesPesadas = pesadas;
    if (pesadas.length) add("Velocidad", "mejorable", `${pesadas.length} imagen(es) de más de 500 KB`, `La más pesada: ${kb(pesadas[0].b)} (${pesadas[0].u.split("/").pop()}).`);

    // links internos rotos
    const estados = await enTandas(a.linksInternos, 6, async u => {
      try {
        let { r } = await traer(u, { metodo: "HEAD", timeout: 12000 });
        if ([403, 405, 501].includes(r.status)) ({ r } = await traer(u, { timeout: 12000, cuerpo: false }));
        return { u, s: r.status };
      } catch (e) { return { u, s: e.cause?.code || "error" }; }
    });
    const rotos = estados.filter(x => typeof x.s !== "number" || x.s >= 400);
    d.linksRotos = rotos;
    if (rotos.length) add("Web", "mejorable", `${rotos.length} link(s) de la web llevan a páginas que no existen`, rotos.slice(0, 4).map(x => `${x.u} (${x.s})`).join(" · "));
    else if (estados.length) add("Web", "bien", `Los ${estados.length} links internos revisados funcionan`);

    // sitemap
    if (!d.sitemap) for (const s of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
      try { const x = await traer(final.origin + s, { timeout: 10000 }); if (x.r.ok && /<(urlset|sitemapindex)/i.test(x.texto)) { d.sitemap = final.origin + s; break; } } catch {}
    }
    if (!d.sitemap) add("Google", "info", "No tiene sitemap.xml");

    // mail con dominio propio
    try { d.mx = (await dns.resolveMx(d.dominio)).map(m => m.exchange.toLowerCase()); } catch { d.mx = []; }

    // lighthouse
    if (opc.lighthouse) {
      const carpeta = opc.salida || process.cwd();
      d.lighthouse = correrLighthouse(d.urlFinal, carpeta);
      const lh = d.lighthouse;
      if (!lh.error && lh.lcpMs != null) {
        const txt = `Según Lighthouse (la herramienta de Google), en un celular con 4G tarda ${seg(lh.lcpMs)} en mostrar lo principal. Puntaje de velocidad: ${lh.rendimiento}/100.`;
        if (lh.lcpMs > 4000) add("Velocidad", "urgente", `En celular tarda ${seg(lh.lcpMs)} en mostrar lo principal`, txt);
        else if (lh.lcpMs > 2500) add("Velocidad", "mejorable", `En celular tarda ${seg(lh.lcpMs)} en mostrar lo principal`, txt);
        else add("Velocidad", "bien", `Carga rápido en celular (${seg(lh.lcpMs)})`, txt);
        if (lh.textoLegible === 0) add("Celular", "mejorable", "En celular hay textos demasiado chicos para leer sin zoom");
      }
    }
  }
  return cerrar();
}

// ---------------------------------------------------------------- salida
function informe(d) {
  const icono = { urgente: "❌", mejorable: "⚠️", bien: "✅", info: "ℹ️" };
  const titulo = { urgente: "Urgente", mejorable: "Mejorable", bien: "Bien", info: "Para saber" };
  let s = `# Diagnóstico automático — ${d.host || d.entrada}\n\n`;
  s += `Relevado: ${HOY.toLocaleString("es-AR")} · URL final: ${d.urlFinal || "—"}`;
  if (d.html?.plataforma) s += ` · Hecha con: ${d.html.plataforma}${d.html.versionWordpress ? " " + d.html.versionWordpress : ""}`;
  s += `\n\n**${d.cuenta.urgente} urgentes · ${d.cuenta.mejorable} mejorables · ${d.cuenta.bien} bien** · Hueco: ${d.hueco}/3\n\n`;
  for (const nivel of ["urgente", "mejorable", "bien", "info"]) {
    const hs = d.hallazgos.filter(h => h.nivel === nivel);
    if (!hs.length) continue;
    s += `## ${icono[nivel]} ${titulo[nivel]}\n\n`;
    for (const h of hs) s += `- **[${h.area}] ${h.titulo}**${h.detalle ? " — " + h.detalle : ""}\n`;
    s += "\n";
  }
  if (d.html) {
    s += `## Datos sueltos\n\n`;
    if (d.html.textoInicial) s += `- **Lo primero que dice:** "${d.html.textoInicial}…"\n`;
    if (d.html.descripcion) s += `- **Descripción para Google:** "${d.html.descripcion}"\n`;
    if (d.html.instagram.length) s += `- **Instagram linkeado:** ${d.html.instagram.map(h => "@" + h).join(", ")}\n`;
    if (d.html.facebook.length) s += `- **Facebook linkeado:** ${d.html.facebook.join(", ")}\n`;
    if (d.html.mails.length) s += `- **Mails publicados:** ${d.html.mails.join(", ")}\n`;
    if (d.html.telefonos.length) s += `- **Teléfonos tocables:** ${d.html.telefonos.join(", ")}\n`;
    if (d.html.accionesFormulario.length) s += `- **Los formularios envían a:** ${d.html.accionesFormulario.join(", ")}\n`;
    if (d.mx) s += `- **Mail con dominio propio:** ${d.mx.length ? "sí (" + d.mx[0] + ")" : "no hay servidor de correo en el dominio"}\n`;
    if (d.registro?.registrador) s += `- **Registrador del dominio:** ${d.registro.registrador}\n`;
    s += "\n";
  }
  if (d.lighthouse && !d.lighthouse.error) {
    const l = d.lighthouse;
    s += `## Lighthouse (celular)\n\nVelocidad ${l.rendimiento} · Accesibilidad ${l.accesibilidad} · Buenas prácticas ${l.buenasPracticas} · SEO ${l.seo}`;
    s += ` · Contenido principal en ${seg(l.lcpMs)} · Peso total ${kb(l.pesoBytes)}\n\n`;
    if (l.captura) s += `Captura en celular: \`${l.captura}\`\n\n`;
  } else if (d.lighthouse?.error) {
    s += `## Lighthouse\n\nNo corrió: ${d.lighthouse.error}\nAlternativa: abrir https://pagespeed.web.dev/analysis?url=${encodeURIComponent(d.urlFinal)} en el navegador.\n\n`;
  }
  s += `## Falta mirar a mano\n\n- Ficha de Google, Instagram y reseñas → skill \`diagnostico-digital\`\n`;
  if (!opc.lighthouse) s += `- Cómo se ve y cuánto tarda en un celular → correr de nuevo con \`--lighthouse --salida <carpeta>\`\n`;
  return s;
}

function fila(d) {
  const clave = d.hallazgos.filter(h => h.nivel === "urgente").concat(d.hallazgos.filter(h => h.nivel === "mejorable"))
    .slice(0, 3).map(h => h.titulo).join(" · ") || "sin problemas visibles";
  return `| ${d.host || d.entrada} | ${d.hueco}/3 | ${d.html?.plataforma || "—"} | ${clave.replace(/\|/g, "/")} |`;
}

(async () => {
  if (opc.rapido) {
    console.log("| Dominio | Hueco | Hecha con | Lo principal |\n|---|---|---|---|");
    const res = await enTandas(objetivos, 4, o => diagnosticar(o, true));
    res.forEach(d => console.log(fila(d)));
    return;
  }
  for (const o of objetivos) {
    const d = await diagnosticar(o, false);
    const md = informe(d);
    console.log(md);
    if (opc.salida) {
      fs.mkdirSync(opc.salida, { recursive: true });
      fs.writeFileSync(path.join(opc.salida, "diagnostico-auto.md"), md);
      fs.writeFileSync(path.join(opc.salida, "diagnostico-auto.json"), JSON.stringify(d, null, 2));
    }
  }
})();
