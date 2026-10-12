---
name: buscar-clientes
description: >-
  Busca empresas reales que necesiten una web y que la puedan pagar: elige rubro y zona,
  junta candidatos de Google Maps, directorios, Instagram y la red de Gaby, les hace un
  pre-diagnóstico en tanda, los puntúa y los anota en el embudo con el próximo paso. Usar
  cuando Gaby diga "buscame clientes", "buscá empresas de X en Y", "a quién le puedo
  vender", "armá una lista de prospectos", "quiero salir a vender" o "qué rubros convienen".
---

# Buscar clientes

**Leé primero:** [`MOTOR.md`](../../../MOTOR.md) · [`rubros.md`](rubros.md) ·
[`04-Prospectos/embudo.md`](C:/Claude/Estudio/04-Prospectos/embudo.md) (para no repetir a nadie).

---

## La idea

No se buscan "empresas". Se buscan **empresas con un hueco que sabemos tapar, con plata para
pagarlo y a las que podemos llegar**. Diez bien elegidas valen más que doscientas sacadas de
un directorio: a cada una le va a llegar un diagnóstico hecho a mano y un mensaje escrito
para ella.

---

## Reglas (legales y de sentido común)

1. **Solo datos públicos de la empresa**, los que publica para que la contacten: nombre
   comercial, rubro, dirección del local, web, redes, teléfono, WhatsApp o mail de atención.
   **Nada de datos personales** de dueños o empleados: ni celulares personales, ni
   documentos, ni domicilios, ni perfiles personales. Si el negocio es un profesional
   independiente, solo sus canales profesionales.
2. **Nada de bases compradas, extracción masiva ni envíos masivos.** Se busca de a pocos y
   se contacta de a uno.
3. **No se llama en frío.** El Registro Nacional No Llame (Ley 26.951) protege también a las
   empresas. El primer contacto es por escrito o en persona, y siempre lleva algo útil.
4. **Mirar, no tocar:** en Instagram y en Google no se sigue, no se da like y no se escribe
   desde ninguna cuenta. Los mensajes los manda Gaby, a mano.
5. **Un "no" es para siempre:** estado `no contactar`. Y como máximo 2 mensajes sin respuesta.
6. **Sin conflicto:** no se prospecta al competidor directo de un cliente activo en su misma
   zona sin avisarle antes a Gaby.
7. **El embudo es interno.** `04-Prospectos/` no se publica ni se comparte.
8. **Nunca tocar "Visitar sitio" en un anuncio** ("Patrocinado") de Google o de Maps: cada
   clic le cuesta plata a la empresa. La web se saca de su ficha o del buscador.

---

## Atajo: buscar por error (cuando Gaby pide "un comercio caro con un problema")

Se invierte el orden: primero se buscan los errores y después se elige a quién.

1. Juntar **30 webs o más** de rubros de ticket alto (ver *Comercios de ticket alto* en
   `rubros.md`) con WebSearch: `showroom <rubro> Buenos Aires`, `fábrica <rubro> venta`.
2. Pasarlas todas juntas por `diagnostico.js --rapido`.
3. Mirar primero **los errores que cortan ventas**, en este orden: dominio vencido · tienda
   suspendida o cerrada · WhatsApp mal escrito · certificado roto o sin candado · "noindex"
   o robots.txt que tapa a Google · web caída · productos a $0.
4. **Verificar a mano** los 3 o 4 mejores: el link exacto, en qué botón está, la fecha del
   registro. Y buscar su ficha de Google para medir la capacidad.
5. Elegir **uno**: el error más grave y más seguro, en el comercio que más vende. Correr
   `diagnostico-digital` sobre ese. Los demás van al embudo con su error anotado.

*Primera vez (13-sep-2026): 33 webs → 2 dominios vencidos, 1 tienda suspendida, 1 WhatsApp
sin código de país, 1 certificado roto y 2 webs sin candado.*

---

## Modo automático (la búsqueda programada)

Corre sola de lunes a viernes a las 9:00. Cada vez:
1. Toma el **primer nicho `pendiente`** de [`04-Prospectos/cola-nichos.md`](C:/Claude/Estudio/04-Prospectos/cola-nichos.md)
   y lo pasa a `en curso`.
2. Hace los pasos 2 a 5 con **30 a 40 candidatos**, con WebSearch, cámaras, ferias, parques
   industriales y `diagnostico.js --rapido`. Google Maps
   sin cuenta muestra muy poco: se usa para abrir fichas puntuales, no para listar.
3. Anota todo en el embudo (paso 6.1), marca el nicho `hecho` con la fecha y, si en la
   búsqueda apareció un rubro o una zona que promete, lo agrega **al final** de la cola.
4. Deja el informe en `04-Prospectos/informes/<aaaa-mm-dd>.md`: los A con una línea cada uno,
   qué aprendió del rubro y qué nicho sigue.
