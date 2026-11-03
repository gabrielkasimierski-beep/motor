# Motor Cliente nuevo

Es el cerebro del estudio de **Gabriel "Gaby" Kasimierski** para **resolverle el problema digital a
cualquier negocio** y cobrarlo: una web, una app, 3D y animación, o diseño gráfico. Cada proyecto de
cliente lo importa y lo lee **antes de cualquier tarea**, para que todo salga coherente sin importar
quién sea el cliente. Si algo cambia (el proceso, las capacidades, el stack), se cambia acá.

> Este archivo **no contiene datos de ningún cliente**, a propósito: lo leen todos.

---

## Dónde vive cada cosa (los tres niveles)

```
NIVEL 1 · USUARIO   C:\Users\PACO\.claude\          lo ven TODOS los proyectos de la máquina
                    CLAUDE.md global: quién es Gaby, cómo se le habla. Nada de negocio.

NIVEL 2 · MOTOR     C:\Claude\Motor\                lo ven solo los proyectos de clientes
                    MOTOR.md · 00-Motor/ (método) · 01-Capacidades/ (qué ofrecemos, crece)
                    02-Plantilla-cliente/ · 03-Comercial/ (precios) · 04-Accesos/ (tokens)
                    plugin/ → las skills y el agente "Motor Cliente nuevo"

NIVEL 3 · CLIENTES  C:\Claude\Clientes\<cliente>\   un proyecto por cliente, con SU identidad
                    CLAUDE.md · identidad/ · .env · brief · análisis · propuesta · sitio|app
```

Aparte de los clientes, cada persona puede tener su **Estudio** (por convención, `C:\Claude\Estudio`): el
espacio de prospección (`04-Prospectos/`) y de los productos propios, como Carta Viva. No es un cliente, y las
skills `buscar-clientes` y `diagnostico-digital` se usan desde ahí.

### Un proyecto, un cliente

- Cada cliente es su propio proyecto: tiene su **memoria**, su `CLAUDE.md`, su `.env` y sus permisos.
- Los permisos de un cliente **bloquean** leer o escribir en los otros clientes y en las carpetas privadas que
  cada persona declare en `02-Plantilla-cliente/bloqueos-locales.txt` (`permissions.deny`, lo regenera
  `nuevo-cliente.ps1`).
- **Lo que se aprende sube al Motor sin datos del cliente.** Lo propio de un cliente (marca, voz,
  precios, decisiones, contactos) no sale de su carpeta.
- Las skills trabajan en la carpeta donde estás parado. En un cliente, esa es la raíz de su proyecto:
  `brief.md`, `analisis.md`, `sitio/`, etc., sin prefijos.

---

## Norte

Hay dos, y en este orden:

**1. Que lo que construimos le traiga consultas y ventas reales al cliente.**
No "que quede lindo". Lindo lo hace cualquiera. Una web, una app o una pieza que se ve
espectacular y no genera ni un mensaje es un fracaso caro. Cada decisión se juzga con una
pregunta: *¿esto acerca a que alguien levante el teléfono?*

**2. Que el cliente pague, vuelva y recomiende.**
El ingreso grande no está en lo que se cobra una vez: está en el **mantenimiento mensual** y en el
cliente que trae a otro. Eso solo pasa si el punto 1 se cumple.

Todo lo demás (animaciones, tecnología, cantidad de páginas) es medio, nunca objetivo.

---

## El embudo

El detalle completo vive en [`00-Motor/embudo.md`](00-Motor/embudo.md). Resumen:

```
BUSCAR empresas con un hueco -> DIAGNÓSTICO (interno) -> Primer contacto (Gaby, de a uno) -> Charla
  -> CLIENTE NUEVO: contexto + auditoría        <- skill `cliente-nuevo`
    -> MAPA DE OPORTUNIDADES (analisis.md)
      -> PRIMER PROTOTIPO para mostrar           <- el quick win de mayor impacto, tocable
        -> MOSTRAR + feedback -> PROFUNDIZAR
          -> BRIEF -> PROPUESTA + precio -> Seña / OK
            -> CONSTRUCCIÓN -> REVISIÓN (1 ronda) -> PUBLICACIÓN + entrega
              -> MANTENIMIENTO mensual (la plata que se repite) -> REFERIDO
```

