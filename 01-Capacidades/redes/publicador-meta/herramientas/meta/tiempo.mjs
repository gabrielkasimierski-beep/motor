// Fechas en la hora de Buenos Aires (config.json → zonaHoraria) sin dependencias: Intl hace el trabajo.
import { Falla, nombreZona } from "./entorno.mjs";

const MIN = 60;
const DIA = 86400;
// Rangos de la doc de Meta para programar en una página (oct-2026):
// posts y fotos: entre 10 minutos y 30 días (guía "Posts" de la Pages API; la referencia vieja de /feed dice 75 días: uso el más corto);
// reels: más de 10 minutos y hasta 29 días (guía "Reels Publishing").
export const RANGOS = {
  posteo: { min: 10 * MIN, max: 30 * DIA, texto: "entre 10 minutos y 30 días" },
  reel: { min: 10 * MIN, max: 29 * DIA, texto: "entre 10 minutos y 29 días" },
};
const MARGEN = 60; // un minuto de colchón para que no venza mientras viaja el pedido

function partes(ms, zona) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, Number(p.value)]));
}
// Cuánto adelanta (o atrasa) la zona respecto de UTC en ese instante, en ms.
function desfase(ms, zona) {
  const p = partes(ms, zona);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// "AAAA-MM-DD HH:MM" en la zona → segundos UNIX.
export function horaLocalAUnix(texto, zona) {
  const m = String(texto).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) throw new Falla(`--programar tiene que ser "AAAA-MM-DD HH:MM" (por ejemplo "2026-10-27 12:30"); llegó "${texto}"`, { codigo: 2 });
  const [a, mes, d, h, mi] = m.slice(1).map(Number);
  const supuesto = Date.UTC(a, mes - 1, d, h, mi);
  let ms = supuesto - desfase(supuesto, zona);
  ms = supuesto - desfase(ms, zona);
  const p = partes(ms, zona);
  if (p.year !== a || p.month !== mes || p.day !== d || p.hour !== h || p.minute !== mi) {
    throw new Falla(`la fecha "${texto}" no existe en ${zona}`, { codigo: 2 });
  }
  return Math.floor(ms / 1000);
}

export function unixAHoraLocal(segundos, zona) {
  const p = partes(segundos * 1000, zona);
  const d2 = (n) => String(n).padStart(2, "0");
  return `${p.year}-${d2(p.month)}-${d2(p.day)} ${d2(p.hour)}:${d2(p.minute)}`;
}

export const hoyLocal = (zona) => unixAHoraLocal(Math.floor(Date.now() / 1000), zona).slice(0, 10);

export function validarProgramacion(segundos, tipo, zona) {
  const r = RANGOS[tipo];
  const ahora = Math.floor(Date.now() / 1000);
  const dif = segundos - ahora;
  if (dif < r.min + MARGEN || dif > r.max - MARGEN) {
    throw new Falla(
      `no se puede programar para ${unixAHoraLocal(segundos, zona)} (${nombreZona(zona)}): Meta acepta ${r.texto} desde ahora ` +
      `(${unixAHoraLocal(ahora, zona)}), y dejo un minuto de margen`,
      { codigo: 2 },
    );
  }
}
