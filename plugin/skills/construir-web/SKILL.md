---
name: construir-web
description: >-
  Construye la web completa de un cliente de punta a punta: elige el stack, define el
  diseño, escribe todos los textos, arma home, catálogo con filtros, fichas de producto,
  blog, nosotros y contacto con formulario a mail y WhatsApp, y la deja andando y revisada.
  Usar cuando Gaby diga "construí la web de X", "armá el sitio", "hacé la landing",
  "empezá con la web", "agregale una sección" o quiera ver una demo de un rubro.
---

# Construir la web

Habilidad #2 del Motor Cliente nuevo. Es el motor del negocio.

**Leé primero, en este orden:**
1. [`MOTOR.md`](../../../MOTOR.md) — el Norte y las reglas duras
2. `brief.md` — de acá sale TODO. Si no hay brief, correr `brief-cliente` primero.
3. [`00-Motor/decidir-trabajo.md`](../../../00-Motor/decidir-trabajo.md)
4. [`01-Capacidades/web/sistema-diseno.md`](../../../01-Capacidades/web/sistema-diseno.md)
5. [`01-Capacidades/web/kit-secciones.md`](../../../01-Capacidades/web/kit-secciones.md)

---

## La regla que manda sobre todo

> **La web no es un folleto: es una máquina de generar consultas.**

Cada sección, cada botón y cada palabra se juzgan con una sola pregunta:
*¿esto acerca a que alguien escriba o llame?*
Lo que no la mueve, se saca. Una web de 5 secciones que convierte vale más que una de 12
que nadie termina de leer.

Y su hermana, la prueba que se pasa antes de mostrar nada:

> **Tapá el logo. ¿Podría ser la web de cualquier otra empresa del rubro?**
> Si la respuesta es sí, no está lista. Falta lo específico de ESTE cliente.

---

## El orden de construcción (no se saltea)

### Paso 1 — Decidir, antes de escribir una línea de código
Del brief salen, y se dejan escritas en `decisiones.md`:
- **Carril A o B** (árbol de `decidir-trabajo.md`) + el motivo en una frase
- **Personalidad · paleta · tipografías · tipo de hero · radios** (de `sistema-diseno.md`)
- **Mapa de páginas** y qué secciones va a tener la home, en qué orden
- **¿Lleva una pieza con movimiento?** (un producto que gira con el scroll, un video de portada, un fondo
  vivo, 3D). Si el brief o el prototipo lo piden, esa parte la dirige la skill `dirigir-sitio` con el
  **kit webi** (`C:/Claude/Motor/01-Capacidades/web/webi/`): **una sola** pieza firma por sitio y el resto
  quieto. Si no hace falta, no se agrega: el movimiento es un medio, nunca el objetivo.

Si el brief no alcanza para decidir algo: se elige la opción más conservadora y se anota
como pregunta para Gaby. **No se frena la obra por una duda.**

### Paso 2 — El contenido antes que el diseño
Se escribe **todo el texto real primero**, en `contenido/`:
- `productos.json` — el catálogo entero
- `notas.json` — 3 notas de blog escritas de verdad (el cliente casi nunca las escribe)
- `sitio.json` — nombre, contactos, horarios, redes, textos de cada sección

Diseñar con texto de mentira produce webs que se rompen cuando entra el texto real.

### Paso 3 — La estructura
```
sitio/
├── index.html
├── catalogo.html
├── producto.html          (una plantilla, se llena por parámetro ?p=slug)
├── novedades.html
├── nota.html
├── nosotros.html
├── contacto.html
├── 404.html
├── assets/
│   ├── estilos.css        (variables de marca + lo que Tailwind no cubre)
│   ├── app.js             (menú, animación, formulario, WhatsApp)
│   ├── catalogo.js        (filtros y buscador)
│   └── img/
├── contenido/
│   ├── sitio.json
│   ├── productos.json
│   └── notas.json
├── robots.txt
└── sitemap.xml
```

### Paso 4 — Construir en este orden
1. `estilos.css` con **las variables de marca** (nada de colores sueltos en el HTML)
2. **Header + footer**, idénticos en todas las páginas
3. **Home** entera
4. **Catálogo + ficha**
5. **Novedades + nota**
6. **Nosotros + contacto**
7. 404, sitemap, robots, favicon, Open Graph

### Paso 5 — Revisar
Correr **entera** la lista de [`00-Motor/control-calidad.md`](../../../00-Motor/control-calidad.md)
y dejar el resultado en `qa.md`. **Mobile primero, a 390 px.**

