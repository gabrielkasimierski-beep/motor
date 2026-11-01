// Errores de la Graph API traducidos a castellano, y cuáles se pueden reintentar.
// Fuentes: developers.facebook.com/docs/graph-api/guides/error-handling y
// developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/error-codes
import { sanear } from "./entorno.mjs";

const QUE_PASO = {
  // La tabla de errores de Instagram usa -1 y -2 (no 1 y 2) para los del servidor y las descargas.
  [-1]: "error del servidor de Instagram (suele ser pasajero)",
  [-2]: "Instagram no pudo terminar de bajar o procesar el archivo",
  1: "error desconocido de Meta (suele ser pasajero)",
  2: "el servicio de Meta no está disponible por un momento",
  4: "la app hizo demasiadas llamadas seguidas",
  9: "se alcanzó un límite de publicación",
  10: "falta un permiso (la app o el token no lo tiene)",
  17: "la cuenta hizo demasiadas llamadas seguidas",
  24: "Meta no encuentra el contenedor o el medio",
  25: "la cuenta de Instagram está restringida",
  32: "la página hizo demasiadas llamadas seguidas",
  100: "algún dato del pedido es inválido",
  102: "la sesión del token no sirve",
  190: "el token de Meta no sirve",
  200: "falta un permiso para esta acción",
  324: "falta el archivo de la imagen o no es válido",
  341: "la app llegó a su límite de llamadas",
  352: "el formato del video no está soportado",
  368: "Meta bloqueó la acción por un rato (políticas)",
  506: "publicación duplicada: Meta ya tiene un posteo igual",
  613: "demasiadas llamadas en poco tiempo",
  9004: "Meta no pudo bajar el archivo desde la URL",
  9007: "el medio todavía no está listo para publicar",
  36000: "la imagen es demasiado pesada",
  36001: "el formato de la imagen no está soportado",
  36003: "la proporción de la imagen no se puede publicar",
  36004: "el texto es demasiado largo",
};

const DETALLE = {
  458: "la app no está autorizada para ese usuario",
  459: "el usuario tiene que entrar a facebook.com a resolver un aviso",
  460: "se cerró la sesión o cambió la contraseña de la cuenta, y el token quedó inválido",
  463: "el token venció",
  464: "el usuario tiene que confirmar su cuenta en facebook.com",
  467: "el token es inválido (revocado o mal copiado)",
  492: "el dueño del token no tiene rol en la página",
  2207001: "error del servidor de Instagram",
  2207003: "Instagram tardó demasiado en bajar el archivo",
  2207004: "la imagen pesa más de 8 MB",
  2207005: "formato de imagen no soportado (Instagram solo acepta JPEG)",
  2207006: "no encuentra el medio: puede faltar un permiso o el token venció",
  2207008: "el contenedor no existe o venció",
  2207009: "la proporción no se puede publicar (tiene que estar entre 4:5 y 1.91:1)",
  2207010: "el texto pasa el máximo (2200 caracteres, 30 hashtags, 20 menciones)",
  2207020: "el contenedor venció (pasaron más de 24 h)",
  2207023: "Instagram no conoce ese tipo de medio",
  2207026: "formato de video no soportado (MOV o MP4)",
  2207027: "el medio todavía no está listo para publicar",
  2207028: "un carrusel lleva entre 2 y 10 láminas",
  2207032: "no se pudo crear el contenedor",
  2207040: "el texto tiene más de 20 menciones (@)",
  2207042: "se llegó al máximo de publicaciones por API de las últimas 24 h",
  2207050: "la cuenta de Instagram está restringida",
  2207051: "Instagram frenó la acción por sospecha de spam",
  2207052: "Instagram no pudo bajar el archivo desde la URL",
  2207053: "error desconocido de subida",
  2207057: "la portada elegida cae fuera de la duración del video",
};

