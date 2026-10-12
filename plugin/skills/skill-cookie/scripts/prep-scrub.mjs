#!/usr/bin/env node
// prep-scrub.mjs — convierte un clip generado por IA en assets listos para scrub por scroll.
// Node >= 18, ESM, sin dependencias npm. Envuelve ffmpeg/ffprobe (nunca los instala).

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MAX_DESKTOP_MB = 12;

const HELP = `
prep-scrub — prepara un clip para el efecto "reveal 3D por scroll"

USO
  node prep-scrub.mjs <entrada> --name <id> [opciones]

OPCIONES
  --name <id>          (obligatorio) id del capítulo; define los nombres de salida
  --out <dir>          carpeta de salida                      (por defecto: assets)
  --width <px>         ancho del video de escritorio          (por defecto: 1920)
  --mobile-width <px>  ancho del video móvil                  (por defecto: 960)
  --fps <n>            fps de salida                          (por defecto: 24)
  --crf <n>            calidad x264, menor = mejor y más pesado (por defecto: 20)
  --crush <0..0.5>     aplasta el negro (tema oscuro) para que el fondo sea negro puro
                       con mix-blend-mode: lighten; 0 lo desactiva (por defecto: 0.06)
  --light              tema claro: en vez de aplastar negros, quema los blancos
                       (rimax/gimax/bimax = 1 - crush) para usar con darken
  --trim <ini:fin>     recorta en segundos, p. ej. 0.0:5.0 (se admite ":5" o "1:")
  --reverse            invierte el clip (para "ensamblar": se genera desarmándose y se usa al revés)
  --frames <N>         además exporta N frames WebP equiespaciados en <out>/<name>/f_001.webp...
  --no-mobile          no genera la versión móvil
  --dry-run            solo muestra los comandos de ffmpeg, sin ejecutarlos
  -h, --help           muestra esta ayuda

SALIDAS (en --out)
  <name>-scrub.mp4     H.264 yuv420p, ALL-INTRA (-g 1), sin audio, faststart
  <name>-scrub-m.mp4   igual, al ancho móvil
  <name>-poster.jpg    primer frame exacto, con los mismos filtros
  <name>/f_###.webp    solo con --frames

FFMPEG
  Se busca en: variable FFMPEG_PATH (binario o carpeta) -> PATH -> paquete ffmpeg-static
  en node_modules del directorio actual. Si no hay ninguno, el script explica cómo instalarlo.

EJEMPLO
  node prep-scrub.mjs clip.mp4 --name frambuesa --trim 0:5 --frames 96
`;

// ---------- utilidades ----------
const err = (msg) => process.stderr.write(msg + '\n');
const die = (msg, code = 1) => { err(msg); process.exit(code); };
const fmtMB = (b) => (b / 1048576).toFixed(2) + ' MB';

// ---------- argumentos (a mano) ----------
function parseArgs(argv) {
  const opts = { out: 'assets', width: 1920, mobileWidth: 960, fps: 24, crf: 20, crush: 0.06,
    light: false, reverse: false, trim: null, frames: 0, mobile: true, dryRun: false, name: null, input: null, help: false };
  const needNum = (flag, v, { min = -Infinity, max = Infinity, int = false } = {}) => {
    const n = Number(v);
    if (v === undefined || v === '' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n)))
      die(`Valor inválido para ${flag}: "${v ?? ''}"${int ? ' (se espera un entero)' : ''}. Usá --help para ver los rangos.`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inline;
    if (a.startsWith('--') && a.includes('=')) { const k = a.indexOf('='); inline = a.slice(k + 1); a = a.slice(0, k); }
    const val = () => (inline !== undefined ? inline : argv[++i]);
    switch (a) {
      case '-h': case '--help': opts.help = true; break;
      case '--name': opts.name = val(); break;
      case '--out': opts.out = val(); break;
      case '--width': opts.width = needNum(a, val(), { min: 64, int: true }); break;
      case '--mobile-width': opts.mobileWidth = needNum(a, val(), { min: 64, int: true }); break;
      case '--fps': opts.fps = needNum(a, val(), { min: 1, max: 120 }); break;
      case '--crf': opts.crf = needNum(a, val(), { min: 0, max: 51 }); break;
      case '--crush': opts.crush = needNum(a, val(), { min: 0, max: 0.5 }); break;
      case '--frames': opts.frames = needNum(a, val(), { min: 1, int: true }); break;
      case '--trim': opts.trim = val(); break;
      case '--light': opts.light = true; break;
      case '--reverse': opts.reverse = true; break;
      case '--no-mobile': opts.mobile = false; break;
      case '--dry-run': opts.dryRun = true; break;
      default:
        if (a.startsWith('-') && a.length > 1) die(`Opción desconocida: ${a}\nUsá --help para ver las opciones.`);
        if (opts.input) die(`Hay más de una entrada ("${opts.input}" y "${a}"). Solo se admite un archivo.`);
        opts.input = a;
    }
  }
  return opts;
}

