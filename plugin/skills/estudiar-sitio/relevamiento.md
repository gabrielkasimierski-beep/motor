# Relevamiento — fragmentos para el navegador

Se corren en la consola de la página (herramienta de JavaScript del navegador integrado). Devuelven
texto corto: pensados para leer, no para volcar el sitio entero.

## 1. Stack y cabecera

```js
(() => ({
  titulo: document.title,
  generador: document.querySelector('meta[name=generator]')?.content,
  scripts: [...document.scripts].map(s => s.src).filter(Boolean),
  estilos: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href),
  clasesHtml: document.documentElement.className,
  globales: Object.keys(window).filter(k => /gsap|lenis|three|barba|swiper|locomotive|framer|webflow|next|nuxt|astro/i.test(k)),
  alto: document.documentElement.scrollHeight,
}))()
```

## 2. Bandas de la página (esqueleto)

```js
(() => { const o = []; const ver = (el, n) => { if (n > 3) return;
  for (const h of el.children) { if (['SCRIPT','STYLE'].includes(h.tagName)) continue;
    o.push('  '.repeat(n) + h.tagName.toLowerCase() + (h.id ? '#' + h.id : '') + ' .' + String(h.className).slice(0, 160) + ' [' + h.children.length + ']');
    ver(h, n + 1); } };
  ver(document.body, 0); return o.join('\n').slice(0, 12000); })()
```

## 3. Sistema visual y movimiento (de las hojas de estilo)

```js
(async () => { let css = '';
  for (const l of document.querySelectorAll('link[rel=stylesheet]')) css += await fetch(l.href).then(r => r.text());
  const unicos = a => [...new Set(a)];
  return {
    colores: unicos([...css.matchAll(/--color-([a-z0-9-]+):([^;}]+)/g)].map(m => m[1] + ':' + m[2])).slice(0, 60),
    fuentes: unicos([...css.matchAll(/--font-[a-z-]+:[^;}]+/g)].map(m => m[0].slice(0, 110))).slice(0, 10),
    curvas: unicos([...css.matchAll(/cubic-bezier\([^)]+\)/g)].map(m => m[0])),
    animaciones: unicos([...css.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(m => m[1] + ': ' + m[2].slice(0, 200))),
    propiedades: unicos([...css.matchAll(/@property (--[\w-]+)/g)].map(m => m[1])),
    reducirMovimiento: (css.match(/prefers-reduced-motion/g) || []).length,
  }; })()
```

## 4. Mapa del sitio

```js
(async () => { const t = await fetch('/sitemap.xml').then(r => r.text());
  const rutas = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  const por = {}; for (const r of rutas) (por[r.split('/')[1] || 'raiz'] ??= []).push(r);
  return Object.fromEntries(Object.entries(por).map(([k, v]) => [k, v.length + ' · ' + v.slice(0, 4).join(' ')])); })()
```

## 5. Catálogo: nombre, familia y descripción corta de cada pieza de un listado

```js
[...document.querySelectorAll('main article')].map(a => {
  const p = [...a.querySelectorAll('p')].map(x => x.textContent.trim());
  return a.querySelector('h3')?.textContent.trim() + ' | ' + p[0] + ' | ' + (p.at(-1) || '').slice(0, 200);
}).join('\n')
```

Para páginas de detalle, pedirlas con `fetch` desde la misma página, de a diez, y quedarse con el
título, las etiquetas de técnica y el primer párrafo (recortado). Las etiquetas son lo que más
sirve para clasificar por mecanismo.

## 6. Cómo trata sus medios

```js
(() => ({
  videos: [...document.querySelectorAll('video')].slice(0, 5).map(v => ({ src: (v.currentSrc || v.querySelector('source')?.src || '').slice(0, 120), precarga: v.preload, bucle: v.loop, poster: !!v.poster })),
  lienzos: [...document.querySelectorAll('canvas')].map(c => c.width + '×' + c.height + ' ' + String(c.className).slice(0, 60)),
  marcos: [...document.querySelectorAll('iframe')].map(i => i.src),
}))()
```

## Qué mirar a mano

- ¿El escenario se queda fijo con `position: sticky` o lo mueve JavaScript?
- ¿Cuánto mide un escenario (en altos de pantalla) y en cuántos capítulos se reparte?
- ¿Qué pasa en el celular con lo que sigue al puntero?
- ¿Qué carga primero y qué espera a estar cerca?
