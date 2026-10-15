# Guía de uso del Motor

Para Gaby y Juanma. Qué es cada carpeta, cuándo abrirla y qué decirle a Claude. Si todavía no lo instalaste, los
pasos están en el [`README.md`](README.md).

## La regla de oro

**Claude trabaja en la carpeta donde abrís la sesión.** Elegir la carpeta correcta es el 90 % del uso.

| Quiero… | Abro la sesión en… |
|---|---|
| Trabajar en un cliente | `C:\Claude\Clientes\<cliente>` |
| Arrancar un cliente nuevo | Primero lo creo (ver abajo), después abro `C:\Claude\Clientes\<cliente>` |
| Buscar prospectos o hacer un diagnóstico | Tu **Estudio** (por convención, `C:\Claude\Estudio`) |
| Cambiar el método, los precios o una skill | `C:\Claude\Motor`, **por rama y PR** (ver `CONTRIBUTING.md`) |

## Las carpetas

### `C:\Claude\Motor` — la caja de herramientas (compartida)
Es el manual y las herramientas del negocio de clientes, y vive en un **repo privado de GitHub** que usan Gaby y
Juanma. **No se trabaja a ningún cliente acá:** solo se abre para cambiar el sistema.
- Qué tiene: `MOTOR.md` (el cerebro) · `plugin\` (las skills y el agente) · `00-Motor\` (método) · `01-Capacidades\`
  (qué ofrecemos) · `02-Plantilla-cliente\` (crea clientes) · `03-Comercial\` (precios) · `04-Accesos\` (política de tokens).
- No hace falta abrirla para **usar** las skills: los clientes ya las toman solos.
- Para recibir las novedades del otro: `git -C C:\Claude\Motor pull`.

### `C:\Claude\Clientes\<cliente>` — la oficina de cada cliente (privada de cada persona)
Un proyecto por cliente, con su marca, sus archivos, su `.env` y su memoria. **Acá se trabaja el 90 % del tiempo.**
Claude sabe quién es el cliente apenas abrís, y **no puede ver a los otros**. Estos proyectos no viajan con el
Motor: cada uno tiene los suyos (y los que comparten, como Ginotto, tienen su propio repo).

### Tu Estudio — prospección y productos (opcional, de cada uno)
Por convención, `C:\Claude\Estudio`. Ahí van los prospectos (`04-Prospectos\`) y los productos propios. No es un
cliente. Las skills `buscar-clientes` y `diagnostico-digital` se usan desde ahí. Cuando un prospecto dice que sí, se
muda a `Clientes`.

## Flujos habituales

**Trabajar un cliente existente:** abrir `C:\Claude\Clientes\<cliente>` → aceptar los avisos de la primera vez
(confiar en la carpeta, importar el `MOTOR.md`) → hablarle normal: *"retomemos X"*, *"cambiá el precio de Y"*.
Para publicar, pedirlo: nada sale sin tu OK.

**Salir a buscar clientes:** abrir tu Estudio → *"buscame clientes de X en Y"* (`motor:buscar-clientes`) →
*"hacé el diagnóstico de X"* (`motor:diagnostico-digital`). Los mensajes los mandás vos.

**Cliente nuevo:**
1. Crearlo (PowerShell, desde cualquier carpeta):
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\Claude\Motor\02-Plantilla-cliente\nuevo-cliente.ps1 -Nombre "Casa Rossi" -Rubro "Gastronomía"
   ```
   Si viene de un prospecto, sumá `-DesdeProspecto "C:\Claude\Estudio\04-Prospectos\<empresa>"`.
2. Abrir `00-ARRANQUE.md` (ya está con el nombre y el rubro) y completar **lo que sepas**: en campos, o pegando
   el WhatsApp o las notas tal cual vinieron. Si venía de un prospecto, ya trae su diagnóstico.
3. Abrir sesión en `C:\Claude\Clientes\casa-rossi` y decir: **"Leé 00-ARRANQUE.md y arrancá"**. Claude audita su
   presencia, arma el mapa de oportunidades (`analisis.md`), propone **un primer prototipo para mostrar** y hace
   las preguntas que falten, todas juntas. **Después frena: elegís vos.**
4. Si hay interés: brief → propuesta → construcción → publicación.

**Cambiar el Motor:** una rama y un PR que mira el otro. Los pasos (y cómo no romper tus clientes mientras
tanto) están en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Skills (aparecen al escribir `/motor`)

| Decís… | Skill | Dónde usarla |
|---|---|---|
| *"tengo un cliente nuevo"* | `motor:cliente-nuevo` | Cliente |
| *"armá el brief"* | `motor:brief-cliente` | Cliente |
| *"armá la propuesta"* | `motor:propuesta-comercial` | Cliente |
| *"construí la web"* | `motor:construir-web` | Cliente |
| *"publicá"* | `motor:publicar-web` | Cliente |
| *"skill cookie"*, *"que el producto se abra / gire con el scroll"* | `motor:skill-cookie` | Cliente |
| *"buscame clientes"* | `motor:buscar-clientes` | **Estudio** |
| *"hacé el diagnóstico de X"* | `motor:diagnostico-digital` | **Estudio** |

