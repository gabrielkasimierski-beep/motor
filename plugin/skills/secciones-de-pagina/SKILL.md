---
name: secciones-de-pagina
description: Las bandas de una página, de arriba abajo - aviso, nav, portada, cinta, trabajos, servicios en bento, pasos, cifras, testimonios, precios, preguntas, contacto por WhatsApp, cierre y pie - con las decisiones de diseño que hacen que cada una funcione. Usar al armar o mejorar cualquier sección de un sitio, al escribir el guion de bandas, cuando falta "una sección de precios / contacto / un pie mejor", o al revisar el orden de una landing.
---

# Secciones de página

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

Las partes que todo sitio necesita y nadie disfruta rehacer. Una portada de cine arriba de cuatro
bandas chatas se ve peor que cuatro bandas parejas: acá está el resto de la página.

Kit: `kit/secciones.css`, `kit/secciones.js` · Demostración completa: `banco/sitio-base.html`

## El orden que funciona

```
aviso → nav → PORTADA → cinta → trabajos → servicios → pasos → cifras → voces → precios → preguntas → contacto → cierre → pie
```

No van todas. Para un negocio local, la versión corta rinde más que la explicativa: **portada,
trabajos, cómo es, contacto**. Después de una banda con movimiento, una quieta.

## Banda por banda

| Banda | Para qué | Lo que la hace funcionar |
|---|---|---|
| **Aviso** | Una novedad o una oferta con fecha | Barra fina del color del acento, un punto que late, cuenta regresiva en mono. Solo si hay algo real que avisar |
| **Nav** | Orientar y tener el botón siempre a mano | Pegada, translúcida con desenfoque; gana fondo y línea al bajar. En celular: logo + botón principal + menú |
| **Portada** | Qué es y qué hago ahora | Pastilla de novedad, título enorme en dos líneas, bajada de una oración, **dos** botones (acción + ver), una línea de confianza. Fondo: la pieza firma |
| **Cinta** | Ritmo entre portada y contenido | Oficios, materiales o clientes en mono con separadores, entre dos líneas |
| **Trabajos** | La prueba | Etiqueta + título a la izquierda, filtros en pastillas con scroll horizontal, grilla 1/2/3. Tarjetas con video o imagen. **Una tarjeta distinta dentro de la grilla** que invita a pedir un trabajo a medida |
| **Servicios** | Qué se ofrece | Bento asimétrico dentro de un panel redondeado: tamaños distintos según importancia, un dibujo por tarjeta y una descripción llana |
| **Pasos** | Sacar el miedo a empezar | Tres pasos, números en mono, unidos por una línea fina que se pierde en los extremos |
| **Cifras** | Respaldo en números | Cuatro números grandes que cuentan al entrar. Las divisiones son líneas de 1 px (grilla con `gap: 1px` sobre el color de línea). Números verdaderos o no va |
| **Voces** | Que lo diga otro | Nombre, de dónde y qué encargó. Cortos. Con foto real si la hay |
| **Precios** | Ordenar la decisión | Tres niveles, el del medio destacado; lista con tildes; una palabra fantasma gigante detrás. Solo si el dueño quiere precios publicados; si cambian seguido, "desde" o nada |
| **Preguntas** | Contestar la objeción antes de la charla | Acordeón con `<details>`: anda sin JavaScript |
| **Contacto** | Que escriban | Ver abajo |
| **Cierre** | La última oportunidad | Un título, una oración, un botón, con resplandor y grano |
| **Pie** | Cerrar con identidad | Columnas de links, datos del negocio, y **la marca gigante** en degradé casi transparente saliéndose por el borde inferior |

## Contacto: termina en WhatsApp, con una persona

El formulario no reemplaza la charla: **ordena el primer mensaje y abre el chat**
(`mensajeWhatsApp` arma el texto con los campos y abre `wa.me`). Pide lo que quien atiende
preguntaría igual, para que no tenga que repreguntar. Tres formas:

- **Formulario corto + promesas** (por defecto): a un lado qué pasa después de escribir y los
  datos; al otro, tres o cuatro campos.
- **Sin formulario:** un título de dos palabras y una columna con WhatsApp, teléfono, dirección y
  redes. Para quien solo quiere que lo llamen.
- **Formulario como página:** un pedido con varios campos (fecha, medidas, zona) cuando el pedido
  **es** el negocio (reservas, presupuestos, envíos).

Los datos (número, dirección, horarios) se verifican en la fuente; lo que no se pudo confirmar va
como `{completar}`.

## El pie como cierre de marca

El pie es la última imagen del sitio. Variantes que rinden:

- **Marca que se desborda:** el nombre a ~22vw, cortado por el borde inferior.
- **Paisaje:** el pie apoyado sobre una ilustración o foto a lo ancho (el lugar, el barrio, el
  producto), con las columnas sobre la parte más oscura.
- **Tarjeta flotante:** el pie como una tarjeta redondeada sobre una imagen a sangre.
- **Llamado y pie en uno:** la captura de contacto dentro del pie.

## Patrones que cruzan todas las bandas

- **Encabezado de banda:** etiqueta mono chica → título → (opcional) una línea. Siempre igual.
- **Palabra fantasma:** el nombre de la banda en tamaño gigante y casi transparente, detrás.
- **Una palabra del título en el acento** o en otra voz tipográfica.
- **Tarjeta:** borde de línea, fondo un escalón más alto, esquinas redondeadas; al pasar se eleva
  4 px, el borde se afirma y aparece una sombra del acento.
- **Filtros:** pastillas con scroll horizontal y sin barra; la activa, invertida.
- **Entradas:** `data-aparecer`, con escalonado entre hermanos.

## Para un negocio local (lo aprendido con clientes)

- Celular primero de verdad: poco scroll, formulario corto.
- El contenido se muestra como lo quiere el dueño.
- Si ya existe un sistema de pedidos que funciona, la web le suma marca y cada botón cae ahí.
- Una demo dice arriba que es una demo.
- Marcadores de posición dignos desde el primer día (un dibujo en SVG) hasta que llegan las fotos.

## Se comprueba

- [ ] Cada banda tiene **un** mensaje y, si corresponde, **un** botón
- [ ] El ritmo alterna: no hay dos bandas seguidas con la misma forma
- [ ] En 375 px no hay scroll horizontal ni texto cortado
- [ ] El formulario arma un mensaje que se entiende solo
- [ ] Todos los textos son del negocio: ninguna frase sirve para cualquier otro