**Dónde se pierden los negocios, en orden:**
1. **Esperar a que aparezca el cliente.** Por eso existen `buscar-clientes` y el diagnóstico: se sale
   a buscar con un hallazgo útil y se ofrece una propuesta concreta (no se ofrece "diagnóstico gratis").
2. **Mostrar un PDF en vez de un prototipo que se toca.** El prototipo vende; el documento confirma.
3. **Brief flojo** → se construye lo que no era, hay retrabajo, se come la ganancia.
4. **Ida y vuelta infinito** → se pactan **rondas de revisión**, no cambios ilimitados.
5. **El cliente nunca manda el material** (textos, fotos, logo) → la obra queda a medias. Por eso el
   agente **escribe los textos** y usa placeholders profesionales desde el día 1.
6. **Se entrega y chau** → sin mantenimiento no hay negocio, hay changas.

---

## Qué le podemos ofrecer a un cliente

La fuente es el **menú de capacidades**: [`01-Capacidades/README.md`](01-Capacidades/README.md). Crece a
medida que aprendemos; el detalle y los casos viven en cada carpeta.

- **Web** — landing, institucional, catálogo con filtros, blog y SIEMPRE formulario a mail + WhatsApp.
  Línea madura: tiene proceso, precios y plantillas. Cuando el sitio lleva **movimiento** (un producto
  que gira con el scroll, video de portada, fondos vivos, 3D en la página) se usa el **kit webi**:
  [`01-Capacidades/web/webi/`](01-Capacidades/web/webi/README.md), con sus skills (`dirigir-sitio` es la entrada).
- **Apps** — turnos y reservas con QR, carta digital con pedidos desde la mesa, clubes de fidelización,
  paneles por rol. Patrón propio: app estática + Supabase, sin Next.js, costo fijo $0.
- **3D y animación** — platos y productos que giran con el dedo, recortes de foto real, producto en AR
  sobre la mesa, video. Es el diferencial. **En formación:** Gaby estudia para mejorarlo (bitácora en
  `01-Capacidades/3d-animacion/por-estudiar.md`).
- **Diseño gráfico** — logo e identidad, placas, cartas impresas, señalética. **Todavía sin proceso ni
  precio**: se formaliza con el primer caso real.

**Cuánto sale todo:** [`03-Comercial/precios.md`](03-Comercial/precios.md). Es la única fuente de
precios; los números no se copian a otros archivos. **Mantenimiento mensual:** se ofrece siempre, en
la misma propuesta.

**Los carriles técnicos:** primero se decide el **tipo de trabajo** y después el stack
([`00-Motor/decidir-trabajo.md`](00-Motor/decidir-trabajo.md)). Para web y app: **Carril A** (estático,
por defecto, el 80 % de los casos) o **Carril B** (cuando el estático no alcanza).

> **Nunca se elige Carril B porque suena más profesional.** Se elige porque hay una función que el
> estático no puede hacer. Si no la podés nombrar en una frase, es Carril A.

---

## Reglas duras

1. **Los precios salen de la grilla** (`03-Comercial/precios.md`), que aprueba Gaby. Nunca de memoria ni
   inventados. Ningún precio le llega a un cliente sin que Gaby lo haya visto.
2. **Nunca prometer plazos sin consultarle a Gaby.** El agente construye rápido; la revisión del cliente no.
3. **Nunca publicar ni mandar nada al cliente —ni a un prospecto— sin que Gaby lo apruebe.** El agente
   construye y deja listo; **manda Gaby**.
4. **Nunca inventar datos de la empresa del cliente** (años de trayectoria, obras, certificaciones,
   testimonios). Si no está en el brief, va como `{completar: ...}` bien visible. Un dato falso es un
   problema legal del cliente y de reputación nuestro.
5. **Nunca copiar textos ni imágenes de la competencia.**
6. **Los accesos del cliente (hosting, dominio, mail, redes) los carga él**, o te invita a su cuenta. Los
   tokens van en el `.env` del cliente o en las variables de entorno del estudio: **nunca en un `.md`,
   nunca en el chat, nunca en el código.** Ver `04-Accesos/`.
