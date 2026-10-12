# 3D y animación — aprendizajes de Carta Viva

Sale de `C:/Claude/Estudio/carta-viva/` (README, `decisiones.md`, `mejoras/README.md` y
`mejoras/ar/`). Estado de la línea: **en formación**. Lo que sigue es lo que ya funcionó.

## Lo que ya hicimos

| Técnica | Cómo | Dónde está |
|---|---|---|
| **Platos 3D por código** | three.js (v0.170, vía `importmap` desde CDN), modelados por capas; solo se baja si se elige el 3D | `app/assets/platos3d.js`, `escena.js` |
| **Foto real recortada que gira** | foto con fondo transparente (color + alfa), giro con el dedo; el giro "de verdad" es un video pasado a cuadros con el taller | `fotos.js`, `recorte.js`, `cuadros.js`, `herramientas/taller/` |
| **"¿Qué tiene?"** | plato entero y alrededor la foto de cada ingrediente (las capas cortadas de la foto no gustaron) | `escena-fotos.js` |
| **Juegos en postres y bebidas** | las bebidas se sirven, las papas se bañan en cheddar, el flan tiembla, el cheesecake se come de a bocados | `juegos.js` |
| **Pizza con grosor** | dos versiones: **video** (foto en ángulo + giro) y **3D** (la foto de arriba sobre una pizza armada con masa, borde y ocho porciones; un toque levanta una porción) | `pizza3d.js`, `mejoras/pizzas/` |
| **AR sobre la mesa** | `<model-viewer>` con `ar-modes="webxr scene-viewer quick-look"` y `ar-scale="auto"`; botón "Ver en tu mesa" | `mejoras/ar/index.html` |
| **"Tu foto"** | la cámara prueba la foto del plato propio del local en el celu, para mostrárselo al dueño | cinta de la demo |

## Cómo se generaron los recursos

- **Fotos de platos:** Higgsfield (GPT Image 2.5, fondo transparente), desde la cuenta de Gaby.
- **Giros:** Higgsfield (Kling 3.0 pro, el plato girando sobre fondo azul), pasados a cuadros con el taller.
- **`.glb` para AR:** salieron de Higgsfield (`generate_3d`, imagen a 3D desde la foto del plato).
  SAM 3D los devuelve en ~1 metro: hay que **escalarlos a tamaño real** (~14×10×13 cm una burger)
  o en AR salen gigantes.
- La **pizza en ángulo** también salió de Higgsfield (foto en ángulo + video de giro).

## Qué sirvió para mostrarle a un local su propio plato

- **Fotos reales primero, 3D como opción.** Desde el 1-oct-2026 la app usa fotos reales por
  defecto; el 3D se baja solo si se elige. Las fotos reales son lo más rápido de conseguir para un
  local y gustaron mucho.
- **"Tu foto" y AR** son el momento "wow": el dueño ve su plato girando o sobre su mesa.
- **El color sale del plato** (un color por plato), no un fondo plano aparte.
- **Los giros fingidos se veían mal a los costados**; los videos de verdad pasados a cuadros, no.

## Para un local de verdad

Sus platos fotografiados (o generados a partir de sus fotos) con fondo transparente, la foto de
cada ingrediente, y los videos de los giros de lo que más impacta (burgers, tragos). Va en `fotos.js`.
La otra vía, a futuro: **escaneo real** (Polycam, Luma, KIRI Engine, RealityScan), optimizado a
menos de 2–3 MB por plato, con la foto primero y el 3D después. Para "¿Qué tiene?" sobre un plato
escaneado hay que tenerlo por capas; con un escaneo entero se muestra la lista de ingredientes.

## Límites conocidos

- **El AR real (apoyar en la mesa) solo anda en celular.** Para iPhone hace falta además un
  `.usdz`; el `.glb` cubre Android.
- CloudFront cachea: tras subir un `.glb` nuevo, la primera carga puede fallar.
- Los `.glb` de IA son una muestra convincente, no un escaneo fiel del plato real.
- Falta probarlo con **material real de un local** (fotos crudas sacadas con celular).
- `{completar: precio de esta línea; hoy no hay}`

Mientras se aprende más, la bitácora de Gaby está en [`por-estudiar.md`](por-estudiar.md).
