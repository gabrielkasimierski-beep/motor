# Decidir el trabajo

Gaby definió que **el agente elige qué se hace y con qué tecnología según el cliente**. Para que
eso no se convierta en "cada proyecto es un invento nuevo", se decide con estos árboles.
**No se improvisa.** Primero se decide el **tipo de trabajo** (Paso 0); recién después, si es
web o app, el **stack** (Paso 1).

El menú completo de lo que sabemos hacer está en [`01-Capacidades/README.md`](../01-Capacidades/README.md).

---

## Paso 0 — ¿Qué tipo de trabajo es?

Una frase por criterio. Se pueden combinar varias líneas.

| Si el cliente... | Línea | Carpeta |
|---|---|---|
| Necesita que lo encuentren, que lo contacten o mostrar lo que vende | **Web** | `01-Capacidades/web/` |
| Necesita que sus clientes **hagan algo** (reservar, pedir, sumar puntos) o que su equipo gestione algo en un panel | **App** | `01-Capacidades/apps/` |
| Vende algo que se ve mejor girando, en video o sobre la mesa (platos, productos) | **3D / animación** | `01-Capacidades/3d-animacion/` |
| Tiene la marca floja o inexistente, o necesita piezas gráficas (logo, placas, carta impresa, señalética) | **Diseño gráfico** | `01-Capacidades/diseno-grafico/` |

```
¿Quiere que lo encuentren / lo contacten?              -> WEB
¿Sus clientes tienen que reservar, pedir o loguearse?   -> APP (a veces + web de marca)
¿Su producto gana mucho si se ve girar / en AR?         -> 3D (suele ir sobre una web o app)
¿La marca o sus piezas se ven mal o no existen?         -> DISEÑO (suele ir antes o junto a la web)
¿Varias de las anteriores?                              -> COMBINACIÓN: el primer prototipo sale
                                                           de lo de mayor impacto (ver embudo.md)
```

Ejemplos reales: Charlie = web · Fena = app · Carta Viva = app + 3D · Ginotto = web de marca que
deriva el pedido a otro sistema (fu.do).

Si es **web o app**, seguí con el árbol de abajo. Si es 3D o diseño solo, mirá la carpeta de la
capacidad (hoy tiene aprendizajes y todavía no un proceso cerrado).

---

## Paso 1 — El árbol de stack para web y app (leer de arriba hacia abajo, la primera que da SÍ manda)

```
¿El cliente necesita COBRAR con tarjeta / MercadoPago en la web?
   SÍ -> CARRIL B  (o Tienda Nube / Shopify si es puro e-commerce: no siempre conviene
                    programarlo, a veces es mejor negocio conectar una plataforma)
   NO ↓
¿Necesita que ALGUIEN SE LOGUEE? (clientes, socios, alumnos, zona privada)
   SÍ -> CARRIL B
   NO ↓
¿Tiene MÁS DE ~60 productos, o cambian de precio/stock seguido?
   SÍ -> CARRIL B
   NO ↓
¿Pidió y va a pagar un PANEL para editar los textos él mismo?
   SÍ -> CARRIL B   (o Carril A + Decap CMS, ver abajo)
   NO ↓
¿Necesita TURNOS / RESERVAS con disponibilidad real?
   SÍ -> CARRIL B   (o Carril A + Calendly embebido: más rápido y más barato)
   NO ↓
-> CARRIL A. Siempre.
```

**Regla de oro:** si no podés nombrar en una frase la función que el estático no puede
hacer, es Carril A. El Carril B se cobra más caro porque cuesta más, no porque suene mejor.

---

## Carril A — El estándar de la casa

| Pieza | Qué se usa | Por qué |
|---|---|---|
| Estructura | HTML multi-página, una por sección | Google indexa mejor, el cliente entiende su web |
| Estilos | **Tailwind por CDN** + variables CSS propias | Rápido de escribir, cero build, cero Node |
| Interacción | JavaScript vanilla | Menús, filtros, validación, animación al scroll |
| Contenido | Archivos `JSON` en `/contenido` | Productos y notas separados del diseño. Se edita sin tocar HTML |
| Íconos | SVG inline (Lucide/Heroicons, copiados) | No cargan librerías enteras |
| Tipografías | Google Fonts con `display=swap` | |
| Formulario | **WhatsApp + Web3Forms o Netlify Forms** | Ver abajo |
| Analítica | Google Analytics 4 o Plausible | Para el reporte mensual del mantenimiento |
| Hosting | **Netlify** (arrastrar la carpeta) o **Vercel** | Gratis, HTTPS incluido, dominio propio |

**Si el cliente quiere editar textos sin llegar al Carril B:** se le agrega **Decap CMS**
(gratis, se conecta al repo de GitHub). Es una hora de trabajo y se cobra como extra.

---

## Cómo se resuelve el formulario sin servidor

Toda web nuestra tiene **dos vías de contacto, siempre las dos**:

**1. WhatsApp (la que más funciona en Argentina).**
Link directo con el mensaje ya escrito, así el cliente recibe la consulta ordenada:
```
https://wa.me/54911XXXXXXXX?text=Hola%20{empresa}%2C%20quiero%20consultar%20por%20{producto}
```
Va en: botón flotante, hero, cada ficha de producto y la página de contacto.

**2. Formulario al mail.** Opciones, en orden de preferencia:

| Servicio | Gratis | Cómo se conecta | Cuándo |
|---|---|---|---|
| **Netlify Forms** | 100 envíos/mes | `netlify` en el `<form>` | Si ya se hostea en Netlify. Lo más simple. |
| **Web3Forms** | 250 envíos/mes | Una `access_key` en un campo oculto | Si se hostea en Vercel o donde sea. Sin cuenta del cliente. |
| **Formspree** | 50 envíos/mes | URL en el `action` | Alternativa conocida. |

⚠️ **La access key / el mail de destino los carga Gaby o el cliente, nunca el agente.**
En el código va `{ACCESS_KEY_A_COMPLETAR}` bien visible.

**Anti-spam obligatorio:** campo honeypot oculto (`<input name="_gotcha" hidden>`) — para el
99 % de los bots y no molesta a nadie. Nada de captchas que espantan gente.

---

## Carril B — Cuándo y con qué

Solo si el árbol lo pidió. Stack fijo, no se discute cliente por cliente:

- **Next.js (App Router) + TypeScript + Tailwind**
- **shadcn/ui** para los componentes de base
- **Supabase** o **Vercel Postgres** si hace falta base de datos
- **Sanity** o **Payload** si el cliente edita contenido
- **MercadoPago Checkout Pro** para cobrar (es lo que usan en Argentina, no Stripe)
- Deploy en **Vercel**

✅ **Entorno listo (10-sep-2026):** Node.js **v24.19.0** y npm **11.17.0** instalados en
`C:\Program Files\nodejs`, con acceso al registro de npm verificado. El Carril B se puede
construir sin instalar nada más.

Para arrancar un proyecto nuevo:
```bash
npx create-next-app@latest {cliente} --ts --tailwind --app --eslint
```
⚠️ Si `node` no responde en una terminal recién abierta, es el PATH que todavía no se
refrescó: cerrar y volver a abrir la terminal.

---

## Lo que NO hacemos (aunque el cliente lo pida)

- **WordPress.** Se rompe, se hackea, hay que actualizarlo todos los meses y los plugins lo
  hacen lento. Si el cliente insiste, es un negocio de otro.
- **Wix / Squarespace.** Ahí no aportamos nada: lo puede hacer él.
- Sitios de una sola página infinita cuando el cliente tiene productos de verdad: cada
  producto necesita su URL para que Google lo encuentre.
