# Plantilla — Carril A (sitio estático)

No es una plantilla de diseño: **el diseño cambia en cada cliente** (ver
`01-Capacidades/web/sistema-diseno.md`). Lo que se repite es **la plomería**: los bloques de código
que hay que poner sí o sí y que siempre se escriben igual.

Copiar de acá, no reescribir de memoria.

---

## Estructura de archivos

```
sitio/
├── index.html · catalogo.html · producto.html
├── novedades.html · nota.html · nosotros.html · contacto.html · 404.html
├── assets/  estilos.css · app.js · catalogo.js · img/
├── contenido/  sitio.json · productos.json · notas.json
├── robots.txt · sitemap.xml · favicon.svg
```

**Ejemplo terminado y funcionando:** `C:/Claude/Clientes/demo-vulcano/sitio/index.html`
(ese está en un solo archivo porque es una demo para mostrar; en un cliente real va separado
en páginas, para que Google indexe cada producto por su cuenta).

---

## `contenido/productos.json`

```json
[{
  "slug": "vr-120",
  "cod": "VR-120",
  "nombre": "Horno rotativo a gas",
  "cat": "Panadería",
  "img": "assets/img/vr-120.webp",
  "destacado": true,
  "desc": "Una o dos líneas, concretas.",
  "specs": { "Producción": "120 kg/h", "Medidas": "1.750 × 1.980 mm" }
}]
```

El sitio lo lee con `fetch("contenido/productos.json")`. **Nunca escribir productos a mano
en el HTML:** así el cliente agrega uno sin tocar el diseño.

---

## Cabeza de cada página (SEO + compartir)

```html
<html lang="es-AR">
<title>Hornos industriales para panadería | {EMPRESA} — {CIUDAD}</title>
<meta name="description" content="{140-160 caracteres, con lo que hace y dónde}">
<link rel="canonical" href="https://{dominio}/{pagina}">
<meta property="og:title" content="{título}">
<meta property="og:description" content="{descripción}">
<meta property="og:image" content="https://{dominio}/assets/img/og.jpg">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

**La imagen `og.jpg` de 1200 × 630** es lo que se ve cuando comparten el link por WhatsApp.
Sin ella el link se ve pelado y nadie lo abre. No es opcional.

---

## Negocio local en Google (JSON-LD)

```html
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"LocalBusiness",
  "name":"{EMPRESA}",
  "image":"https://{dominio}/assets/img/og.jpg",
  "telephone":"+54 11 {tel}",
  "email":"{mail}",
  "address":{"@type":"PostalAddress","streetAddress":"{calle}","addressLocality":"{ciudad}","addressRegion":"{provincia}","addressCountry":"AR"},
  "openingHours":"Mo-Fr 08:00-17:00",
  "url":"https://{dominio}"
}
</script>
```

---

## Formulario que llega al mail

### Web3Forms (sirve en cualquier hosting)
```html
<form action="https://api.web3forms.com/submit" method="POST">
  <input type="hidden" name="access_key" value="{ACCESS_KEY_A_COMPLETAR}">
  <input type="hidden" name="subject" value="Consulta desde la web de {EMPRESA}">
  <input type="hidden" name="from_name" value="Web {EMPRESA}">
  <input type="text"  name="nombre"   required>
  <input type="text"  name="contacto" required>
  <textarea name="mensaje" required></textarea>
  <input type="checkbox" name="botcheck" class="hp" style="display:none">
  <button type="submit">Enviar consulta</button>
</form>
```

### Netlify Forms (solo si se hostea en Netlify)
```html
<form name="contacto" method="POST" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="contacto">
  <p class="hp"><label>No completar <input name="bot-field"></label></p>
  ...
</form>
```

⚠️ **La access key y el mail de destino los carga Gaby o el cliente. El agente deja
`{ACCESS_KEY_A_COMPLETAR}`.**

---

## WhatsApp

```html
<!-- botón general -->
<a href="https://wa.me/54911XXXXXXXX?text=Hola%20{EMPRESA}%2C%20quiero%20pedir%20un%20presupuesto.">
  Pedir presupuesto
</a>
```

```js
// botón dentro de una ficha de producto: lleva el nombre y el código ya escritos
const msg = `Hola ${EMPRESA}, quiero consultar por el ${p.nombre} (${p.cod}).`;
boton.href = `https://wa.me/${TEL}?text=${encodeURIComponent(msg)}`;
```

El número va **sin +, sin 0, sin 15**: `54911` + los 8 dígitos.
Este detalle —que el mensaje llegue ya escrito— es lo que más consultas genera de toda la web.

---

## Animación al scrollear, sin romper el primer frame

```js
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting){ e.target.classList.add("visible"); io.unobserve(e.target); }
}), { rootMargin:"-40px" });

document.querySelectorAll("section").forEach(s => {
  // solo se oculta lo que YA está fuera de la pantalla al cargar
  if (s.getBoundingClientRect().top > innerHeight - 60){ s.classList.add("oculto"); io.observe(s); }
});
```

```css
@media (prefers-reduced-motion:reduce){ .oculto{ opacity:1; transform:none; } }
```

---

## `robots.txt` y `sitemap.xml`

```
User-agent: *
Allow: /
Sitemap: https://{dominio}/sitemap.xml
```

El `sitemap.xml` se genera con una URL por página **y una por producto y por nota**.

---

## Imágenes

- Convertir todo a **WebP** y redimensionar al tamaño real de uso (squoosh.app sirve).
- `loading="lazy"` en todo lo que está fuera de la primera pantalla.
- `width` y `height` siempre, para que no salte el diseño mientras carga.
- Ninguna imagen arriba de **300 KB**.

---

## Mostrarle la web al cliente con un link

El sitio real referencia sus imágenes como archivos. Para mostrarlo como link (artifact),
todo tiene que ir en un solo HTML:

```
node C:/Claude/Motor/01-Capacidades/web/plantillas/herramientas/vista-previa.js sitio/index.html vista-previa.html
```

Se publica `vista-previa.html` **siempre sobre el mismo link** (parámetro `url`), así el
cliente no recibe un link nuevo con cada cambio. `vista-previa.html` no se sube al hosting.

---

## Antes de entregar

Correr entera la lista de `00-Motor/control-calidad.md`.