function parseTrim(s) {
  if (!s) return null;
  const m = /^\s*(\d*\.?\d*)\s*:\s*(\d*\.?\d*)\s*$/.exec(s);
  if (!m || (m[1] === '' && m[2] === '')) die(`--trim inválido: "${s}". Formato: ini:fin en segundos, p. ej. 0.0:5.0`);
  const start = m[1] === '' ? 0 : Number(m[1]);
  const end = m[2] === '' ? null : Number(m[2]);
  if (end !== null && end <= start) die(`--trim inválido: el fin (${end}) debe ser mayor que el inicio (${start}).`);
  return { start, end };
}

// ---------- localizar ffmpeg / ffprobe ----------
const isWin = process.platform === 'win32';
const exeName = (b) => (isWin ? b + '.exe' : b);
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

function whichInPath(bin) {
  const exts = isWin ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean) : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const cand = path.join(dir.replace(/^"|"$/g, ''), bin + ext.toLowerCase());
      if (isFile(cand)) return cand;
      const cand2 = path.join(dir.replace(/^"|"$/g, ''), bin + ext);
      if (isFile(cand2)) return cand2;
    }
  }
  return null;
}
function resolveEnvPath(v, bin) {                       // FFMPEG_PATH puede ser el binario o su carpeta
  if (!v) return null;
  if (isFile(v)) return v;
  const inDir = path.join(v, exeName(bin));
  return isFile(inDir) ? inDir : null;
}
function fromNodeModules(pkg, pick) {
  try {
    const req = createRequire(path.join(process.cwd(), 'noop.js'));
    const mod = req(pkg);
    const p = pick(mod);
    return p && isFile(p) ? p : null;
  } catch { return null; }
}
function canRun(bin) {
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
function locateTools() {
  let ffmpeg = resolveEnvPath(process.env.FFMPEG_PATH, 'ffmpeg') || whichInPath('ffmpeg')
    || fromNodeModules('ffmpeg-static', (m) => (typeof m === 'string' ? m : m && m.default));
  if (ffmpeg && !canRun(ffmpeg)) ffmpeg = null;
  if (!ffmpeg) return null;
  let ffprobe = resolveEnvPath(process.env.FFPROBE_PATH, 'ffprobe');
  if (!ffprobe) {                                         // al lado de ffmpeg, en PATH o ffprobe-static
    const sibling = path.join(path.dirname(ffmpeg), exeName('ffprobe'));
    ffprobe = isFile(sibling) ? sibling : whichInPath('ffprobe') || fromNodeModules('ffprobe-static', (m) => m && m.path);
  }
  if (ffprobe && !canRun(ffprobe)) ffprobe = null;
  return { ffmpeg, ffprobe };
}

const NO_FFMPEG_MSG = `
No se encontró ffmpeg. Este script no lo instala solo; instalalo vos y volvé a correrlo:

  Windows:  winget install Gyan.FFmpeg      (reabrí la terminal después)
  macOS:    brew install ffmpeg
  Linux:    sudo apt install ffmpeg

Alternativas:
  - Definir la variable FFMPEG_PATH con la ruta al binario (o a su carpeta).
  - Instalar el paquete ffmpeg-static en el directorio desde el que corrés el script.
`;

// ---------- ejecución ----------
function run(cmd, args, { dry } = {}) {
  if (dry) {
    process.stdout.write('$ ' + [cmd, ...args].map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(' ') + '\n');
    return { status: 0, stderr: '', stdout: '' };
  }
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (r.error) die(`No se pudo ejecutar ${cmd}: ${r.error.message}`);
  return r;
}
function ffFail(what, r) {
  const tail = (r.stderr || '').trim().split(/\r?\n/).slice(-15).join('\n');
  die(`ffmpeg falló al ${what} (código ${r.status}).\n${tail}`, 2);
}

function probeDuration(tools, input) {
  if (tools.ffprobe) {
    const r = spawnSync(tools.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', input],
      { encoding: 'utf8' });
    const d = parseFloat((r.stdout || '').trim());
    if (r.status === 0 && Number.isFinite(d) && d > 0) return d;
  }
  const r = spawnSync(tools.ffmpeg, ['-hide_banner', '-i', input], { encoding: 'utf8' });   // sale con código 1, es normal
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec((r.stderr || '') + (r.stdout || ''));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

// ---------- filtros ----------
function filterChain(o, trim, width) {
  const f = [];
  if (trim) f.push(`trim=start=${trim.start}${trim.end !== null ? `:end=${trim.end}` : ''}`, 'setpts=PTS-STARTPTS');
  if (o.reverse) f.push('reverse');
  f.push(`fps=${o.fps}`);
  f.push(`scale=${width}:-2:flags=lanczos`);
  if (o.crush > 0) {
    if (o.light) { const x = +(1 - o.crush).toFixed(4); f.push(`colorlevels=rimax=${x}:gimax=${x}:bimax=${x}`); }
    else f.push(`colorlevels=rimin=${o.crush}:gimin=${o.crush}:bimin=${o.crush}`);
  }
  return f.join(',');
}

// ---------- main ----------
const o = parseArgs(process.argv.slice(2));
if (o.help || process.argv.length <= 2) { process.stdout.write(HELP); process.exit(o.help ? 0 : 1); }
if (!o.input) die('Falta el archivo de entrada. Uso: node prep-scrub.mjs <entrada> --name <id>  (--help para más info)');
if (!o.name) die('Falta --name <id>. Es el id del capítulo y define los nombres de salida.');
if (!/^[\w.-]+$/.test(o.name)) die(`--name inválido: "${o.name}". Usá solo letras, números, guion, guion bajo o punto.`);
const trim = parseTrim(o.trim);

let tools;
if (o.dryRun) tools = { ffmpeg: 'ffmpeg', ffprobe: null };
else {
  tools = locateTools();
  if (!tools) die(NO_FFMPEG_MSG, 1);
}
if (!o.dryRun && !existsSync(o.input)) die(`No existe el archivo de entrada: ${o.input}`);

const outDir = path.resolve(o.out);
const sc = {
  desktop: path.join(outDir, `${o.name}-scrub.mp4`),
  mobile: path.join(outDir, `${o.name}-scrub-m.mp4`),
  poster: path.join(outDir, `${o.name}-poster.jpg`),
  framesDir: path.join(outDir, o.name)
};
if (!o.dryRun) mkdirSync(outDir, { recursive: true });

// duración efectiva (tras --trim)
let fullDur = o.dryRun ? 5 : probeDuration(tools, o.input);
if (!fullDur) die('No se pudo leer la duración del video (ni con ffprobe ni con ffmpeg -i). ¿El archivo es válido?');
const dur = trim ? Math.max(0.04, (trim.end !== null ? Math.min(trim.end, fullDur) : fullDur) - trim.start) : fullDur;
if (o.dryRun) err('(dry-run: duración supuesta de 5 s)');

const base = ['-hide_banner', '-loglevel', 'error', '-nostats', '-y', '-i', o.input];
const x264 = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crf), '-g', '1', '-keyint_min', '1',
  '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const written = [];
const warnings = [];
const totalSteps = 2 + (o.mobile ? 1 : 0) + (o.frames ? 1 : 0);
let step = 0;
const stepMsg = (m) => err(`[${++step}/${totalSteps}] ${m}`);

err(`Procesando "${o.input}" → ${outDir}  (duración ${dur.toFixed(2)} s, ${o.fps} fps)`);

// 1) escritorio
stepMsg(`${path.basename(sc.desktop)} (${o.width}px, all-intra)…`);
let r = run(tools.ffmpeg, [...base, '-vf', filterChain(o, trim, o.width), ...x264, sc.desktop], { dry: o.dryRun });
if (r.status !== 0) ffFail('generar el mp4 de escritorio', r);
written.push(sc.desktop);

// 2) móvil
if (o.mobile) {
  stepMsg(`${path.basename(sc.mobile)} (${o.mobileWidth}px)…`);
  r = run(tools.ffmpeg, [...base, '-vf', filterChain(o, trim, o.mobileWidth), ...x264, sc.mobile], { dry: o.dryRun });
  if (r.status !== 0) ffFail('generar el mp4 móvil', r);
  written.push(sc.mobile);
}

// 3) póster: primer frame exacto con la misma cadena de filtros
stepMsg(`${path.basename(sc.poster)}…`);
r = run(tools.ffmpeg, [...base, '-vf', filterChain(o, trim, o.width), '-an', '-frames:v', '1', '-q:v', '2', sc.poster], { dry: o.dryRun });
if (r.status !== 0) ffFail('generar el póster', r);
written.push(sc.poster);

// 4) frames WebP equiespaciados (primero y último incluidos)
let framesInfo = null;
if (o.frames) {
  const total = Math.max(1, Math.round(dur * o.fps));            // frames disponibles tras fps
  let n = o.frames;
  if (n > total) { warnings.push(`Pediste ${n} frames pero el clip solo tiene ~${total} a ${o.fps} fps; se exportan ${total}.`); n = total; }
  const padW = Math.max(3, String(n).length);
  const chain = filterChain(o, trim, o.width) + (n > 1 ? `,fps=${+(((n - 1) * o.fps) / Math.max(1, total - 1)).toFixed(6)}` : '');
  stepMsg(`${n} frames WebP en ${path.relative(process.cwd(), sc.framesDir) || sc.framesDir}/…`);
  if (!o.dryRun) {
    mkdirSync(sc.framesDir, { recursive: true });
    for (const f of readdirSync(sc.framesDir)) if (/^f_\d+\.webp$/.test(f)) rmSync(path.join(sc.framesDir, f));   // limpia corridas anteriores
  }
  r = run(tools.ffmpeg, [...base, '-vf', chain, '-an', '-frames:v', String(n), '-c:v', 'libwebp', '-quality', '80',
    '-start_number', '1', path.join(sc.framesDir, `f_%0${padW}d.webp`)], { dry: o.dryRun });
  if (r.status !== 0) ffFail('exportar los frames WebP', r);
  framesInfo = { requested: o.frames, count: n, dir: sc.framesDir, pad: padW, ext: 'webp' };
}

// ---------- resumen ----------
if (o.dryRun) { err('\n(dry-run: no se escribió nada)'); process.exit(0); }

const files = written.map((p) => ({ path: p, bytes: statSync(p).size }));
if (framesInfo) {
  const fl = readdirSync(sc.framesDir).filter((f) => /^f_\d+\.webp$/.test(f)).sort();
  framesInfo.written = fl.length;
  framesInfo.bytes = fl.reduce((s, f) => s + statSync(path.join(sc.framesDir, f)).size, 0);
  if (fl.length !== framesInfo.count)
    warnings.push(`Se esperaban ${framesInfo.count} frames y se escribieron ${fl.length}. Ajustá "count" en REVEAL.chapters[].frames.`);
}
const desktopBytes = statSync(sc.desktop).size;
if (desktopBytes > MAX_DESKTOP_MB * 1048576)
  warnings.push(`El mp4 de escritorio pesa ${fmtMB(desktopBytes)} (> ${MAX_DESKTOP_MB} MB). Bajá --width, subí --crf (p. ej. 24) o acortá con --trim.`);

const summary = { name: o.name, input: path.resolve(o.input), duration: +dur.toFixed(3), fps: o.fps, trim: trim || null,
  light: o.light, crush: o.crush, files, frames: framesInfo, warnings };
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
for (const w of warnings) err('ADVERTENCIA: ' + w);
