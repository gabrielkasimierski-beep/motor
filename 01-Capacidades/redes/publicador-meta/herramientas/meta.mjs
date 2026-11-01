// Publicador directo de Meta: publica en el Instagram y el Facebook de proyecto con la API oficial,
// sin Metricool. Por defecto todo es simulación: muestra los pedidos y no manda nada.
//
//   node herramientas/meta.mjs verificar
//   node herramientas/meta.mjs publicar --tanda=<tanda> --id=<pieza> [--red=instagram|facebook|ambas] [opciones]
//   node herramientas/meta.mjs estado
//   node herramientas/meta.mjs renovar
//   node herramientas/meta.mjs resolver --tanda=<tanda> --id=<pieza> --red=instagram|facebook --salio=si|no [--link=<url>]
//
// Dos caminos, según el token que haya en .env:
//   INSTAGRAM_TOKEN   → Instagram con inicio de sesión de Instagram (graph.instagram.com). Es el de ahora.
//   META_ACCESS_TOKEN → Instagram y Facebook por la página (graph.facebook.com). Para cuando esté el portfolio.
// El token vive solo en maquina-de-contenido/.env (ver .env.ejemplo y ../README.md).
import { cargarEntorno, decir, quejarse, sanear, Falla } from "./meta/entorno.mjs";
import { explicarError } from "./meta/errores.mjs";
import { verificar } from "./meta/verificar.mjs";
import { publicar } from "./meta/publicar.mjs";
import { estado } from "./meta/estado.mjs";
import { resolver } from "./meta/resolver.mjs";
import { renovar } from "./meta/token-instagram.mjs";

const AYUDA = `Publicador directo de Meta (Instagram y Facebook de proyecto), sin Metricool.

Hoy: INSTAGRAM_TOKEN en .env → solo Instagram, con inicio de sesión de Instagram (Facebook todavía
no está conectado). Con META_ACCESS_TOKEN (el camino de la página) se suma Facebook.

  node herramientas/meta.mjs verificar
      Con el token de .env: quién es, el tipo de cuenta, el cupo del día y cuánto le queda al token
      (y lo renueva si toca). En el camino de Facebook: la página, el Instagram vinculado y los permisos.

  node herramientas/meta.mjs renovar
      Renueva INSTAGRAM_TOKEN (dura 60 días; Meta pide que tenga al menos 24 h). Guarda el nuevo en .env
      (solo esa línea) y las fechas en registro-meta/token-instagram.json. verificar y publicar --de-verdad
      lo renuevan solos cuando pasó una semana o le quedan menos de 20 días.

  node herramientas/meta.mjs publicar --tanda=<tanda> --id=<pieza> [--red=instagram|facebook|ambas]
      --red                                              con INSTAGRAM_TOKEN es instagram (y no hace falta ponerla)
      [--formato=auto|imagen|carrusel|reel|historia]   auto: lo deduce de publicacion.json / --video / --imagen
      [--video=<archivo.mp4>] [--portada=<archivo.jpg>]  reels (la portada solo en Instagram)
      [--imagen=<archivo.jpg>]                           historia 1080×1920, o una imagen suelta
      [--texto=<archivo.txt>]                            si no, usa el texto de publicacion.json
      [--programar="AAAA-MM-DD HH:MM"]                   solo Facebook, hora de config.json → zonaHoraria (Buenos Aires)
      [--medios=url|facebook]                            de dónde baja Instagram las imágenes (facebook: último recurso;
                                                         no existe con INSTAGRAM_TOKEN)
      [--hecho-con-ia]                                   marca la pieza como hecha con IA (avisa dónde Meta no lo permite)
      [--de-verdad]                                      sin esto NO se manda nada (simulación). Exige la pieza "aprobado"
                                                         en calendario.md y todos los archivos en publicar/<tanda>/<id>/
      [--repetir]                                        permite publicar otra vez algo ya publicado (de a una red)

  node herramientas/meta.mjs estado
      Lo publicado con este comando y el cupo de Instagram del día.

  node herramientas/meta.mjs resolver --tanda=<tanda> --id=<pieza> --red=instagram|facebook --salio=si|no
      [--link=<url>]       con --salio=si: el link de la publicación (lo anota en calendario.md y registro.md)
      [--formato=…]        solo si la pieza quedó abierta en más de un formato
      Cierra un "dudoso" o "en-curso" después de mirar la cuenta. No habla con Meta.

Antes de publicar: dejá los archivos y publicacion.json en publicar/<tanda>/<pieza>/.
El formato del manifiesto y la fila de calendario.md están en README.md.`;

