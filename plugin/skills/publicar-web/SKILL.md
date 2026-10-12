---
name: publicar-web
description: >-
  Publica la web terminada y la entrega al cliente: revisión final, subida a Netlify o
  Vercel, conexión del dominio, mail y formularios andando, analítica, y el documento de
  entrega con accesos y manual de uso. Usar cuando Gaby diga "publicá la web", "subila",
  "está lista para entregar", "conectá el dominio", "pasala a producción" o pregunte cómo
  se pone online un sitio.
---

# Publicar y entregar

Habilidad #3 del Motor Cliente nuevo. Es donde el trabajo se convierte en un cliente contento (o en
un reclamo dos días después de cobrar).

**Leé primero:** [`MOTOR.md`](../../../MOTOR.md) y
[`00-Motor/control-calidad.md`](../../../00-Motor/control-calidad.md).

---

## Regla dura antes que nada

> **El agente no publica nada por su cuenta. Prepara todo y Gaby aprueba y da la orden.**

Publicar es un acto público e irreversible: sale con el nombre del cliente y con el nuestro.
Se pide OK explícito, siempre, aunque parezca obvio.

---

## Paso 1 — Revisión final (obligatoria)

Correr **entera** la lista de `control-calidad.md`. Ningún ítem en ❌.
En especial, las tres que generan el 90 % de los reclamos:
- [ ] **El formulario llega de verdad al mail.** Probado con un envío real.
- [ ] **Todos los WhatsApp abren** con el mensaje correcto.
- [ ] **Ningún `{completar}` quedó en el sitio.** Buscarlo en todos los archivos.

---

## Paso 2 — Dónde se publica

### Netlify (el más simple)
1. netlify.com → *Add new site* → *Deploy manually*
2. Arrastrar la carpeta `sitio/`. Queda online en segundos con HTTPS.
3. Si el formulario usa Netlify Forms, activarlo en *Forms* y poner el mail de aviso.
4. *Site settings → Change site name* → algo prolijo (`vulcano-equipamiento`).

### Vercel
Sirve igual y hay conexión directa desde acá. Igual: **la orden la da Gaby**.

**A nombre de quién queda la cuenta:** siempre conviene que el sitio viva en una cuenta de
Gaby y que el **dominio esté a nombre del cliente**. Así el cliente nunca queda rehén, y
nosotros mantenemos el control técnico mientras dure el mantenimiento.

---

## Paso 3 — El dominio

| Situación | Qué se hace |
|---|---|
| **Ya tiene dominio** | Se le pide que agregue los DNS que indica Netlify/Vercel. Se le manda el paso a paso con capturas. **No pedirle la contraseña del registrador.** |
| **No tiene** | Se cotiza y **lo compra el cliente a su nombre** (nic.ar para `.com.ar`, o Namecheap/Google Domains para `.com`). Si prefiere que lo compremos nosotros, se le factura aparte y queda documentado que es de él. |
| **Mientras tanto** | Se entrega con el subdominio gratis (`cliente.netlify.app`) para que lo vea y apruebe. |

⚠️ Los DNS tardan **de 10 minutos a 24 horas** en propagar. Avisarlo antes, no después.

---

## Paso 4 — Lo que se enchufa al final

- [ ] **Analítica** (GA4 o Plausible) — sin esto no hay reporte mensual y sin reporte no hay mantenimiento.
- [ ] **Google Search Console** + `sitemap.xml` enviado → para que Google la indexe.
- [ ] **Perfil de Google Empresa** conectado con la web (es lo que más consultas trae a una
      PyME local, más que la web misma). Si el cliente no lo tiene, es una venta más.
- [ ] Formularios probados **en producción**, no solo en local.
- [ ] Probar la web publicada **desde un celular real**, con datos móviles.

---

## Paso 5 — El documento de entrega

Se arma `entrega.md` con:

1. **URL** del sitio y del panel de hosting.
2. **Qué se entregó**, contra lo que se cotizó.
3. **Accesos:** qué cuenta es de quién. Sin contraseñas escritas ahí: se pasan por
   invitación o por un canal aparte.
4. **Manual corto:** cómo agregar un producto o una nota (editar `productos.json` /
   `notas.json`), en criollo y con un ejemplo.
5. **Qué NO incluye** y qué se cotiza aparte.
6. **Mantenimiento:** qué cubre, qué no.
7. **Licencias** de fotos o tipografías usadas.

---

## Paso 6 — Que el mantenimiento se venda solo

El mantenimiento no se ofrece "por si acaso": se ofrece **el día de la entrega**, cuando el
cliente está contento. Después es tarde.

Lo que incluye:
- Hosting y dominio al día, backups, actualizaciones
- Cambios chicos (textos, fotos, precios) — hasta 2 o 4 por mes, según el plan
- **1 nota de blog por mes** en el plan Crecimiento (esto es lo que lo hace valer: sin
  contenido nuevo la web se apaga)
- Reporte mensual: visitas, de dónde vienen, cuántas consultas llegaron

> El reporte mensual es lo que hace que el cliente **vea** lo que paga. Sin reporte, a los
> tres meses siente que paga por nada y lo corta.

Planes y precios: Esencial, Crecimiento o A medida, de `03-Comercial/precios.md`.

---

## A los 15 días: el mensaje que trae referidos

Escribirle al cliente preguntando cuántas consultas le llegaron. Sirve para tres cosas:
mostrar que el trabajo funciona, pedirle un testimonio con nombre y empresa, y preguntarle
si conoce a alguien que necesite lo mismo.

**Es la fuente de clientes más barata que existe.** Se hace siempre.