7. **Un proyecto, un cliente.** Todo el trabajo de un cliente vive en la carpeta de su proyecto; los
   prospectos, en el Estudio (`04-Prospectos/<empresa>/`). Nunca se lee ni se usa un dato de otro cliente.
8. **Mobile primero, literal.** Se diseña y se revisa primero en 390 px de ancho.
9. **Accesibilidad y velocidad no son opcionales:** contraste real, textos alternativos, nada que pese de más.
10. **Cada trabajo tiene que verse distinto.** El sistema es combinatorio, no un molde. Ver
    `01-Capacidades/web/sistema-diseno.md`. Si tres clientes reciben lo mismo con otro color, el negocio
    se muere solo.
11. **Prospectar con respeto.** Solo datos públicos de empresas, nada de datos personales, sin envíos
    masivos ni llamadas en frío, y un "no" es para siempre. Ver `buscar-clientes`.
12. **Una demo se presenta como demo.** Nunca se muestra una demo como cliente real.
13. **Primer prototipo antes que propuesta larga.** A un cliente nuevo se le muestra algo que se toca
    (aunque sea el quick win), no un PDF de 10 páginas.
14. **Código de afuera, con guardián.** Ninguna skill, repo o kit de terceros entra al Motor ni a un
    cliente sin pasar por el agente `motor-guardian` (`herramientas/repo_guard.py`): se audita en
    cuarentena, Gaby aprueba el **hash exacto**, se vendoriza ese commit con su `PROVENANCE.json` y
    nunca se ejecuta el repo. Se fija el commit, no la rama.

---

## Cómo se trabaja (el ciclo completo)

| # | Etapa | Skill | Sale de acá |
|---|---|---|---|
| 0 | Buscar prospectos (en el Estudio) | `buscar-clientes` | filas en `04-Prospectos/embudo.md` |
| 0b | Diagnóstico (interno) | `diagnostico-digital` | hallazgos + mensaje de contacto |
| 1 | **Cliente nuevo: contexto + mapa** | **`cliente-nuevo`** | `analisis.md` en el proyecto del cliente |
| 2 | Primer prototipo para mostrar | `construir-web` (u otra capacidad; con movimiento, `dirigir-sitio`) | demo tocable del quick win |
| 3 | Brief | `brief-cliente` | `brief.md` |
| 4 | Propuesta + precio | `propuesta-comercial` | `propuesta.md` con precios de la grilla |
| 5 | Construir | `construir-web` | `sitio/` o `app/` andando |
| 6 | Publicar y entregar | `publicar-web` | URL en vivo + `entrega.md` |

**`cliente-nuevo` es la puerta de entrada**: ante un cliente nuevo se arranca por ahí. Cada skill lee
este archivo primero. Si una skill contradice al MOTOR.md, manda el MOTOR.md.

Un cliente nuevo se crea con `02-Plantilla-cliente/nuevo-cliente.ps1` (ver su README): deja su carpeta con un
`00-ARRANQUE.md` listo para completar, que es el pedido de arranque de `cliente-nuevo`.

---

## Con Gaby

Español rioplatense, directo. **No se le narra el trabajo paso a paso:** se trabaja en silencio y se le
habla cuando hace falta una decisión o al terminar, con un solo resumen. Las preguntas, juntas y cortas
(que se puedan responder desde el celular). Ahorrar tokens.

---

## Estado y pendientes

La historia del Motor está en [`00-Motor/historial.md`](00-Motor/historial.md).

**Pendientes de Gaby:**
- [ ] Completar `03-Comercial/estudio.md`: nombre del estudio, WhatsApp, mail, color y condición fiscal.
- [ ] Aprobar o ajustar la grilla de `03-Comercial/precios.md`.
- [ ] Definir a qué mail llegan los formularios (o si cada cliente pone el suyo).
- [ ] Completar `04-Accesos/inventario.md` (qué sesión o variable usa cada cuenta).
- [ ] Definir proceso y precio de **diseño gráfico** cuando aparezca el primer caso.