Las dos del Estudio guardan en `04-Prospectos\`, que los clientes no pueden ver.

### Sitios con movimiento (kit webi)

Para cuando la web de un cliente tiene que moverse. El mapa completo y cómo ver el banco de pruebas están en
`01-Capacidades\web\webi\README.md`. Regla de oro: **una sola pieza firma por sitio**.

| Decís… | Skill | Dónde usarla |
|---|---|---|
| *"quiero que el sitio impacte"*, *"qué efecto le ponemos"* | `motor:dirigir-sitio` (la entrada: elige la pieza firma) | Cliente |
| *"que el producto gire / se desarme con el scroll"* | `motor:pelicula-con-scroll` | Cliente |
| *"un video de fondo en la portada"* | `motor:video-de-portada` | Cliente |
| *"que siga al cursor"*, *"un antes y después"* | `motor:escena-con-puntero` | Cliente |
| *"que la imagen tenga profundidad"* | `motor:profundidad-por-capas` | Cliente |
| *"un objeto 3D en la página"* | `motor:escena-3d` | Cliente |
| *"un fondo que se mueva con los colores de la marca"* | `motor:fondos-shader` | Cliente |
| *"un carrusel"*, *"un botón con efecto"* | `motor:componentes-vivos` | Cliente |
| *"armá la banda de precios / contacto / pie"* | `motor:secciones-de-pagina` | Cliente |
| *"una pantalla de app o un panel"* | `motor:pantallas-de-app` | Cliente |
| *"cómo debería moverse esto"*, *"qué timing y easing"*, *"animá este botón / transición"* | `motor:motion-design` (principios de animación de LottieFiles, MIT: timing, easing, coreografía) | Cliente |
| *"pasá la marca al sitio"* | `motor:sistema-visual` y `motor:motor-de-movimiento` (la base) | Cliente |
| *"necesito el video / los cuadros"* | `motor:fabricar-recursos` | Cliente |
| *"revisá la página antes de mostrarla"* | `motor:revisar-sitio` | Cliente |
| *"analizá este sitio y sumá lo que sirva"* | `motor:estudiar-sitio` | **Motor** (por rama y PR) |

## Para qué sirve cada skill

**El camino de un cliente**
- `cliente-nuevo`: la puerta de entrada. Junta el contexto, audita cómo está hoy, arma el mapa de oportunidades (web, app, 3D, diseño) y propone el primer prototipo.
- `brief-cliente`: relevamiento a fondo, en 3 tandas de preguntas para el cliente. Deja un `brief.md`. Cuando el cliente ya mostró interés.
- `propuesta-comercial`: 3 paquetes con los precios de la grilla, extras y mantenimiento mensual. La aprueba quien lleva el cliente.
- `construir-web`: la web completa (textos, catálogo, formulario a WhatsApp), revisada.
- `publicar-web`: la sube, conecta dominio, mail y formularios, y deja el documento de entrega.

**Para salir a buscar clientes** (desde el Estudio)
- `buscar-clientes`: empresas reales con presupuesto, puntuadas y anotadas en el embudo.
- `diagnostico-digital`: cómo aparece una empresa en internet: una hoja para ella y otra interna con el mensaje de contacto.

**Sitios con movimiento (kit webi).** Las llama `construir-web` o `dirigir-sitio` cuando el sitio lo necesita.
- Método: `dirigir-sitio` (concepto y **una** pieza firma) · `fabricar-recursos` (video, imágenes y cuadros) · `revisar-sitio` (celular, "reducir movimiento", peso) · `estudiar-sitio` (aprender de un sitio ajeno).
- Base: `sistema-visual` (la marca del cliente al sitio) · `motor-de-movimiento` (todo lo atado al scroll).
- Pieza firma (se elige **una**): `pelicula-con-scroll` (un video que avanza con el scroll) · `skill-cookie` (un producto que se abre o cambia de color) · `video-de-portada` · `escena-con-puntero` (sigue al cursor, antes y después) · `profundidad-por-capas` · `escena-3d`.
- El resto de la página: `fondos-shader` · `componentes-vivos` (carruseles, botones, textos) · `secciones-de-pagina` (precios, contacto, pie…) · `pantallas-de-app`.

Cuando entra un cliente nuevo arrancan solo 3 o 4: `cliente-nuevo`, `diagnostico-digital` y, si hay interés, `brief-cliente` y `propuesta-comercial`. Las de movimiento las llaman esas.

## Reglas

- **Un proyecto, un cliente:** los permisos impiden mezclar datos entre clientes.
- **Los tokens los carga cada persona** (en el `.env` del cliente o como variables de Windows). Claude no los lee
  ni los escribe. Política y plantilla: `04-Accesos\`.
- **Nada se manda ni se publica sin tu OK**; ningún precio sale sin que lo veas.
- Lo que falta de un cliente queda como `{completar}`, nunca inventado.
- Lo que aprendés de un cliente y sirve a otros va al Motor, **sin datos del cliente**.

## Si algo no anda

| Pasa | Probá |
|---|---|
| No aparecen las skills `motor:` | Estás en una carpeta sin plugin. Abrí un cliente o tu Estudio, aceptá el aviso de confianza y `/reload-plugins` |
| "No puede leer" algo de otro cliente | Es el aislamiento funcionando. Pasale el dato por el chat |
| El script no pudo conectar el plugin | En la carpeta del cliente: `claude plugin install motor@motor-estudio --scope project` |
| Agregué un cliente y los otros no lo bloquean | `nuevo-cliente.ps1 -SoloAislamiento` |
| Cambié de rama en `C:\Claude\Motor` y los clientes se comportan raro | Volvé a `main`: esa carpeta es la que leen todos. Usá un `git worktree` para trabajar ramas |
