# Prompts de generación

Los prompts van en inglés (los modelos de imagen y video responden mejor); la conversación con la persona sigue en su idioma.

## Contenido
1. Reglas del plano
2. Frame inicial (imagen A)
3. Variantes
4. Frame final (imagen B)
5. Clip
6. Arquetipos de movimiento
7. Elegir modelo y cuidar el gasto
8. Sacar la paleta
9. Si el clip sale mal

## 1. Reglas del plano

Un clip sirve para scroll cuando el tiempo se puede leer como una sola dirección: abajo = avanza, arriba = retrocede. Todo lo que sigue sale de ahí.

- **Una acción, un sentido.** Se abre y queda abierto. Nada que vaya y vuelva.
- **Cámara clavada.** El acercamiento se hace después en CSS.
- **Producto flotando y centrado**, ocupando cerca del 55 % del alto del cuadro. Deja aire para que las partes se separen sin salirse enseguida y para el recorte en celular.
- **Fondo de un solo color**: negro puro para tema oscuro, blanco puro para tema claro. Sin piso ni sombra apoyada: una sombra delata el rectángulo del video.
- **Luz de borde del color de la variante.** Ese contraluz es lo que después "enciende" el halo de la página y hace creíble el re-teñido.
- **Vista frontal o cenital plana.** Las perspectivas de tres cuartos hacen que la separación se lea torcida y complican que las variantes coincidan.

## 2. Frame inicial (imagen A)

Plantilla:

```
Ultra-realistic macro product photograph of [PRODUCTO, con textura y detalles visibles],
perfectly front-facing flat view, floating centered in frame, occupying about 55% of the
frame height. [2–3 DETALLES DE SUPERFICIE]. A few tiny [PARTÍCULAS: crumbs / droplets /
dust] suspended in the air around it.
Pure solid [black #000000 | white #FFFFFF] background, no surface, no table, no ground
shadow, no props, no text, no logo.
Soft studio key light from upper left, strong [COLOR] rim light glowing around the edge.
16:9, sharp focus across the whole product, high detail, commercial [food | product]
photography.
```

Ejemplo:

```
Ultra-realistic macro product photograph of a single thick artisan raspberry cookie,
perfectly front-facing flat view, floating centered in frame, occupying about 55% of the
frame height. Golden craggy crumble surface studded with freeze-dried raspberry pieces.
A few tiny crumbs suspended in the air around it.
Pure solid black #000000 background, no surface, no table, no ground shadow, no props,
no text, no logo.
Soft studio key light from upper left, strong raspberry-pink rim light glowing around the
edge. 16:9, sharp focus across the whole cookie, high detail, commercial food photography.
```

Si la persona tiene foto real del producto, usala como referencia en un modelo de edición y pedí lo mismo: aislar, centrar, fondo plano, luz de borde.

## 3. Variantes

Siempre por **edición de la imagen A aprobada**, nunca desde cero:

```
Same object, same exact size, position, framing and camera. Same pure solid black
background. Change only the flavour: [NUEVA VARIANTE: deep green matcha dough with
pistachio pieces]. Rim light colour changes to [COLOR]. Nothing else changes.
```

Superponé A y la variante a media opacidad: los contornos tienen que coincidir casi exactos.

## 4. Frame final (imagen B)

Opcional pero muy recomendable si el modelo de video acepta frame inicial + final: fija dónde termina el movimiento y evita que el modelo invente. También por edición de A:

```
Same object, same framing, same lighting, same pure solid black background.
The [PRODUCTO] has been [ESTADO FINAL: broken in two halves along a vertical crack, the
halves pulled apart horizontally toward the left and right edges of the frame; thick
glossy raspberry-pink molten filling stretches in several elastic strands between them
across the centre]. A few crumbs floating. Nothing else changes.
```

## 5. Clip

Plantilla (image-to-video, A como primer frame, B como último si se puede):

```
Locked-off static camera, no camera movement at all. The [PRODUCTO] stays perfectly still
for a brief moment, then [ACCIÓN, descrita en orden y en un solo sentido]. One single
continuous slow movement, no cuts, constant lighting. The background stays pure solid
[black | white] for the entire shot. Macro commercial, slow-motion feel.
```

Negativos (o agregados como "no …" si el modelo no tiene campo aparte):

```
camera shake, zoom, pan, cuts, hands, fingers, plate, table, surface, text, logo, smoke,
steam, background change, flicker, extra objects, the object closing again
```

Ejemplo:

```
Locked-off static camera, no camera movement at all. The cookie stays perfectly still for
a brief moment, then a crack splits it vertically down the middle and small crumbs burst
outward; the two halves slowly and steadily pull apart horizontally toward the left and
right edges of the frame, revealing thick glossy raspberry-pink molten filling that
stretches into elastic strands between them. One single continuous slow movement, no
cuts, constant lighting. The background stays pure solid black for the entire shot.
Macro food commercial, slow-motion feel.
```

Parámetros: 5 s, 16:9, 1080p, sin audio. Ese "brief moment" quieto al principio importa: es el tramo en que los textos todavía están en pantalla.

## 6. Arquetipos de movimiento

| Arquetipo | Sirve para | Acción (va en el prompt) | Frame final |
|---|---|---|---|
| **Partir y estirar** | cookie, brownie, pan relleno, mozzarella, alfajor | a crack splits it down the middle, the halves pull apart horizontally, filling stretches in strands | mitades a los costados, relleno uniendo |
| **Explotar en capas** | hamburguesa, sándwich, zapatilla, auriculares, reloj | the layers / components separate and rise apart vertically, evenly spaced, floating | vista explotada ordenada |
| **Destapar o derramar** | perfume, crema, botella, frasco | the cap lifts straight up and away; a ribbon of [líquido] flows out and curls in the air | tapa arriba, cinta de producto suspendida |
| **Girar** | envases, zapatillas, botellas | the object rotates slowly 180 degrees around its vertical axis, at constant speed | el dorso |
| **Abrir** | cajas, packaging, estuches | the lid opens and the contents rise slightly out of it | caja abierta, contenido asomado |
| **Estallar** | fruta, bebidas, especias | the fruit bursts open, juice and pieces radiate outward and hang in the air | piezas suspendidas en corona |
| **Ensamblar** | tech, muebles, kits | generar "explotar en capas" y preparar con `--reverse` | el producto entero |

Para **ensamblar**, generá siempre la versión que se desarma: a los modelos les sale mucho mejor separar que juntar. Después se invierte al preparar el clip: `prep-scrub.mjs --reverse`.

## 7. Elegir modelo y cuidar el gasto

No dependas de un modelo fijo: cambian seguido. Hace falta:

- **Imagen:** un modelo fotorrealista que acepte imagen de referencia para editar (variantes y frame final).
- **Video:** image-to-video con frame inicial; idealmente también frame final. 5 s, 1080p.

Si hay un conector de generación con catálogo (por ejemplo Higgsfield: `models_explore` con `recommend`/`get`), consultalo para ver qué modelo acepta frame inicial y final y qué duraciones admite, en lugar de asumirlo. Si el conector permite consultar el costo sin generar (`get_cost: true`), hacelo y mostrá el total de toda la tanda —imágenes más clips de todas las variantes— antes de pedir el OK.

Orden que menos gasta: imagen A → aprobación → variantes y frames finales → aprobación → **un solo clip** de la primera variante → revisar que sirva para scroll → recién entonces el resto de los clips con el mismo prompt.

## 8. Sacar la paleta

De cada variante salen tres colores:

- `accent`: el color vivo de la luz de borde (el rosa frambuesa, el verde matcha). Va en botones, subrayados y el borde de la miniatura activa.
- `glow`: el mismo tono, mucho más oscuro y saturado. Es el halo radial detrás del producto.
- `bg`: casi negro apenas teñido hacia ese tono (por ejemplo `#0d0709` para frambuesa). Nunca negro puro: tiene que quedar un pelo más claro que el fondo del clip para que el blend lo esconda.

En tema claro se invierte: `bg` casi blanco teñido, `glow` un pastel del tono.

## 9. Si el clip sale mal

| Qué pasó | Qué cambiar en el prompt |
|---|---|
| La cámara se acerca o se mueve | Repetir "locked-off static camera, tripod shot" al inicio y al final; quitar palabras como "cinematic" o "dynamic" |
| El producto se vuelve a cerrar | Usar frame final; agregar "ends fully open and stays open" |
| Aparece piso, mesa o humo | Reforzar "floating in a pure black void, no surface"; quitar "steam", "warm", "fresh from the oven" |
| El fondo se aclara o tiñe | "background remains pure solid black #000000 throughout"; bajar la intensidad de la luz de borde en la imagen A |
| Arranca moviéndose de entrada | "stays perfectly still for the first second" |
| El relleno se ve plástico | Describir el material: "thick, glossy, viscous, slowly sagging under its own weight" |
| Cambia la forma del producto | El modelo no respetó el frame inicial: probar otro modelo antes que seguir tocando el prompt |