### Paso 6 — Mostrar
Abrir la web en el navegador, sacar capturas de home / catálogo / ficha / contacto en
**mobile y desktop**, y mandárselas a Gaby con un solo mensaje: qué se construyó, qué
decisiones se tomaron, qué falta del cliente.

---

## Cómo se escriben los textos

**En la voz del cliente, no en la nuestra.** Del brief salen sus frases textuales: se usan.

| Regla | ❌ | ✅ |
|---|---|---|
| Concreto antes que abstracto | "Soluciones integrales" | "Hornos rotativos para panaderías, con service propio" |
| Decir para quién | "Calidad y confianza" | "Para panaderías, restaurantes y hoteles de todo el país" |
| Números reales | "Muchos años de experiencia" | "Desde 2001. Más de 1.800 equipos instalados" |
| Verbo en el botón | "Leer más" | "Ver ficha técnica" · "Pedir presupuesto" |
| Vos, no usted (si es Argentina) | "Contáctenos" | "Escribinos" |
| Corto | Párrafos de 8 líneas | Párrafos de 2 o 3 |

**Prohibido inventar:** años, cantidades, certificaciones, premios, testimonios.
Si no está en el brief va `{completar: cantidad de equipos instalados}`, bien visible.
Un dato falso en la web de un cliente es un problema legal de él y de reputación nuestro.

---

## Lo técnico que no se negocia

**Contenido en JSON, siempre.** Productos y notas nunca escritos a mano en el HTML: se
cargan con `fetch` desde `/contenido`. Así el cliente (o Gaby) agrega un producto sin tocar
el diseño, y la web queda mantenible.

**Formulario:** las dos vías, siempre. WhatsApp con mensaje prellenado **y** formulario al
mail (Web3Forms o Netlify Forms, según dónde se publique). Honeypot anti-spam. La access
key va como `{ACCESS_KEY_A_COMPLETAR}` — **la carga Gaby, nunca el agente**.

**El botón de consulta de cada producto** manda a WhatsApp con el nombre del producto ya
escrito en el mensaje. Es el detalle que más consultas genera de toda la web.

**Mobile:** se construye y se revisa primero en 390 px. Barra fija abajo con WhatsApp y
llamar. Botones de 44 px mínimo.

**Performance:** imágenes WebP, `loading="lazy"`, `width` y `height` siempre puestos,
tipografías con `display=swap`.

**SEO:** `<title>` y `meta description` propios por página, un solo `<h1>`, `alt` real en
cada imagen, Open Graph, JSON-LD de `LocalBusiness`, `sitemap.xml`, `<html lang="es-AR">`.

**Accesibilidad:** contraste AA verificado, navegable con Tab, `<label>` en cada campo,
`aria-label` en los íconos-botón, `prefers-reduced-motion` respetado.

---

## Si no hay fotos del cliente (pasa casi siempre)

En orden de preferencia:
1. **Placeholders geométricos SVG** con los colores de la marca: se ven de diseño, pesan
   nada y dejan clarísimo dónde va la foto real.
2. **Duotono**: si el cliente mandó fotos feas, teñirlas con el color de marca las salva a todas.
3. **Foto de stock**, solo si es imprescindible y solo de ambiente (nunca gente sonriendo
   con auriculares). Se documenta la licencia en `entrega.md`.

**Nunca** dejar el recuadro gris de "imagen no disponible". Se ve abandonado.

---

## Cuando el cliente pide cambios

- **Se incluye 1 ronda** de revisión. Se anota qué pidió y se hace todo junto, no de a uno.
- Si pide algo que **baja las consultas** (sacar el WhatsApp, meter un carrusel automático,
  poner el formulario abajo de todo): se hace igual si insiste, pero se le dice antes, una
  vez, por qué no conviene. Es su web.
- Si pide algo **fuera de lo cotizado**: no se hace de onda. Se cotiza aparte.
  Regalar trabajo es la forma más rápida de fundir el negocio.

---

## Reglas

1. Nunca publicar ni mandarle nada al cliente: **manda Gaby**.
2. Nunca inventar datos de la empresa.
3. Nunca poner precios en la web sin que el cliente los confirme por escrito.
4. Nunca cargar credenciales del cliente.
5. Todo vive en `sitio/`.
6. **Cada web tiene que verse distinta de la anterior.** Si esta se parece a la última que
   hicimos, cambiar la combinación de `sistema-diseno.md`.
