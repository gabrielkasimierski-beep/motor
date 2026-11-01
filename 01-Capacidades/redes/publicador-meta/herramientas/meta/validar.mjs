// Las reglas de Meta que se pueden revisar antes de mandar nada (doc de oct-2026):
// IG User media: caption ≤ 2200 caracteres, ≤ 30 hashtags, ≤ 20 menciones; imágenes JPEG ≤ 8 MB,
// proporción entre 4:5 y 1.91:1; historias: 9:16 recomendado; carrusel hasta 10; reels 3 s a 15 min
// y ≤ 300 MB; videos de historia 3 a 60 s y ≤ 100 MB. Page photos: ≤ 4 MB (toda foto que pasa por
// /photos, también la de una historia). Reels de página: 3 a 90 s, 9:16, mínimo 540×960.
const MB = 1048576;

export const LIMITES = {
  caracteres: 2200,
  hashtags: 30,
  menciones: 20,
  igImagen: 8 * MB,
  fbFoto: 4 * MB,
  feedMin: 4 / 5,
  feedMax: 1.91,
  historia: 9 / 16,
  carruselMax: 10,
  reelFbMin: { ancho: 540, alto: 960 },
  videos: {
    instagram: { reel: { min: 3, max: 15 * 60, bytes: 300 * MB }, historia: { min: 3, max: 60, bytes: 100 * MB } },
    facebook: { reel: { min: 3, max: 90 }, historia: { min: 3, max: 60 } },
  },
};
// Para que 1080×1350 (0,8 justo) pase y 1080×1358 (0,795) no: solo el error de redondeo.
const CASI = 1e-9;

