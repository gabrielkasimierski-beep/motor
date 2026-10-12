---
name: diagnostico-digital
description: >-
  Arma el diagnóstico gratis de cómo aparece una empresa en internet (web, dominio, Google,
  Instagram, WhatsApp): hallazgos verificados con evidencia, una hoja de una página para
  mandarle a la empresa y la versión interna con la oportunidad de venta y el mensaje de
  primer contacto. Usar cuando Gaby diga "hacé el diagnóstico de X", "revisá la web de X",
  "mirá cómo está X en internet", "tengo un prospecto", "armá el diagnóstico gratis", pegue
  una web, un Instagram o el nombre de una empresa para evaluar, o después de buscar-clientes.
---

# Diagnóstico digital (gratis)

La puerta de entrada del negocio. **No se sale a vender una web: se le muestra a una empresa
un problema que ya tiene y que nadie le dijo.**

**Leé primero:** [`MOTOR.md`](../../../MOTOR.md) ·
[`03-Comercial/estudio.md`](../../../03-Comercial/estudio.md) (la firma) ·
[`03-Comercial/precios.md`](../../../03-Comercial/precios.md) (solo para la parte interna).

---

## Por qué funciona

Con Charlie, lo que más valió no fue la web: fue encontrar que **el link de la bio de
Instagram llevaba a un dominio que no existía**, que ese dominio estaba libre para que lo
comprara cualquiera, y que **un mismo barrio tenía dos precios distintos** en sus propias
placas. A la mayoría de las PyMEs les pasa algo parecido y nadie se los dice.

Un diagnóstico bien hecho:
- **demuestra que miramos en serio**, antes de pedirles nada;
- **les deja algo útil aunque no compren**, y eso hace que respondan;
- **deja escrito, con sus propios datos**, por qué necesitan lo que vendemos.

---

## Reglas que no se rompen

1. **Solo hechos verificados, con evidencia y fecha.** Cada hallazgo dice qué se vio, dónde
   y cuándo. Si no se puede comprobar hoy, no va.
2. **Nunca inventar números de impacto** ("perdés el 40 % de las ventas"). Se dice lo que
   pasa ("el link de la bio lleva a una página que no existe"), no cuánto les cuesta.
   Las únicas cifras son las medidas (segundos de carga, reseñas, fechas), citando la fuente.
3. **Respeto.** Se habla de lo que ve un cliente, no de lo mal que lo hicieron. Nada de
   burlarse de la web vieja ni de quien la hizo: puede ser el hijo del dueño.
4. **Primero lo que tienen bien:** 2 o 3 cosas buenas y reales, arriba de todo.
5. **Máximo 5 hallazgos en la hoja.** El resto queda en la versión interna.
6. **Por lo menos 1 arreglo gratis** que puedan hacer ellos hoy. Regalar algo útil es lo que
   hace que contesten.
7. **Sin precios en la hoja.** El precio aparece en la propuesta, después de una charla.
8. **Solo datos públicos de la empresa:** lo que ve cualquier cliente. Nada de datos
   personales de dueños o empleados, ni de nada que pida usuario y contraseña.
9. **Mirar, no tocar:** en Instagram o Google no se sigue, no se da like y no se escribe
   desde ninguna cuenta.
10. **No se manda nada.** El agente deja todo listo; **manda Gaby**.

---

## El método: las 5 preguntas del cliente de ellos

Se mira la empresa **como la mira un cliente nuevo**, en este orden:

| # | Área | La pregunta | Qué se revisa |
|---|---|---|---|
| 1 | **Los encuentran** | ¿Aparecen cuando los buscan? | Google por nombre y por "rubro + barrio" · ficha de Google Empresa (existe, reseñas, horarios, fotos, web vinculada) · título y descripción de la web |
| 2 | **Se entiende qué hacen** | ¿En 5 segundos se entiende qué hacen y para quién? | Primera pantalla de la web en celular · bio de Instagram · velocidad en celular |
| 3 | **Les pueden escribir** | ¿Es fácil contactarlos? | WhatsApp directo · link de la bio · teléfono que se toca para llamar · formulario · horarios |
| 4 | **Dan confianza** | ¿Parecen serios? | Candado · reseñas y si las responden · fotos reales · **datos que coinciden en todos lados** · mail y dominio propios |
| 5 | **Están al día** | ¿Parece que alguien atiende? | Última publicación · © del pie · dominio por vencer · novedades · medición de visitas |

Cada área cierra con un semáforo **Bien · Mejorable · Urgente**, siempre escrito con
palabras, nunca solo con el color.

---

## Paso a paso

### Paso 0 — La carpeta
`04-Prospectos/<empresa-en-minusculas-con-guiones>/`. Si la empresa ya está en
[`04-Prospectos/embudo.md`](C:/Claude/Estudio/04-Prospectos/embudo.md), se actualiza esa fila.

### Paso 1 — Lo automático (2 minutos)

