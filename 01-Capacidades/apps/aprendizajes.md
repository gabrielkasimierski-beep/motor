# Apps — aprendizajes de proyectos reales

Sale de Fena Studio (`C:/Claude/Clientes/fena/decisiones.md`) y de Carta Viva
(`C:/Claude/Estudio/carta-viva/README.md` y `decisiones.md`). No se inventa: cada punto tiene su origen.

## El patrón que repetimos

**App estática (HTML + CSS + JS sin compilar) + Supabase (Postgres), sin Next.js.** Se publica en
Netlify. Es Carril B por la *función* (algo que el estático no puede hacer), pero sin sumar un
servidor que no hace falta.

| Pieza | Qué se usa | Por qué |
|---|---|---|
| Frente | HTML + CSS + JS vanilla | Sin build, carga rápido, se hostea gratis |
| Base | Supabase (Postgres) | Hace cumplir las reglas aunque alguien toque la pantalla |
| Hosting | Netlify | Gratis, HTTPS incluido |
| Costo fijo | **$0** con un cliente | Supabase gratis + Netlify gratis |

Por qué no Next.js en Vercel: suma un servidor que no hace falta y Vercel para uso comercial cuesta
USD 20 por mes (decisión de Fena). Por qué no Calendly / Cal.com: para varios barberos piden plan
pago por persona, se ve genérico y no hay panel propio.

⚠️ Supabase gratis **pausa el proyecto si pasa 7 días sin uso**. Con uso diario no pasa; si se
pausa mientras se prueba, se reactiva con un botón.

## Reglas que viven en la base, no en la pantalla

- **Anti-superposición de turnos:** una regla de la base impide dos turnos para el mismo barbero
  en el mismo horario, aunque dos personas toquen "Reservar" en el mismo segundo. Probado en un
  Postgres real antes de entregar (44 casos en Fena).
- **La validación completa vive en funciones de la base** (horario, anticipación, límite por
  celular). La pantalla es una comodidad, no la defensa.
- **El celular nunca manda un precio:** en Carta Viva los precios los calcula la base.
- **Las tablas no se leen directo:** todo pasa por funciones que controlan quién puede qué.
- **Seña con Mercado Pago (Fena, 6-oct-2026):** el turno se crea recién cuando el pago quedó
  aprobado; el webhook le pregunta a MP el estado real y confirma de forma idempotente. La clave de
  MP la cargan Gaby/el cliente en los Secrets, nunca va en el código ni por chat.
- Si dos tocan lo mismo a la vez, vale el primero; todo queda firmado.

## Roles y permisos

- **Cada persona del equipo entra con su usuario (Fena) o su PIN de 4 números (Carta Viva)** y ve
  solo lo suyo. Lo hace cumplir la base (permisos por fila), no solo la pantalla.
- Fena: un admin (el dueño) que crea los usuarios; cada barbero ve solo sus turnos.
- Carta Viva: puestos con permisos de entrada (Dueño/a, Encargado/a, Mozo/a, Cocina, Barra, Caja),
  ajustables persona por persona; el PIN se muestra una sola vez; se traba a los 5 intentos.

## Carta Viva: lo que enseñó

- **QR por mesa con código secreto:** nadie puede pedir "desde la mesa 12" sin estar ahí.
- **Un solo pedido por mesa**, varios celulares a la vez, en tiempo real (Realtime de Supabase).
- **Cocina y barra por separado:** cada ronda se parte por estación y avanza sola.
- **El mozo no ve la cocina:** le aparece "¡Sale! Mesa 9" cuando está listo.
- **Club de fidelización sin contraseña:** mail + código de 6 números (Supabase Auth), sellos,
  premio, saludo al volver. Datos personales según Ley 25.326: se dice qué se guarda, las promos
  son aparte y cada uno borra su cuenta.
- **Pensar para las horas pico:** "Para hacer ahora", sonidos distintos, deshacer durante 20 s,
  pantalla que no se apaga, botones grandes.
- **Una demo que guarda todo en el navegador necesita un modo "pausa"** si nadie la mira, o las
  horas se mezclan al volver.

## Cómo se reusa (productos para revender)

**Lo propio del cliente va aislado en un archivo de datos**, para poder revender el mismo producto:
- Fena: `app/assets/negocio.js` + los datos iniciales de `supabase/esquema.sql`. Otra barbería,
  peluquería o centro de estética = cambiar esos dos archivos, el wordmark y la paleta.
- Carta Viva: `app/assets/local.js` (carta, precios, mesas, equipo, club). Después `npm run semilla`
  para que la base tenga lo mismo. Varios locales desde el día 1 (cada tabla lleva `local_id`).

## Vista previa vs. publicada

Mientras la app no tiene los datos de Supabase anda en **vista previa**: guarda en el dispositivo,
avisa arriba "Vista previa" y trae datos de ejemplo marcados como tales. Con la base conectada no
hay ejemplos ni aviso.

## Costos

Un cliente: Supabase gratis + Netlify gratis = $0 fijo. Los mails (club): Resend, gratis hasta unos
3.000 por mes. Varios clientes: Supabase Pro (~USD 25/mes), y Netlify Pro (~USD 19/mes) si hace
falta. Aproximados, a confirmar al contratar.

## Chequeos propios de una app (además de `00-Motor/control-calidad.md`)

- [ ] Las reglas se prueban contra la base real (casos de superposición, permisos, límites).
- [ ] Ningún secreto en el frontend (claves de pago, service key).
- [ ] Vista previa claramente marcada; sin datos de ejemplo cuando se publica.
- [ ] Probado con celulares de verdad, incluido el flujo de mail/código si hay cuenta.
- [ ] `{completar: chequeos de accesibilidad y offline específicos de apps}`