const VALORES = { tanda: "tanda", id: "id", red: "red", formato: "formato", video: "video", portada: "portada", imagen: "imagen", texto: "texto", programar: "programar", medios: "medios", salio: "salio", link: "link" };
const BANDERAS = { "de-verdad": "deVerdad", repetir: "repetir", "hecho-con-ia": "ia" };

function leerArgumentos(argv) {
  const [comando, ...resto] = argv;
  const op = { argv };
  for (const a of resto) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/s);
    if (!m) throw new Falla(`no entiendo "${a}" (las opciones van como --nombre=valor)`, { codigo: 2 });
    const [, nombre, valor] = m;
    if (VALORES[nombre]) {
      if (valor === undefined || valor === "") throw new Falla(`--${nombre} necesita un valor: --${nombre}=…`, { codigo: 2 });
      op[VALORES[nombre]] = valor;
    } else if (BANDERAS[nombre]) {
      if (valor !== undefined) throw new Falla(`--${nombre} va sin valor`, { codigo: 2 });
      op[BANDERAS[nombre]] = true;
    } else {
      // Una opción mal escrita (por ejemplo --de-verdat) no puede pasar callada.
      throw new Falla(`no conozco la opción --${nombre}. Mirá: node herramientas/meta.mjs ayuda`, { codigo: 2 });
    }
  }
  return { comando, op };
}

async function main() {
  const { comando, op } = leerArgumentos(process.argv.slice(2));
  if (!comando || ["ayuda", "--help", "-h", "help"].includes(comando)) { decir(AYUDA); return 0; }
  // Lo que se puede revisar sin leer .env, se revisa antes.
  const COMANDOS = ["verificar", "publicar", "estado", "resolver", "renovar"];
  if (!COMANDOS.includes(comando)) throw new Falla(`no conozco el comando "${comando}". Mirá: node herramientas/meta.mjs ayuda`, { codigo: 2 });
  if (comando === "renovar" && Object.keys(op).some((k) => k !== "argv")) throw new Falla("renovar va sin opciones", { codigo: 2 });
  const entorno = cargarEntorno();
  // publicar los muestra junto con los demás avisos de la pieza.
  if (comando !== "publicar") for (const a of entorno.avisos) decir(`Aviso: ${a}`);
  if (comando === "verificar") return (await verificar(entorno)) ? 0 : 1;
  if (comando === "publicar") { op.argv = process.argv.slice(2); await publicar(op, entorno); return 0; }
  if (comando === "estado") { await estado(entorno); return 0; }
  if (comando === "resolver") { resolver(op, entorno); return 0; }
  if (comando === "renovar") return renovar(entorno);
  throw new Falla(`no conozco el comando "${comando}". Mirá: node herramientas/meta.mjs ayuda`, { codigo: 2 });
}

// Último seguro: nada sale sin pasar por sanear(), ni siquiera un error inesperado.
process.on("uncaughtException", (e) => { quejarse(sanear(e?.stack || e)); process.exit(1); });
process.on("unhandledRejection", (e) => { quejarse(sanear(e?.stack || e)); process.exit(1); });

main().then(
  (codigo) => { process.exitCode = codigo; },
  (e) => {
    if (e instanceof Falla) quejarse(`\nNo: ${e.message}`);
    else quejarse("\n" + explicarError(e));
    process.exitCode = e?.codigo || 1;
  },
);