Si tiene web:
```
node C:/Claude/Motor/01-Capacidades/web/plantillas/herramientas/diagnostico.js <dominio> --lighthouse --salida 04-Prospectos/<empresa>
```
Deja `diagnostico-auto.md`, `diagnostico-auto.json` y `assets/captura-celular.jpg` (cómo se
ve en un celular, sacada por Lighthouse). Tarda un minuto.

**Correrlo también sobre cada link que publica la empresa:** el de la bio de Instagram, el
de la ficha de Google, el que figura en sus placas o en su firma de mail. Ahí aparecen los
dominios vencidos y los links muertos (el caso Charlie). Para varios a la vez:
`node C:/Claude/Motor/01-Capacidades/web/plantillas/herramientas/diagnostico.js --rapido link1 link2`.

**Cómo leer lo que devuelve:**
- *"No hay ninguna web detrás"* o *"La web no carga"* → la herramienta ya lo confirma con el
  DNS público de Google (no es un problema de esta conexión) y dice la última vez que el
  Archivo de Internet la vio funcionando. Ese dato va a la versión interna y a la charla.
- *"El dominio vence en N días"* → no es un hallazgo hasta confirmarlo: muchos se renuevan solos.
- *"El dominio venció hace N días"* (`.ar`) → NIC Argentina da **45 días de gracia**: 30 con
  la web y los mails andando y 15 sin. La herramienta calcula las dos fechas. **Justo antes
  de mandar la hoja, volver a consultar el registro:** si ya lo renovaron, se saca el hallazgo.
- *"Bloquea lecturas automáticas"* → revisarla a mano en el navegador.
- **Velocidad:** Lighthouse simula un celular con 4G, igual que PageSpeed de Google. Se cita
  así: *"según la herramienta de Google, en un celular tarda X s en mostrar lo principal"*.
- Si Lighthouse no corre: abrir `https://pagespeed.web.dev/analysis?url=<url>` en el
  navegador y leer la pestaña **Celular**.

### Paso 2 — Google (navegador)

- Maps: `https://www.google.com/maps/search/<nombre>+<dirección>`. Con nombre y dirección,
  Maps **abre la ficha directo**: puntaje, cantidad de reseñas, horarios, web, teléfono y
  fotos. Sin cuenta es una vista limitada, pero la ficha se ve entera.
- Anotar: ¿tiene ficha? · puntaje y cantidad de reseñas · ¿responden las reseñas? ·
  ¿horarios cargados? · ¿la web de la ficha anda? · ¿fotos propias? · ¿el teléfono coincide?
- Buscar el nombre de la empresa y **"<rubro> en <barrio>"** con **WebSearch**: ¿aparecen?
  ¿Quiénes salen primero? ¿Siguen apareciendo páginas de una web vieja? Eso va a la versión
  interna, **nunca a la hoja**: no se le nombran competidores al prospecto.
  *Google abierto en el navegador pide verificación de robot: no se resuelve, se usa WebSearch.*