5. Lee todos los informes anteriores y reescribe `04-Prospectos/informes/analisis.md`:
   rendimiento por rubro, top 5 del embudo para diagnosticar, patrones de hueco y de
   presupuesto, seguimientos vencidos y recomendación. Reordena los `pendiente` de la cola
   según lo que rinde; los cambios a `rubros.md` solo los propone.
6. Para los mejores A con canal escrito público (**hasta 15 por tanda, máximo 20 mensajes por día en total**, decisión de Gaby del 25-sep-2026) deja escrito el primer mensaje con WEBI (molde de `diagnostico-digital/mensajes.md`) y, si publican un mail que recibe correo (MX verificado), un **borrador** en Gmail.
7. **No envía nada ni hace diagnósticos completos.** Los mensajes los manda Gaby, de a uno.

Si la cola se vacía, arma 5 nichos nuevos con la *Liga grande* de `rubros.md`.

## Paso 1 — Elegir el nicho: rubro × zona

- Si Gaby dijo rubro y zona, se usa eso.
- Si no: el primer rubro **A** de `rubros.md` que no figure en la tabla *Nichos buscados*
  del embudo, **empezando por la red tibia** (la de Charlie y el barrio). No se le pregunta
  a Gaby antes: se le dice cuál se eligió en el mensaje final.
- **La zona depende de a quién se le vende** (desde el 24-sep-2026 se busca en todo el país):
  - **Locales a la calle** (venden al público): zona chica, un barrio o un corredor comercial
    (Warnes, Av. San Martín, el polo textil de Once), porque se va en persona.
  - **Empresas B2B** (la Liga grande): un **polo, parque industrial o ciudad** — CABA, GBA
    (San Martín, Pilar, Avellaneda…) o el Interior (Rafaela, Córdoba, Rosario, Mendoza,
    Neuquén…). La venta es por mail y videollamada; la distancia casi no importa.
  - **Rotar regiones:** CABA → GBA → Interior. Nunca dos tandas seguidas en la misma región,
    así el embudo no se llena de un solo lado.

## Paso 2 — Juntar candidatos (15 a 25 a mano · 30 a 40 en modo automático)

| Fuente | Cómo | Qué da | Ojo |
|---|---|---|---|
| **Red tibia** | Lo que conoce Gaby: clientes y proveedores de Charlie, el barrio | Contacto con presentación | **Siempre primero.** Es la que más cierra. |
| **Google Maps** | Navegador: `https://www.google.com/maps/search/<rubro>+<zona>` | Nombre, rubro, dirección, teléfono, puntaje | Sin cuenta es una **vista limitada** (unos 7 resultados): repetir con sinónimos del rubro y barrios vecinos. **Si en la lista no aparece el botón "Sitio web", la ficha no tiene web cargada: señal de hueco.** Con nombre + dirección, Maps abre la ficha directo (web, teléfono, reseñas). Los **"Patrocinado"** pagan publicidad: tienen presupuesto y ya invierten en conseguir clientes. |
| **Directorios del rubro** | WebSearch `<rubro> <zona> directorio` o `guía` | Listas de locales | Muchos cargan la lista con JavaScript: abrirlos en el navegador, no con WebFetch. |
| **Buscador** | WebSearch `<rubro> en <zona>` · `site:instagram.com <rubro> <zona>` | Webs e Instagram | |
| **Mercado Libre** | Vendedores con local en la zona | Venden online pero no tienen web propia | |
| **Cámaras y ferias** | Socios de la cámara del rubro, expositores de ferias | Empresas medianas B2B | **La mejor fuente para B2B.** Cámaras nacionales (ADIMRA, CAIP, CAFMA, COPAL) y regionales (Cámara de Industriales de Rafaela, de Córdoba, de Rosario); ferias (Expoagro, AgroActiva, FIT, Emi, Expo Alimentaria). Las listas de expositores traen la web. |
| **Parques industriales** | WebSearch `parque industrial <ciudad> empresas radicadas` | Listas de fábricas con planta propia | Muchos municipios publican la lista con links. |
| **Guías industriales** | `portal-industrial.com.ar`, `kompass`, `licuo`, `miguiaargentina`, `argentino.com.ar` | Nombre, dirección, teléfono | **Casi nunca traen la web ni el mail**: la web hay que buscarla aparte, una por una. Sirven para listar, no para puntuar. |

De cada candidato se anota solo: nombre, rubro, dirección, web, Instagram, puntaje y
cantidad de reseñas en Google, y el canal de contacto público. **El mail de contacto se saca de
su propia web** (página de contacto o pie): `curl -sL <web> | grep -oE "[a-z0-9._-]+@[a-z0-9.-]+"`.
Solo mails de la empresa (info@, ventas@, o el que publica como de atención), nunca uno personal.

## Paso 3 — Descartar rápido

