# Sistema de diseño

Esto es lo que separa "una web hecha con IA" de **un trabajo por el que una empresa paga**.

La regla madre:

> **El sistema es combinatorio, no un molde.** Se combinan piezas para que **cada cliente
> reciba una web que no se parece a la anterior**. Si dos clientes reciben lo mismo con
> otro color, el negocio se muere solo.

---

## 1. Las 6 marcas de "web cara"

Antes de mirar nada más: si una web no tiene estas seis cosas, se ve barata, sin importar
cuánto trabajo tenga atrás.

| # | Marca | Qué significa en concreto |
|---|---|---|
| 1 | **Aire** | Espacio en blanco generoso. Secciones de `96px` a `160px` de alto de padding en desktop, `64px` en mobile. Lo apretado se ve barato. |
| 2 | **Jerarquía brutal** | El título de sección es MUCHO más grande que el texto (relación 3:1 o más). Nada de todo del mismo tamaño. |
| 3 | **Una sola familia tipográfica bien usada** (o dos, máximo) | Con pesos contrastados: 300/400 para texto, 600/800 para títulos. Tres tipografías = amateur. |
| 4 | **Un solo color de acento** | Todo lo demás son neutros. El acento se usa poco y siempre para lo mismo (la acción). |
| 5 | **Alineación estricta** | Todo cae sobre una grilla. Nada "casi alineado". |
| 6 | **Detalle en el movimiento** | Transiciones de 150-300ms en hover, aparición suave al hacer scroll. Sutil. Nada que rebote. |

---

## 2. Combinar: elegí una de cada columna

Para cada cliente se sortea una combinación **coherente con su rubro**, no al azar puro.

### A. Personalidad (define todo lo demás)

| Personalidad | Para qué rubros | Se reconoce por |
|---|---|---|
| **Industrial / Técnica** | metalúrgica, equipamiento, logística, construcción, agro | Tipografía condensada, grillas visibles, fichas técnicas, mucho dato, negros y un acento fuerte |
| **Institucional / Confianza** | estudios contables, jurídicos, salud, seguros, educación | Serif en títulos, azul o verde profundo, fotos de gente, testimonios, cifras grandes |
| **Editorial / Premium** | arquitectura, diseño, bodegas, hotelería, gastronomía | Mucho blanco, tipografía grande, fotos a sangre, poco texto, elegancia |
| **Cercana / Servicio** | gimnasios, veterinarias, estética, oficios, comercios de barrio | Bordes redondeados, colores cálidos, caras sonriendo, WhatsApp muy presente |
| **Tech / Producto** | software, startups, servicios digitales | Fondo oscuro o degradés sutiles, tarjetas con vidrio, íconos de línea, animación |

### B. Paletas (ya validadas en contraste AA)

Todas se escriben como variables CSS. Nunca colores sueltos en el HTML.

```css
/* INDUSTRIAL — Grafito + Ámbar */
--fondo:#0B0C0E; --superficie:#15171A; --texto:#F2F3F5; --suave:#9BA1A8;
--acento:#FF7A18; --borde:#23262B;

/* INSTITUCIONAL — Azul noche + Cobre */
--fondo:#FFFFFF; --superficie:#F5F7FA; --texto:#0F1A2B; --suave:#5A6879;
--acento:#B26A3C; --profundo:#12294A; --borde:#E2E8F0;

/* EDITORIAL — Hueso + Tinta */
--fondo:#FAF8F4; --superficie:#F1EDE6; --texto:#191714; --suave:#6E675E;
--acento:#8A5A2B; --borde:#DDD6CA;

/* CERCANA — Crema + Terracota */
--fondo:#FFFDF9; --superficie:#FFF4E8; --texto:#2A1F18; --suave:#75655A;
--acento:#D9622B; --borde:#F0E1D0;

/* TECH — Slate + Violeta eléctrico */
--fondo:#0A0A0F; --superficie:#14141F; --texto:#EDEDF2; --suave:#9A9AAE;
--acento:#7C5CFF; --borde:#242433;

/* SALUD / AGRO — Blanco + Verde profundo */
--fondo:#FFFFFF; --superficie:#F3F7F4; --texto:#10231A; --suave:#5A6B62;
--acento:#137A52; --borde:#DDE8E1;
```

**Regla de uso del acento:** solo en botones principales, links, números destacados y un
detalle gráfico. Si el acento aparece en más de 4 lugares por pantalla, sacar.

### C. Tipografías (Google Fonts, todas gratuitas y con buen soporte de español)