- **Leer las reseñas malas.** Ahí están las objeciones reales ("nunca atienden el
  teléfono"): son material para la charla, no para la hoja.

### Paso 3 — Instagram y Facebook (navegador)

- `https://www.instagram.com/<usuario>/` en el navegador. **Sin cuenta se ven** la bio, el
  link, seguidores, seguidos y destacadas; **no se ven** los botones de contacto ni las
  fechas. Lo que no se ve no se afirma. Facebook sin cuenta no muestra casi nada: se anota
  "no verificable".
- **Fecha de una publicación:** el código del link (`instagram.com/p/<código>/`) lleva la
  fecha adentro. Se saca así y se cita como *"hay publicaciones de <mes y año>"*:
  ```
  node -e "const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let n=0n;for(const c of process.argv[1])n=n*64n+BigInt(a.indexOf(c));console.log(new Date(Number(n>>23n)+1314220021721).toISOString().slice(0,10))" <código>
  ```
- Anotar: seguidores y seguidos · **fecha de la última publicación** · qué dice la bio
  (¿se entiende qué hacen y dónde?) · **el link de la bio y a dónde lleva** (pasarlo por el
  script) · botón de contacto · destacadas con precios, zonas o catálogo.
- La evidencia va **en texto**: qué dice, URL y fecha. La única imagen de la hoja es la
  captura en celular de su web.

### Paso 4 — ¿Coinciden los datos? (lo que más sorprende al dueño)

Una tabla con lo que dice cada canal:

| | Web | Google | Instagram | Placas / otros |
|---|---|---|---|---|
| Nombre | | | | |
| Dirección | | | | |
| Teléfono / WhatsApp | | | | |
| Horarios | | | | |
| Precios que publican | | | | |

**Cada diferencia es un hallazgo.** *"En Google figura cerrado los sábados y en Instagram
dicen que abren."* El cliente del cliente no sabe cuál creer, y llama al de al lado.

### Paso 5 — Elegir los hallazgos

De todo lo relevado, **máximo 5 para la hoja**, en este orden:

1. **Lo que corta el contacto:** links rotos, WhatsApp que no abre, dominio libre o vencido,
   web caída, teléfono equivocado.
2. **Lo que espanta:** aviso de "No seguro", no se ve en celular, datos que no coinciden,
   © de hace años.
3. **Lo que los esconde:** sin ficha de Google, sin web, un título que no dice nada.
4. **Lo que no deja medir:** sin medición de visitas. Solo si sobra lugar.

Cada uno se escribe con tres partes:
- **Qué vimos:** el hecho, con dónde y cuándo.
- **Por qué importa:** en términos de su cliente, en una línea.
- **Cómo se arregla:** concreto. Con la etiqueta **"Lo pueden hacer ustedes"** o
  **"Requiere trabajo técnico"**.

### Paso 6 — Los dos entregables

**A. `diagnostico.md` — interno, nunca sale**
1. **Ficha:** empresa, rubro, zona, web, Instagram, ficha de Google, contacto público, fecha.
2. **Semáforo de las 5 áreas** con todo lo relevado y la evidencia.
3. **Tabla de datos** del paso 4.
4. **Oportunidad:** puntaje (Hueco · Capacidad · Acceso · Encaje, de `buscar-clientes`) ·
   qué paquete encaja y por qué · extras probables · precio de lista según
   `precios.md` · la cuenta del valor, **solo con datos públicos**.
5. **Para la charla:** 3 preguntas para abrir · objeciones probables (de las reseñas) ·
   qué trabajo mostrar (ver `estudio.md`).
6. **Mensaje de primer contacto** listo para copiar, con el canal sugerido
   (de [`mensajes.md`](mensajes.md)).

**B. `diagnostico.html` + `diagnostico.pdf` — la hoja para la empresa**
Se completa [`plantilla-diagnostico.html`](plantilla-diagnostico.html). Una hoja A4, que se
lee bien en el celular. Datos del estudio desde `03-Comercial/estudio.md`.

Para el PDF, con el Chrome instalado (Bash, rutas absolutas):
```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="C:\\Claude\\Estudio\\04-Prospectos\\<empresa>\\diagnostico.pdf" "file:///C:/Claude/Estudio/04-Prospectos/<empresa>/diagnostico.html"
f=04-Prospectos/<empresa>/diagnostico.pdf; echo $(( $(grep -a -o "/Type */Page" $f | wc -l) - $(grep -a -o "/Type */Pages" $f | wc -l) ))    # páginas: tiene que dar 1
```
Si da 2 páginas: **acortar los textos de los hallazgos**, no achicar más la letra.
El PDF es lo que se manda por WhatsApp o mail. El HTML queda como fuente.

**Cómo se ve en el celular:** abrir el HTML en el navegador, con vista de celular (375 px),
y confirmar que nada se sale de la pantalla. Chrome sin ventana no sirve para esto: no baja
de 500 px de ancho y la captura sale cortada.

### Paso 7 — Revisión antes de mostrarle nada a Gaby

- [ ] Cada hallazgo se puede comprobar hoy: volver a abrir cada link citado.
- [ ] Ninguna cifra inventada; toda cifra dice de dónde sale.
- [ ] Hay 2 o 3 cosas bien, y son reales.
- [ ] Máximo 5 hallazgos, y por lo menos 1 arreglo que pueden hacer ellos.
- [ ] Sin precios y sin competidores en la hoja.
- [ ] El nombre de la empresa, escrito exactamente como lo escriben ellos.
- [ ] El tono: el dueño la podría leer en voz alta sin ofenderse.
- [ ] Se ve bien a 390 px y entra en una hoja A4.
- [ ] Ningún `{completar}` del estudio quedó en la hoja. Si quedó, se avisa que es borrador.
- [ ] `04-Prospectos/embudo.md` actualizado: estado `diagnosticado`, próximo paso y fecha.

### Paso 8 — A Gaby

Un solo mensaje: el PDF, los 3 hallazgos más fuertes (una línea cada uno), el canal sugerido
y el mensaje de contacto listo. Nada más.

---

## Cuando el prospecto responde

| Responde | Qué se hace |
|---|---|
| "Pasámelo" | Gaby manda el PDF. Estado `contactado` → `respondió`. |
| Quiere charlar | Preparar con la sección *Para la charla* de `diagnostico.md` + el trabajo que corresponda. |
| Quiere avanzar | Crear el proyecto del cliente (`nuevo-cliente.ps1`, en `C:/Claude/Clientes/`) y arrancar `brief-cliente` desde el diagnóstico: ya tiene media investigación hecha. |
| "No, gracias" | Estado `no contactar`. **No se le vuelve a escribir.** |
| No responde | Un solo seguimiento a los 5 días hábiles (ver `mensajes.md`). |