export function validarTexto(texto) {
  const caracteres = [...(texto || "")].length;
  const hashtags = (texto || "").match(/#[\p{L}\p{N}_]+/gu)?.length || 0;
  const menciones = (texto || "").match(/(^|[^\p{L}\p{N}_.])@[\p{L}\p{N}_.]+/gu)?.length || 0;
  const errores = [];
  if (caracteres > LIMITES.caracteres) errores.push(`el texto tiene ${caracteres} caracteres (Instagram acepta hasta ${LIMITES.caracteres})`);
  if (hashtags > LIMITES.hashtags) errores.push(`el texto tiene ${hashtags} hashtags (Instagram acepta hasta ${LIMITES.hashtags})`);
  if (menciones > LIMITES.menciones) errores.push(`el texto tiene ${menciones} menciones (Instagram acepta hasta ${LIMITES.menciones})`);
  return { caracteres, hashtags, menciones, errores };
}

const proporcion = (info) => info.ancho / info.alto;
const kb = (n) => `${Math.round(n / 1024)} KB`;

// uso: "feed" o "historia"; redes: las que van a recibir esta imagen;
// porPhotos: la foto se sube a /{page}/photos (Facebook o el atajo --medios=facebook).
export function validarImagen(info, { uso, redes, porPhotos = redes.includes("facebook") }) {
  const errores = [];
  const avisos = [];
  const nombre = info.ruta.split(/[\\/]/).pop();
  if (info.mpo) errores.push(`${nombre} es un JPEG extendido (MPO): Instagram no lo acepta; volvé a exportarlo como JPEG común`);
  const r = proporcion(info);
  if (uso === "historia") {
    // Instagram lo recomienda ("We recommended 9:16") y la guía de historias de página no fija proporción.
    if (Math.abs(r - LIMITES.historia) > 0.01) avisos.push(`${nombre} mide ${info.ancho}×${info.alto}: Meta recomienda 9:16 para historias (1080×1920); va a recortar o dejar bandas`);
  } else if (r < LIMITES.feedMin - CASI || r > LIMITES.feedMax + CASI) {
    errores.push(`${nombre} mide ${info.ancho}×${info.alto}: para el feed la proporción tiene que estar entre 4:5 y 1.91:1`);
  }
  if (redes.includes("instagram")) {
    if (info.bytes > LIMITES.igImagen) errores.push(`${nombre} pesa ${kb(info.bytes)}: Instagram acepta hasta 8 MB`);
    if (info.ancho < 320 || info.ancho > 1440) avisos.push(`${nombre} tiene ${info.ancho} px de ancho: Instagram la va a reescalar (acepta de 320 a 1440)`);
  }
  if (porPhotos && info.bytes > LIMITES.fbFoto) {
    errores.push(`${nombre} pesa ${kb(info.bytes)}: las fotos que se suben a la página de Facebook (/photos) no pueden pasar de 4 MB`);
  }
  return { errores, avisos };
}

// Todas las láminas de un carrusel se recortan a la proporción de la primera.
export function validarCarrusel(infos, { redes = ["instagram", "facebook"] } = {}) {
  const errores = [];
  const avisos = [];
  if (infos.length < 2) errores.push("un carrusel necesita al menos 2 láminas (con una sola, usá --formato=imagen)");
  // El tope de 10 es de Instagram; para Facebook (varias fotos en un posteo) la doc no fija uno.
  if (redes.includes("instagram") && infos.length > LIMITES.carruselMax) errores.push(`el carrusel tiene ${infos.length} láminas: Instagram acepta hasta ${LIMITES.carruselMax}`);
  const r0 = infos[0] ? proporcion(infos[0]) : 1;
  const distintas = infos.filter((i) => Math.abs(proporcion(i) - r0) > 0.01).map((i) => i.ruta.split(/[\\/]/).pop());
  if (distintas.length && redes.includes("instagram")) avisos.push(`estas láminas no tienen la proporción de la primera y Instagram las va a recortar: ${distintas.join(", ")}`);
  return { errores, avisos };
}

export function validarVideo(info, { uso, redes }) {
  const errores = [];
  const avisos = [];
  const nombre = info.ruta.split(/[\\/]/).pop();
  if (!info.moovAlPrincipio) {
    errores.push(`${nombre} tiene el índice (moov) al final y Meta lo pide al principio; se arregla sin perder calidad con: ffmpeg -i entrada.mp4 -c copy -movflags +faststart salida.mp4`);
  }
  if (info.duracion == null) avisos.push(`no pude leer la duración de ${nombre}: la va a revisar Meta`);
  for (const red of redes) {
    const l = LIMITES.videos[red][uso];
    const que = `${uso === "reel" ? "un reel" : "una historia"} de ${red === "instagram" ? "Instagram" : "Facebook"}`;
    if (info.duracion != null && (info.duracion < l.min || info.duracion > l.max)) {
      errores.push(`${nombre} dura ${info.duracion.toFixed(1)} s: ${que} tiene que durar entre ${l.min} y ${l.max} s`);
    }
    if (l.bytes && info.bytes > l.bytes) errores.push(`${nombre} pesa ${(info.bytes / MB).toFixed(0)} MB: ${que} acepta hasta ${l.bytes / MB} MB`);
  }
  // Medidas (de la caja tkhd): las guías de reels y de historias de página piden 9:16 y como mínimo
  // 540×960; por debajo Meta lo rechaza al procesarlo ("Resolution too low… minimum resolution of 540p"),
  // después de subirlo: se frena antes. Los cuadros por segundo (24 a 60) no se leen acá: los revisa Meta.
  if (info.ancho && info.alto) {
    if (Math.abs(info.ancho / info.alto - LIMITES.historia) > 0.01) {
      avisos.push(`${nombre} mide ${info.ancho}×${info.alto}: Meta pide 9:16 (1080×1920) para reels e historias; va a recortar o dejar bandas`);
    }
    if (redes.includes("facebook") && (Math.min(info.ancho, info.alto) < LIMITES.reelFbMin.ancho || Math.max(info.ancho, info.alto) < LIMITES.reelFbMin.alto)) {
      errores.push(`${nombre} mide ${info.ancho}×${info.alto}: Facebook pide como mínimo 540×960 y lo rechazaría al procesarlo. Exportalo en 1080×1920${redes.length > 1 ? " (o publicalo solo en Instagram: --red=instagram)" : ""}`);
    }
  }
  return { errores, avisos };
}
