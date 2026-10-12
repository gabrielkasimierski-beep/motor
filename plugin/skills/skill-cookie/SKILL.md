---
name: skill-cookie
description: Skill cookie — crea heros y landings con efecto "3D" de producto que se abre, se parte, explota en capas o gira al hacer scroll (estilo Miga Brava / Apple) — un clip generado con IA atado frame a frame al scroll, el objeto flotando sobre la página y la paleta re-tiñéndose por variante. Usala siempre que pidan "skill cookie", "efecto 3D", "que el producto se abra / rompa / desarme / gire con el scroll", "video que avanza con el scroll", "scroll scrubbing", "scrollytelling de producto", "como la web de la cookie", "hero cinematográfico" o una landing premium de producto (comida, cosmética, calzado, tech), aunque no nombren la técnica. También cuando haya que escribir los prompts de imagen/video para ese efecto o preparar un video para que se pueda scrubbear.
---

# Skill Cookie (scroll 3D reveal)

> **Parientes en el Motor:** si hace falta precisión cuadro a cuadro, capítulos de texto o llamadas
> ancladas a una parte del producto, la skill es `pelicula-con-scroll` (kit webi). Quién elige la pieza
> de un sitio: `dirigir-sitio`.

## Qué es en realidad

El efecto parece 3D pero no hay WebGL. Son tres cosas trabajando juntas:

1. **Un clip corto generado con IA** de una sola acción continua (la cookie se quiebra, las mitades se separan, el relleno se estira) sobre un fondo plano.
2. **El scroll controla el tiempo del clip**: scrollear hacia abajo avanza frames, hacia arriba retrocede. El usuario siente que él rompe el producto.
3. **La página se pone en escena alrededor**: el fondo del clip se funde con el de la página (el objeto "flota"), hay un halo de color y una palabra gigante *detrás* del objeto, y al pasar a la siguiente variante toda la paleta se re-tiñe.

Se hace así porque relleno derretido, migas y física de comida con calidad fotográfica son imposibles en 3D en tiempo real, y un clip pre-renderizado pesa pocos MB y corre en cualquier celular.

Si lo que piden es que el visitante **rote libremente o configure** el producto (elegir color, girarlo con el dedo), esto no sirve: eso sí es 3D real (modelo GLB + Three.js). Decíselo antes de arrancar.

## Flujo

Trabajá en este orden. Cada paso existe porque el siguiente es más caro de rehacer.

**1. Brief.** Juntá lo que falte en una sola tanda de preguntas cortas: producto y variantes (1 a 4), qué le pasa al producto (ver arquetipos), tema oscuro o claro, textos, y dónde vive el sitio. Si ya hay marca o proyecto, sacá paleta y tono de ahí en vez de preguntar.

**2. Dirección del plano.** Elegí el arquetipo de movimiento y escribí los prompts siguiendo `references/prompts-generacion.md`. Leelo siempre antes de generar: ahí están las reglas que hacen que un clip sirva para scroll (la mayoría de los clips lindos *no* sirven).

**3. Imagen fija primero.** Generá el frame inicial (producto entero, flotando, fondo plano) y mostráselo a la persona antes de pasar a video. El video hereda todo de esta imagen y cuesta varias veces más, así que el error se corrige acá. Las demás variantes se sacan **editando esa misma imagen** (misma silueta, mismo encuadre, misma luz), no generando de cero: si las siluetas no coinciden, el cambio de variante se ve como un salto en lugar de un re-teñido.

**4. Clip.** Image-to-video con el frame inicial como arranque (y, si el modelo lo permite, un frame final también generado por edición: da mucho más control sobre dónde termina el movimiento). 5 s, 16:9, 1080p, sin audio. Generar gasta créditos: consultá el costo antes, mostralo y pedí el OK una sola vez para toda la tanda.

**5. Revisar el clip** contra la checklist de abajo. Si falla, se regenera con el prompt corregido; no intentes salvar con código un clip con cortes, cámara que se mueve o fondo que cambia.