// 368 no va acá: es un bloqueo por políticas y reintentar enseguida es justo lo que no conviene.
const LIMITE = new Set([4, 17, 32, 341, 613]);
const PASAJERO = new Set([1, 2, -1]);
const SUB_PASAJERO = new Set([2207001, 2207003, 2207032]);
const SUB_NO_REINTENTAR = new Set([2207051]); // code 4 + spam: no es un límite de llamadas

// Lo que hay que hacer cuando INSTAGRAM_TOKEN no sirve (inicio de sesión de Instagram).
export const TOKEN_IG_NO_SIRVE = 'revisá que el token esté entero en la línea INSTAGRAM_TOKEN= de maquina-de-contenido/.env; si está bien, generá uno nuevo en el panel de la app (README.md), pegalo en esa línea y corré: node herramientas/meta.mjs verificar';

function queHacer(code, subcode, { http, mensaje = "", donde = "" } = {}) {
  if (code === 190 || code === 102 || [458, 460, 463, 467].includes(subcode))
    return "generá un token nuevo (README.md), pegalo en maquina-de-contenido/.env y corré: node herramientas/meta.mjs verificar";
  if (subcode === 459 || subcode === 464) return "entrá a facebook.com con la cuenta dueña del token y resolvé el aviso";
  if (subcode === 492) return "asignale la página al usuario del sistema (o a tu usuario) con permiso para publicar contenido";
  // La doc de Instagram: con un rol dado por el portfolio comercial hace falta ads_management o ads_read.
  // Si Meta nombra ads_management, puede que el token ya tenga ads_read: lo que pide es el otro.
  if (/ads_management/i.test(mensaje)) return "Meta pide ads_management (la página está asignada desde el portfolio comercial): si el token ya tiene ads_read, generalo de nuevo sumando ads_management; si no, con ads_read o ads_management (README.md). Mirá cuál tiene con: node herramientas/meta.mjs verificar";
  if (/ads_read/i.test(mensaje)) return "al token le falta ads_read (o ads_management): la página está asignada desde el portfolio comercial. Generá el token de nuevo con ese permiso (README.md)";
  if (code === 10 || (code >= 200 && code <= 299)) return "revisá los permisos del token: node herramientas/meta.mjs verificar";
  if (code === 368) return "no insistas: Meta frenó la acción por sus políticas; esperá unas horas antes de volver a probar y revisá los avisos de la página o la cuenta";
  if (code === 9 || subcode === 2207042) return "el cupo se libera a medida que pasan 24 h desde las publicaciones anteriores: probá más tarde";
  if (subcode === 2207050) return "entrá a la app de Instagram con la cuenta de proyecto y completá lo que pida";
  if (subcode === 2207051) return "no insistas: esperá y, si es un error, avisale a Instagram desde la app";
  if (code === 9004 || subcode === 2207052) return "abrí la URL en una ventana privada: tiene que mostrar la imagen sola (200, image/jpeg)";
  if (subcode === 2207004 || code === 36000) return "achicá la imagen (menos de 8 MB)";
  if (subcode === 2207009 || code === 36003) return "usá una imagen entre 4:5 y 1.91:1 (historias: 9:16)";
  if (subcode === 2207026 || code === 352) return "exportá el video en MP4 (H.264 + AAC)";
  // La doc: 2207008 suele ser pasajero; reintentar 1 o 2 veces en 30 s a 2 min y recién después un contenedor nuevo.
  if (subcode === 2207008) return "esperá entre 30 segundos y 2 minutos y volvé a correr el comando; si sigue, se crea un contenedor nuevo solo";
  if ([2207020, 2207053].includes(subcode)) return "volvé a correr el comando: se crea un contenedor nuevo";
  if (subcode === 2207010 || code === 36004 || subcode === 2207040) return "acortá el texto (Instagram: hasta 2200 caracteres, 30 hashtags y 20 menciones)";
  if (subcode === 2207028) return "el carrusel tiene que tener entre 2 y 10 láminas";
  if (code === 506) return "Meta ya tiene ese mismo posteo: no lo repitas";
  if (LIMITE.has(code)) return "esperá un rato y probá de nuevo";
  if (PASAJERO.has(code) || code === -2 || SUB_PASAJERO.has(subcode)) return "probá de nuevo en unos minutos";
  // En la renovación del token no hay "pieza": Meta no dejó renovarlo (por ejemplo, tiene menos de 24 h).
  if (code === 100 && /refresh_access_token/.test(donde)) return 'Meta no dejó renovar el token (pide que tenga al menos 24 h y el permiso instagram_business_basic): probá mañana con node herramientas/meta.mjs renovar; si sigue igual, generá uno nuevo en el panel de la app (README.md)';
  if (code === 100) return "revisá los datos de la pieza (texto, imágenes, fecha)";
  if (http >= 500) return "Meta está con problemas: probá de nuevo en unos minutos";
  return "revisá el mensaje original de Meta";
}