| Combinación | Títulos | Texto | Va bien con |
|---|---|---|---|
| **Fuerza** | Archivo / Oswald (condensada, 700) | Inter | Industrial |
| **Autoridad** | Fraunces / Playfair Display | Source Sans 3 | Institucional, Editorial |
| **Silencio** | Instrument Serif | Inter | Editorial, Premium |
| **Cercanía** | Bricolage Grotesque | Nunito Sans | Cercana |
| **Sistema** | Geist / Space Grotesk | Inter | Tech |
| **Neutro seguro** | Inter 800 | Inter 400 | Cualquiera, si no hay tiempo |

Siempre con fallback real: `font-family:'Archivo', system-ui, -apple-system, sans-serif`.

### D. Estructura del hero (la primera pantalla)

Elegir **una**, no mezclar:

1. **Split 50/50** — texto a la izquierda, imagen fuerte a la derecha. Seguro, funciona siempre.
2. **Full-bleed** — foto o video a pantalla completa con overlay oscuro y título gigante encima.
3. **Tipográfico** — casi sin imagen: un titular enorme, un párrafo y dos botones. Se ve caro y carga en un suspiro.
4. **Con tarjeta de acción** — a la derecha, en vez de imagen, un mini formulario o cotizador. El que más consultas genera.
5. **Con prueba** — titular + una fila de logos de clientes o 3 números duros abajo.

### E. Tratamiento de imagen

- **A sangre** (ocupa todo el ancho, sin margen) → Editorial, Premium.
- **En marco con radio 12-16px** → Cercana, Institucional.
- **Recuadro duro sin radio + borde 1px** → Industrial, Tech.
- **Duotono** (foto teñida con el color de marca) → cuando las fotos del cliente son malas. **Salva cualquier foto fea.**
- Si no hay fotos todavía: **placeholders geométricos SVG con los colores de la marca**,
  nunca imágenes de stock genéricas de gente sonriendo con auriculares.

---

## 3. Escala y ritmo (esto no se improvisa)

```css
/* Espaciado: todo múltiplo de 4 */
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160

/* Tipografía — desktop */
Display  : clamp(2.75rem, 6vw, 5rem)     /* el titular del hero */
H2       : clamp(2rem, 4vw, 3.25rem)     /* título de sección */
H3       : 1.375rem
Cuerpo   : 1.0625rem   con line-height 1.65
Chico    : 0.875rem
Etiqueta : 0.75rem, mayúsculas, letter-spacing .12em

/* Ancho de lectura */
Texto corrido: máximo 68 caracteres por línea (max-width: 62ch)

/* Radios (elegir UNO por proyecto y respetarlo) */
Duro 0-2px · Suave 8-12px · Redondo 16-24px · Pastilla 999px (solo botones)
```

**Sombras:** una sola escala, suave y de color. Nunca `box-shadow` negro puro.
`0 1px 2px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.08)`

---

## 4. Movimiento

- Hover: `transition: all .2s ease` — cambia color, sube 2px, o crece 1.02.
- Aparición al scrollear: `opacity 0 → 1` + `translateY(16px → 0)`, `.6s`, con `IntersectionObserver`.
- **Nunca:** rebotes, giros, parallax pesado, texto que se arma letra por letra en el hero.
- Respetar `@media (prefers-reduced-motion: reduce)` → apagar todo. Es accesibilidad, no un detalle.

---

## 5. Lo que se ve genérico (la lista negra)

Si la web tiene esto, se la reconoce como plantilla a la legua:

- ❌ Degradé violeta-celeste de fondo en el hero
- ❌ Tres tarjetas iguales con un ícono redondo arriba y "Rápido / Seguro / Confiable"
- ❌ Fotos de stock de gente con auriculares o dándose la mano
- ❌ "Bienvenidos a nuestro sitio web"
- ❌ Carrusel automático arriba de todo (nadie los mira y frenan la carga)
- ❌ Emojis usados como íconos
- ❌ Todo centrado, de arriba a abajo
- ❌ Un botón que dice "Leer más" sin decir a dónde lleva
- ❌ Textos de relleno tipo "somos líderes en el mercado brindando soluciones integrales"

**El reemplazo de cada una está en `kit-secciones.md`.**

---

## 6. La prueba final

Antes de mostrar cualquier web:

> **Tapá el logo. ¿Podría ser la web de cualquier otra empresa del rubro?**
> Si la respuesta es sí, todavía no está. Falta lo específico de ESTE cliente: sus
> productos reales, su forma de trabajar, su zona, sus años, su gente, su manera de hablar.

Es la misma prueba que usamos en AbrazArte para los guiones, y funciona igual acá.