**6. Preparar para scrub.**
```bash
node scripts/prep-scrub.mjs clip.mp4 --name frambuesa --out assets
```
Genera `frambuesa-scrub.mp4` (escritorio), `frambuesa-scrub-m.mp4` (móvil) y `frambuesa-poster.jpg` (primer frame exacto). Necesita ffmpeg; si no está instalado el script lo avisa y explica cómo instalarlo — pedile a la persona que lo instale, no lo instales por tu cuenta. `--help` muestra todas las opciones.

**7. Construir.** Partí de `assets/template.html`: es una página completa y funcionando con el motor de scroll adentro. Cambiá el objeto `REVEAL`, los textos, las fuentes y la paleta; no reescribas el motor. Si el sitio ya existe en otro stack (React, Next, Astro), portá el motor tal cual a un componente cliente y dejá los assets en la carpeta pública.

**8. Verificar en un navegador** con la checklist final, en escritorio y en ancho de celular. Entregá recién después.

## Por qué funciona cada pieza

Entender esto te deja adaptar el template sin romperlo.

**El objeto flota porque el fondo del clip desaparece.** En tema oscuro el clip se genera sobre negro puro y se compone con `mix-blend-mode: lighten`: cada píxel muestra lo más claro entre el video y lo que hay detrás, así que el negro se vuelve "transparente" y el producto tapa lo de atrás. La IA nunca entrega negro exacto, por eso `prep-scrub` aplasta los negros (`--crush`) y el fondo de la página es *casi* negro, apenas más claro que el del clip. En tema claro es el espejo: clip sobre blanco puro, `--light` en el script y blend `darken`. Fondos de tono medio o con foto no funcionan con ninguno de los dos; llevá el diseño a oscuro o a claro.

**Orden de capas (de atrás hacia adelante):** color de fondo → halo radial del color de la variante → palabra gigante muy tenue → clip (con blend) → textos → navegación. La palabra y el halo tienen que estar en el **mismo contexto de apilamiento** que el clip: si un contenedor intermedio tiene `transform`, `opacity`, `filter` o `will-change`, el blend deja de ver lo que hay detrás y aparece el rectángulo negro del video.

**El clip se re-codifica con todos los frames como keyframe.** Un mp4 normal guarda un frame completo cada uno o dos segundos y el resto como diferencias; saltar a un frame arbitrario obliga a decodificar desde el keyframe anterior, y el scroll hacia atrás se traba. Con todos los frames intra el salto es instantáneo en cualquier dirección. Pesa más, por eso el clip es corto y hay versión móvil.

**El clip se carga entero en memoria** (fetch → blob) antes de scrubbear, para que ningún salto espere a la red.

**El tiempo se amortigua.** El scroll llega a saltos (rueda del mouse, inercia táctil). El motor no asigna el tiempo directo: persigue el objetivo un poco cada frame (`damping`). Esa inercia es buena parte de la sensación de "objeto con peso".

**Todo se calcula desde la posición de scroll, sin estado acumulado.** Recargar a mitad de página, saltar con un ancla o scrollear hacia atrás tienen que dibujar exactamente lo mismo. Si agregás animaciones, que también sean función del progreso; nada de disparar una animación "cuando pasa por acá".

**El zoom va en CSS, no en el clip.** La cámara del clip queda fija y el acercamiento se hace con `scale` atado al progreso. Si la cámara se mueve dentro del clip, el traspaso entre variantes no encastra.

**Cada capítulo tiene tres tramos** (`timeline`): salen los textos, se scrubbea el clip, y traspaso a la siguiente variante (fundido de clips, mezcla de paleta, entran los textos nuevos). Los tramos se solapan un poco a propósito: si esperan uno al otro se siente mecánico.

**Celular en vertical:** un 16:9 en `cover` dejaría el producto enorme, así que la caja del clip pasa a un ancho fijo (`--rv-portrait-width`) y sus bordes no se ven gracias al blend. Si en iPhone el scrub de video va a los saltos, pasá a `mode: 'frames'` (secuencia de imágenes en canvas, generada con `--frames 96`): pesa más en requests pero es fluido en todos lados.