Afuera sin gastar más tiempo:
- **Cadenas, franquicias y concesionarios oficiales de marca:** la web la decide la casa central.
- Cerrados, o sin ningún canal de contacto escrito.
- Los que ya están en `embudo.md`.
- Los de prioridad C de `rubros.md`, salvo que Gaby los haya pedido.

## Paso 4 — Pre-diagnóstico en tanda (5 minutos para todos)

1. Conseguir la web de cada uno: ficha de Maps, bio de Instagram o buscador.
2. Correr todas juntas:
   ```
   node C:/Claude/Motor/01-Capacidades/web/plantillas/herramientas/diagnostico.js --rapido dominio1 dominio2 dominio3 ...
   ```
   Devuelve una tabla con el **hueco** de cada web: 0 = está bien · 3 = rota, libre o sin candado.
3. **Sin web:** hueco 3 si el Instagram o la ficha de Google están activos (hay negocio y no
   hay web). Si no hay nada activo, sospechar que cerró.
4. Instagram y Google, solo de pasada y solo si hace falta para el puntaje. El análisis
   fino es trabajo de `diagnostico-digital`.
5. **Verificar antes de usar un hallazgo grave en un mensaje.** Si la herramienta dice
   "dominio no registrado" o "no carga", confirmarlo con `nslookup <dominio>` y buscando si la
   empresa se mudó a otra web (pasó con Plasti Sur: la vieja redirigía a una nueva). Un
   hallazgo falso en el primer mensaje quema al prospecto.

## Paso 5 — Puntaje (de 0 a 3 cada criterio, total sobre 12)

| Criterio | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Hueco:** qué tan mal está su presencia | Web moderna y completa | Detalles | Web vieja, no se ve en celular o sin WhatsApp | Sin web, web rota, dominio libre o sin candado |
| **Capacidad:** ¿puede pagar? | Sin señales | Local chico, pocas reseñas | Local a la calle, más de 30 reseñas o varios años | Varias sucursales, flota, vende a empresas, publicidad paga o más de 100 reseñas |
| **Acceso:** ¿cómo llegamos? | Sin canal escrito | Canal escrito público | Local a la calle para ir en persona, Instagram activo, o **mail de empresa publicado en su web** | Presentación de un conocido |
| **Encaje:** ¿le sirve lo que vendemos? | Necesita otra cosa (tienda grande, sistema) | Poco | Servicios que se consultan | Catálogo o servicios para empresas que se venden por consulta: paquete Completo |

**Prioridad:** 9 a 12 **y Hueco 2 o 3 y Capacidad 2 o 3** = **A**, diagnóstico ya · 6 a 8,
Hueco 0 o 1, o Capacidad 0 o 1 = **B**, próxima tanda · 0 a 5 = **C**, se guarda. Sin hueco
no hay nada que vender, por más plata que tengan; y sin plata no hay a quién venderle, por
más grande que sea el hueco (lección de las barberías, 24-sep-2026).

**Encaje en comercios con cientos de productos** (iluminación, ferretería, repuestos): si ya
venden con Tiendanube y la tienda anda, Encaje 2 como mucho. El hueco está en los que no
tienen web o en los especializados, que venden por consulta.

Las señales de capacidad salen de lo que se ve (reseñas, local, flota, publicidad).
**Nunca se estima la facturación de nadie.**

## Paso 6 — La salida

1. Agregar el nicho a *Nichos buscados* y cada candidato a *Prospectos* en `embudo.md`.
2. Correr `diagnostico-digital` sobre los **3 primeros A** (si Gaby no pidió otra cosa).
3. Un mensaje a Gaby: cuántos se encontraron, cuántos quedaron A, B y C, los 3 elegidos con
   una línea cada uno (*"sin web, 180 reseñas, a dos cuadras de Charlie"*) y qué nicho sigue.
   Nada más.

---

## El embudo y el seguimiento

**Estados:** `nuevo` → `diagnosticado` → `contactado` → `respondió` → `reunión` →
`propuesta` → `ganado` · `perdido` · `frío` · `no contactar`

- **Cada fila tiene próximo paso y fecha.** Una fila sin próximo paso es un prospecto perdido.
- `contactado` sin respuesta en 5 días hábiles → **un** seguimiento (ver
  `diagnostico-digital/mensajes.md`).
- Sin respuesta al seguimiento → `frío`. Se retoma en 3 meses **solo si hay una novedad real**.
- `ganado` → se crea el proyecto del cliente (`C:/Claude/Motor/02-Plantilla-cliente/nuevo-cliente.ps1`,
  queda en `C:/Claude/Clientes/`) y arranca `brief-cliente`.

**Qué se mide:** diagnósticos → respuestas → charlas → propuestas → ganados, por rubro. No se
promete ninguna tasa de antemano: después de los primeros 30 contactos se mira qué rubro y
qué canal responden, y se ajusta `rubros.md` con datos propios.
