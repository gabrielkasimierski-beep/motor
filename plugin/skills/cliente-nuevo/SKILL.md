---
name: cliente-nuevo
description: >-
  Puerta de entrada para cualquier cliente o negocio nuevo, de cualquier rubro: junta el
  contexto del negocio, audita cómo está hoy (web, Google, Instagram, WhatsApp, gestión,
  material gráfico), lo cruza con el menú de capacidades (web, apps, 3D/animación, diseño
  gráfico) y arma el mapa de oportunidades con un primer prototipo para mostrar. Deja
  analisis.md en la carpeta del cliente y deriva a la skill que sigue. Usar cuando Gaby diga
  "tengo un cliente nuevo", "arranquemos un proyecto nuevo", "me contactó X y quiero ver qué
  le podemos hacer", "armemos el mapa de X", "qué le podemos ofrecer a X" o pegue lo que le
  contó un negocio.
---

# Cliente nuevo (la puerta de entrada)

Orquesta el arranque de un cliente: **no duplica a `diagnostico-digital` ni a `brief-cliente`,
los usa.** Su resultado es un mapa de qué le podemos hacer y un **primer prototipo para
mostrar**, porque a un cliente nuevo primero se le muestra algo que se toca y después se
profundiza.

**Leé primero:** [`MOTOR.md`](../../../MOTOR.md) · [`01-Capacidades/README.md`](../../../01-Capacidades/README.md)
(el menú) · [`00-Motor/embudo.md`](../../../00-Motor/embudo.md) ·
[`00-Motor/decidir-trabajo.md`](../../../00-Motor/decidir-trabajo.md).

---

## Qué hace, en orden

### 0. ¿Dónde estoy parado?
Antes de nada, mirá la carpeta de trabajo:
- **Estoy en el proyecto de un cliente** (hay un `CLAUDE.md` con su identidad y una carpeta
  `identidad/`): seguí. Todo lo que generes va en la **raíz de esta carpeta** (`analisis.md`,
  `brief.md`…), y leé su `CLAUDE.md` e `identidad/` antes de seguir.
- **Estoy en el Estudio u otra carpeta:** el cliente todavía no tiene proyecto. Crealo:
  `powershell -ExecutionPolicy Bypass -File C:/Claude/Motor/02-Plantilla-cliente/nuevo-cliente.ps1 -Nombre "<cliente>" -Rubro "<rubro>"`
  (sumá `-DesdeProspecto "<carpeta>"` si ya había diagnóstico) y avisale a Gaby que abra Claude Code
  en `C:/Claude/Clientes/<cliente>/` para seguir ahí. **No trabajes a un cliente desde otra carpeta:
  se mezclaría con otros.**
- **Si hay un `00-ARRANQUE.md` en la raíz, es el pedido de arranque:** lo que Gaby sabe del cliente (en
  campos o pegado como vino) y lo que te pide. Leelo **entero** antes de seguir. Su sección "Lo que le pido a
  Claude" manda sobre el alcance: **auditoría, `analisis.md`, UN prototipo propuesto, las preguntas que falten
  y frenar** hasta que Gaby elija. Si existe la carpeta `prospecto/`, partí de su `diagnostico.md`.
- Con lo que Gaby cuente, completá `identidad/marca.md` y el bloque "Quién es" del `CLAUDE.md`: solo
  hechos, y lo que falte, como `{completar: ...}`.

### 1. Contexto
Toma lo que Gaby cuente del cliente y su negocio: **rubro, a quién le vende, cómo vende y cómo
capta hoy**. Si falta algo clave, lo pregunta **todo junto en un solo mensaje**, no de a una.
Mínimo para seguir: qué hace, a quién, por dónde le llegan los clientes hoy, y qué le duele.

### 2. Auditoría de hoy
Qué usa el negocio ahora: web y dominio, ficha de Google, Instagram, WhatsApp, sistema de
gestión (turnos, pedidos, facturación), material gráfico (logo, placas, carta). Usa el método y la
herramienta de [`diagnostico-digital`](../diagnostico-digital/SKILL.md):

