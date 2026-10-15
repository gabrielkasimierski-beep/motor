# Webi — sitios con movimiento

La parte del Motor que sabe armar sitios web **que se mueven**: un producto que gira con el scroll, un
video de portada que no parece pegado, fondos vivos, 3D, y las bandas y componentes para que el resto
de la página esté a la altura. Nació el 11-oct-2026 como "Motor webi", estudiando
[Scrolltide](referencias/scrolltide/analisis.md), y crece con cada sitio que se estudia.

Es una **capacidad de la línea web**: se usa cuando el sitio de un cliente lleva movimiento. La web de
siempre (catálogo, blog, formulario) la sigue resolviendo la skill `construir-web`, que deriva acá.

Son tres cosas que trabajan juntas:

- **Skills** (`C:/Claude/Motor/plugin/skills/`, las de la tabla): cómo decidir y en qué orden trabajar.
  Viajan en el plugin del Motor, así que aparecen como `motor:<skill>` en cada cliente.
- **Kit** (`kit/`): el código base ya probado que las skills mandan usar. Sin dependencias ni
  compilación. Su contrato está en [`kit/CONTRATO.md`](kit/CONTRATO.md).
- **Banco de pruebas** (`banco/`): una página por pieza. Es la demostración y el ejemplo de uso.

## Ver el banco de pruebas

```powershell
node C:\Claude\Motor\01-Capacidades\web\webi\herramientas\servidor.js C:\Claude\Motor\01-Capacidades\web\webi 5190
```

Y abrir http://localhost:5190/banco/ (con la sesión abierta en el Motor, también está como servidor
`banco` en `.claude/launch.json`).

## Mapa de skills

| Cuándo | Skill | Pieza del kit |
|---|---|---|
| **Método** | | |
| Hay un sitio que queremos aprender | `estudiar-sitio` | — |
| El sitio lleva movimiento: concepto, pieza firma, guion y fichas | `dirigir-sitio` | — |
| Hace falta una imagen, un video o cuadros | `fabricar-recursos` | `herramientas/video-a-cuadros.js` |
| Antes de mostrar o publicar | `revisar-sitio` | `herramientas/archivos-del-sitio.js` |
| **Base** | | |
| Color, tipografía, espacios, curvas | `sistema-visual` | `tokens.css` |
| Scroll, escenarios fijos, entradas | `motor-de-movimiento` | `motor-scroll.js` |
| Principios de animación (timing, easing, coreografía, emoción) | `motion-design` (de LottieFiles, MIT) | solo guía, sin código |
| **Escenas (la pieza firma)** | | |
| Un video que avanza con el scroll | `pelicula-con-scroll` | `cuadros.js` |
| Un producto que se abre o se parte, con variantes de color | `skill-cookie` | (trae su plantilla propia) |
| Un video arriba de todo | `video-de-portada` | `video-portada.js` |
| Algo que sigue o revela con el puntero | `escena-con-puntero` | `cuadros.js`, `puntero.js` |
| Profundidad con imágenes planas | `profundidad-por-capas` | `capas.js` |
| Un objeto 3D | `escena-3d` | `escena3d.js` |
| **Estanterías** | | |
| Un fondo que se mueve | `fondos-shader` | `fondo-shader.js` |
| Un carrusel, un botón, un texto con efecto | `componentes-vivos` | `componentes/` |
| Una banda de página (precios, contacto, pie…) | `secciones-de-pagina` | `secciones.css`, `secciones.js` |
| Un panel o pantalla de aplicación | `pantallas-de-app` | `graficos.js`, `pantalla.css` |

## Cómo se arma un sitio con movimiento

Parado en el proyecto del cliente, con su `brief.md` (o al menos su `analisis.md`):

1. **Dirigir** (`dirigir-sitio`): del brief sale un concepto, **una** pieza firma y el guion de
   bandas, con una ficha por pieza.
2. **Sistema visual** (`sistema-visual`): la marca del cliente pisa los valores de `tokens.css`.
3. **Fabricar** (`fabricar-recursos`): los recursos de la pieza firma, antes que la página.
4. **Construir** banda por banda, quieta antes que en movimiento, copiando del kit lo que pida
   cada ficha:
   ```powershell
   node C:\Claude\Motor\01-Capacidades\web\webi\herramientas\nuevo-sitio.js sitio --piezas=cuadros,fondo-shader
   ```
5. **Revisar** (`revisar-sitio` + `00-Motor/control-calidad.md`) y mostrar.

## Reglas

Valen todas las del [`MOTOR.md`](../../../MOTOR.md). Las propias de esta capacidad:

1. **Una pieza firma por sitio.** El resto, parejo y quieto. Mejor cuatro bandas consistentes que
   una portada de cine arriba de cuatro bandas chatas.
2. **El recurso manda.** Sin un buen video o una buena imagen no hay técnica que salve la escena:
   primero el recurso, después el código.
3. **Todo funciona en el celular y con "reducir movimiento".** Si una pieza no tiene una versión
   digna para esos dos casos, no está terminada.
4. **El peso se cuenta.** Cada pieza declara cuánto baja y cuándo. Lo pesado llega tarde y solo si
   hace falta.
5. **Se aprende la técnica, no se copia la obra.** De un sitio ajeno se toman mecanismos y
   medidas; nunca sus textos, imágenes, videos, código ni material de pago.
6. **El movimiento no demora el contacto.** El botón que genera la consulta está visible y responde
   antes de que termine de cargar la escena (Norte 1 del Motor).
7. **Generar recursos con una cuenta paga se consulta antes** (qué, cuántas tomas, cuánto cuesta).

## Cambiar el kit

El kit es parte del Motor: cada cambio entra por rama y Pull Request (`CONTRIBUTING.md`). Una pieza nueva
entra con sus tres partes: código en `kit/`, página en `banco/` (y su tarjeta en `banco/index.html`) y su
lugar en una skill. Si cambia una firma, se actualizan en el mismo cambio el contrato, la página del
banco y la skill que la usa.

Los medios de muestra del banco son propios (un fractal de prueba y una botella generada): no hay
material de terceros.

## Sitios estudiados

| Sitio | Fecha | Qué dejó |
|---|---|---|
| [Scrolltide](referencias/scrolltide/analisis.md) | 11-oct-2026 | Los ocho mecanismos, las cinco estanterías y el método: la primera versión entera del kit |