export class ErrorMeta extends Error {
  constructor({ http, error = {}, donde = "" }) {
    const code = Number(error.code) || null;
    const subcode = Number(error.error_subcode) || null;
    const paso = QUE_PASO[code] || (code >= 200 && code <= 299 ? QUE_PASO[200] : !code && http >= 500 ? "Meta no pudo atender el pedido (error de su lado)" : "Meta rechazó el pedido");
    const detalle = DETALLE[subcode];
    super(`${paso}${detalle ? ": " + detalle : ""}`);
    this.name = "ErrorMeta";
    this.http = http;
    this.code = code;
    this.subcode = subcode;
    this.tipo = error.type || null;
    this.original = error.error_user_msg || error.message || null;
    this.fbtrace = error.fbtrace_id || null;
    this.donde = donde;
    this.sugerencia = queHacer(code, subcode, { http, mensaje: String(error.message || ""), donde });
    this.limite = LIMITE.has(code) && !SUB_NO_REINTENTAR.has(subcode);
    this.pasajero =
      !this.limite && !SUB_NO_REINTENTAR.has(subcode) &&
      (PASAJERO.has(code) || SUB_PASAJERO.has(subcode) || error.is_transient === true || (http >= 500 && !code));
    this.ambiguo = false; // lo marca el cliente cuando no se sabe si un pedido de publicar llegó a salir
  }
  explicar() {
    const lineas = [
      `Error de Meta${this.donde ? " en " + this.donde : ""}`,
      `  code ${this.code ?? "?"}${this.subcode ? " · subcode " + this.subcode : ""}${this.http ? " · HTTP " + this.http : ""}`,
      `  Qué pasó: ${this.message}.`,
      `  Qué hacer: ${this.sugerencia}.`,
    ];
    if (this.original) lineas.push(`  Mensaje original de Meta: "${this.original}"${this.fbtrace ? ` (fbtrace_id ${this.fbtrace})` : ""}`);
    return sanear(lineas.join("\n"));
  }
}

// Se cayó la conexión o venció el tiempo: el pedido pudo haber llegado o no.
export class ErrorRed extends Error {
  constructor(donde, causa) {
    super(`no hubo respuesta de Meta${donde ? " en " + donde : ""} (${causa})`);
    this.name = "ErrorRed";
    this.donde = donde;
    this.pasajero = true;
    this.ambiguo = false;
  }
  explicar() {
    return sanear(`Error de conexión: ${this.message}.\n  Qué hacer: revisá internet y probá de nuevo.`);
  }
}

// El campo "status" de un contenedor en ERROR trae un subcódigo (por ejemplo 2207052).
export function detalleDeEstado(status) {
  const n = Number(String(status || "").match(/\b(2207\d{3})\b/)?.[1]);
  return n && DETALLE[n] ? `${DETALLE[n]} (subcode ${n}); qué hacer: ${queHacer(null, n)}` : null;
}

// No se pudo confirmar si algo salió publicado: antes de repetir hay que mirar la cuenta.
export class ErrorDudoso extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorDudoso";
    this.dudoso = true;
  }
}

export function explicarError(e) {
  if (typeof e?.explicar === "function") return e.explicar();
  return sanear(e?.message || String(e));
}