```
node C:/Claude/Motor/01-Capacidades/web/plantillas/herramientas/diagnostico.js <dominio> --lighthouse --salida .
```

Solo hechos verificados, con evidencia y fecha. Si no se puede comprobar hoy, no va. Solo datos
públicos de la empresa. Si el negocio ya tiene su carpeta en `04-Prospectos/`, se parte de su
`diagnostico.md` y no se repite lo ya relevado.

### 3. Mapa de oportunidades
Cruza contexto + auditoría contra [`01-Capacidades/README.md`](../../../01-Capacidades/README.md) y
arma `analisis.md` (plantilla abajo):

- **Qué le podemos hacer** de las 4 líneas (web, apps, 3D/animación, diseño gráfico), con el
  **impacto de cada cosa en SU negocio** (Norte 1: más consultas o ventas). Sin números inventados:
  se dice lo que pasa, no cuánto cuesta.
- **Prioridad:** **quick win** (lo que se muestra ya, como prototipo) vs **proyecto grande** (lo
  que se profundiza después).
- **El primer prototipo propuesto:** cuál es, **por qué ese** y qué capacidad usa. Sale del quick
  win de mayor impacto: rápido y tocable.
- Si la oportunidad cae en una línea sin proceso ni precio (diseño gráfico) o en formación (3D),
  se anota como **"a definir con Gaby"**, sin prometer precio ni plazo.

### 4. Derivación
Según lo que decida Gaby, **la skill no avanza sola**:

| Si Gaby decide… | Va a |
|---|---|
| Hacer el prototipo | `construir-web` (o la capacidad que corresponda) |
| Auditar fino para el primer contacto | `diagnostico-digital` |
| Profundizar después de mostrar el prototipo | `brief-cliente` y después `propuesta-comercial` |

**La skill NO manda nada al cliente ni promete plazos.** Prepara; **manda Gaby**.

### 5. Reglas
Respeta todas las reglas duras de [`MOTOR.md`](../../../MOTOR.md): no inventar datos (lo que falta
va como `{completar: ...}`), precios solo de `03-Comercial/precios.md`, nunca copiar a la
competencia, todo en la carpeta del proyecto del cliente, **un proyecto un cliente** (nunca leer ni
usar datos de otro) y manda Gaby.

---

## Plantilla de `analisis.md`

```markdown
# Análisis — {Cliente}

**Fecha:** {fecha} · **Estado:** {relevando / mapa listo / prototipo en marcha}

## Quién es
{Qué hace el negocio, rubro, dónde, a quién le vende. Una frase + datos reales.
 Lo que falte: {completar: ...}}

## Cómo vende hoy
{Por dónde le llegan los clientes: WhatsApp, local, Instagram, boca en boca, plataformas.
 Qué le duele hoy.}

## Qué tiene hoy (auditoría)
| Canal | Estado | Evidencia (qué se vio, dónde, cuándo) |
|---|---|---|
| Web y dominio | | |
| Google (ficha) | | |
| Instagram | | |
| WhatsApp | | |
| Gestión (turnos, pedidos, otros) | | |
| Material gráfico (logo, placas, carta) | | |

## Mapa de oportunidades
| Oportunidad | Línea (web / app / 3D / diseño) | Impacto en su negocio | Prioridad (quick win / proyecto grande) |
|---|---|---|---|
| | | | |

## Primer prototipo propuesto
- **Cuál:** {qué se va a mostrar}
- **Por qué ese:** {el quick win de mayor impacto, y por qué}
- **Capacidad que usa:** {línea + carpeta de 01-Capacidades/}
- **Qué se necesita del cliente para hacerlo:** {material, accesos por invitación, datos}

## Próximo paso
{Una acción concreta y quién la hace. Ej: "Gaby decide si hacemos el prototipo" →
 construir-web / brief-cliente.}
```
