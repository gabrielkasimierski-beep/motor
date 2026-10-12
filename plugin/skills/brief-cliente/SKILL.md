---
name: brief-cliente
description: >-
  Releva a un cliente nuevo antes de construirle la web: qué hace la empresa, a quién le
  vende, qué necesita el sitio, qué material tiene y qué hay que decidir. Deja un brief.md
  completo del que después salen la propuesta y la construcción. Usar cuando Gaby diga
  "tengo un cliente nuevo", "arranquemos con X", "me contactó una empresa", "hay que
  cotizar una web", "armá el brief" o pegue lo que le contó un cliente por WhatsApp.
---

# Brief de cliente

Habilidad #1 del Motor Cliente nuevo.

**Leé primero:** [`MOTOR.md`](../../../MOTOR.md) — el Norte, el paquete base y las reglas duras.

---

## Por qué esta skill existe

> **El 90 % de los proyectos que se van de las manos se pierden acá, no construyendo.**

Un brief flojo significa construir lo que no era, rehacerlo gratis y quedarse sin ganancia.
Diez minutos más de preguntas al principio valen tres días de retrabajo.

Y hay algo que casi nadie hace: **un buen brief ya es parte de la venta**. El cliente que
contesta estas preguntas siente que está frente a alguien que sabe, no frente a alguien que
le va a hacer "una páginita".

---

## Cómo se releva

Gaby habla con el cliente (WhatsApp, llamada o reunión). El agente:
0. **Si la empresa viene de `04-Prospectos/`** (el Estudio), crea el proyecto del cliente con
   `C:/Claude/Motor/02-Plantilla-cliente/nuevo-cliente.ps1` (queda en `C:/Claude/Clientes/<cliente>/`),
   copia ahí su `diagnostico.md` y arranca desde él: la investigación de web, Google e Instagram
   ya está hecha, y no se le vuelve a preguntar al cliente lo que ya se sabe.
1. **Le prepara las preguntas** en el orden y el tono de acá abajo, listas para copiar y pegar.
2. **Recibe las respuestas** (aunque vengan desordenadas, en audio transcripto o en chat suelto).
3. **Investiga por su cuenta** lo que se puede: web actual, redes, Google Maps, 2-3 competidores.
4. **Arma `brief.md`** y marca en rojo lo que falta.

**Nunca mandarle al cliente las 30 preguntas juntas.** Se manda en **3 tandas**: si le tirás
un formulario largo, no lo contesta.

---

## Tanda 1 — Lo mínimo para cotizar (7 preguntas)

Con esto ya se puede hacer la propuesta.

1. ¿A qué se dedica la empresa, en una frase como se lo contarías a un vecino?
2. ¿Quién les compra? (empresas, público general, un rubro puntual, una zona)
3. ¿Tienen web hoy? ¿Cuál es? ¿Qué es lo que no les gusta?
4. ¿Qué querés que haga la web? *(que me lleguen consultas · que se vea el catálogo · que
   la empresa se vea seria · vender online)*
5. ¿Cuántos productos o servicios habría que mostrar? ¿Más o menos?
6. ¿Tenés logo, fotos y textos, o hay que armar todo?
7. ¿Para cuándo la necesitás?

## Tanda 2 — Para construirla bien (después del OK)

**Del negocio**
8. ¿Desde cuándo trabajan? ¿Cómo empezó?
9. ¿Qué les dicen los clientes que hacen mejor que el resto?
10. ¿Por qué alguien los elige a ustedes y no al de al lado? *(la respuesta a esta es el hero)*
11. ¿Cuál es la duda o la objeción que más te repiten antes de comprar? *(esto va a las FAQ)*
12. ¿Cuáles son los 5 productos o servicios que más venden?
13. ¿Hay algo que NO hacen y les preguntan todo el tiempo? *(aclararlo ahorra consultas basura)*
14. ¿Zona de cobertura? ¿Hacen envíos?
14b. ¿Cuánto te deja, más o menos, un cliente nuevo? *(con eso la propuesta muestra en
    cuántos clientes se paga la web; si no lo quiere decir, no se insiste)*

**De los contactos**
15. ¿A qué WhatsApp tienen que llegar las consultas?
16. ¿A qué mail?
17. Teléfono fijo, dirección exacta y horarios de atención.
18. Redes sociales que quieran linkear.

**De la competencia y el gusto**
19. Nombrame 2 o 3 competidores.
20. ¿Alguna web (de cualquier rubro) que te guste cómo se ve? ¿Qué te gusta de ella?
21. ¿Hay algún estilo o color que NO quieras ni ver?
22. ¿Tienen colores de marca definidos?

## Tanda 3 — El material (se pide con lista de tareas, no como pregunta abierta)

- [ ] Logo (lo mejor que tengan: `.ai`, `.svg`, `.pdf` o el PNG más grande)
- [ ] Fotos de productos, del local, del equipo, de trabajos hechos
- [ ] Catálogo o lista de precios que ya usen (Excel, PDF, folleto, lo que sea)
- [ ] 3 testimonios de clientes, **con nombre y empresa**
- [ ] Accesos al dominio, si ya tienen uno
- [ ] Certificaciones, matrículas o habilitaciones para mostrar

> **Regla:** no se frena la obra esperando el material. Se construye con placeholders
> profesionales y se reemplaza después. El material que no llega es la causa #3 de proyectos
> que quedan a medio terminar.

---

## Lo que el agente investiga solo (antes de molestar al cliente)

- **La web actual**, si tiene: qué secciones, qué falta, qué se puede reusar, cuánto tarda en cargar.
- **Google Maps**: reseñas (de ahí salen testimonios reales y las objeciones más comunes),
  horarios, dirección, fotos.
- **Redes**: cómo hablan ellos → así se escriben los textos, en su voz y no en la nuestra.
- **2 o 3 competidores**: qué muestran, qué no, dónde hay un hueco para diferenciarse.
  No se copia: **se busca qué hacer distinto**.

---

## El entregable: `brief.md`

Se guarda en `brief.md`, con la plantilla de
[`plantilla-brief.md`](plantilla-brief.md).

Cierra **siempre** con estas tres cosas:

1. **DECISIONES TOMADAS** — carril (A o B) con el motivo en una frase, personalidad de
   diseño, paleta y tipografías propuestas, y el mapa de páginas.
2. **FALTA** — lista de lo que no contestó o no mandó, en orden de urgencia.
3. **LO QUE HAY QUE PREGUNTARLE A GABY** — todo junto, corto, fácil de responder desde el
   celular. Nunca de a una pregunta por mensaje.

---

## Reglas

- **Nunca inventar** un dato del cliente para "completar" el brief. Va `{completar: ...}`.
- **Nunca fijar precio ni plazo** acá: eso es de `propuesta-comercial` y lo define Gaby.
- Si el cliente contesta en audio o desordenado, se ordena en el brief **sin cambiarle las
  palabras propias**: cómo habla él es materia prima para los textos de la web.
- Guardar **textual** las frases buenas que diga el cliente sobre su negocio. Suelen ser
  mejores que cualquier cosa que escribamos nosotros.