**Movimiento reducido:** con `prefers-reduced-motion` no hay pin ni scrub; cada variante se muestra como sección normal con su poster. El texto real siempre está en el DOM (es una landing: tiene que posicionar y leerse sin JS).

## Configuración del template

| Campo | Qué controla |
|---|---|
| `mode` | `'video'` (por defecto) o `'frames'` (secuencia en canvas) |
| `theme` | `'dark'` → blend `lighten`; `'light'` → `darken` |
| `scrollPerChapter` | Altos de pantalla de scroll por variante. 2.2–3 se siente bien; menos es brusco, más cansa |
| `damping` | Inercia del scrub. 0.10 pesado y suave, 0.20 más pegado al dedo |
| `timeline.uiOut / scrub / handoff` | Tramos `[inicio, fin]` del progreso 0–1 de cada capítulo |
| `chapters[].video / videoMobile / poster` | Salidas de `prep-scrub` |
| `chapters[].frames` | Solo en modo `frames`: `{ path, ext, count, pad }` |
| `chapters[].bg / accent / glow` | Paleta de la variante. `bg` casi negro teñido, `accent` el color vivo, `glow` su versión oscura y saturada |

Los textos de cada variante están en el HTML, enlazados por `data-chapter="<id>"`. `window.__rv.state()` devuelve el estado actual y sirve para depurar.

## Checklist del clip (antes de escribir código)

- El primer frame es idéntico a la imagen aprobada (va a ser el poster; si difiere, se nota un salto al cargar).
- Una sola acción, continua y en un solo sentido. Sin cortes, sin rebote, sin que el producto vuelva a cerrarse.
- Cámara completamente quieta; el producto arranca centrado y dentro del 60 % central del cuadro.
- Fondo plano de punta a punta: sin piso, sin sombra apoyada, sin humo, sin viñeta, sin degradé.
- Luz constante, sin parpadeo.
- La acción termina en una pose final legible antes de que termine el clip.
- Sin texto, logos ni manos.

## Checklist final (en navegador)

- Al cargar no hay pantallazo negro ni rectángulo visible alrededor del producto.
- Scroll lento, rápido y hacia atrás: el clip acompaña sin trabarse y vuelve exacto al estado inicial.
- Recargar a mitad de página dibuja el estado correcto.
- En cada traspaso cambian juntos clip, textos, fondo, halo y color de acento, sin salto de silueta.
- La palabra gigante queda *detrás* del producto y no se transparenta sobre él.
- Después del último capítulo la página sigue scrolleando normal.
- Ancho de celular: producto de tamaño razonable, textos legibles, sin scroll horizontal.
- Sin errores en consola; peso total de los clips razonable (apuntá a menos de 8 MB por variante en escritorio y 3 MB en móvil).

## Problemas típicos

| Síntoma | Causa | Arreglo |
|---|---|---|
| Scrub a los saltos, peor hacia atrás | Clip sin pasar por `prep-scrub` | Re-codificar; en iOS, modo `frames` |
| Rectángulo oscuro alrededor del producto | Negros del clip más claros que el fondo, o blend aislado por un contenedor | Subir `--crush` (0.06 → 0.10) o aclarar apenas `bg`; quitar `transform`/`opacity`/`filter` del contenedor intermedio |
| Pantallazo negro al cargar | Falta el poster o no es el primer frame | Usar el poster que genera el script |
| La palabra gigante se ve a través del producto | Palabra muy clara o producto con zonas muy oscuras | Bajar su opacidad; si no alcanza, elegir producto/luz más clara |
| Salto visible entre variantes | Siluetas o encuadres distintos | Regenerar variantes por edición del mismo frame inicial |
| En celular las mitades se cortan en seco | Caja del clip angosta | Subir `--rv-portrait-width` |
| Colores lavados sobre el fondo | Fondo de página demasiado claro para `lighten` | Fondo casi negro, o pasar todo al pipeline claro |
| Pesa demasiado | Resolución o duración de más | `--width 1600`, `--crf 23`, `--trim`, y revisar la versión móvil |
