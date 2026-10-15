---
name: fabricar-recursos
description: Fabrica los recursos de una escena (imagen, sujeto recortado, video, bucle, cuadros, capas) en el orden correcto y los deja livianos y listos para el kit. Usar cuando una pieza necesita un video o una secuencia de cuadros, cuando hay que generar imágenes o videos con IA para un sitio, pasar un video a cuadros, hacer un bucle sin salto, separar una imagen en capas o preparar dos imágenes alineadas para un foco.
---

# Fabricar recursos

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

El recurso manda: una escena no puede ser mejor que el video o la imagen que la sostiene. Se
fabrica **antes** que la página y **en orden**, porque cada paso alimenta al siguiente y hacerlos
desordenados obliga a rehacer los anteriores.

```
referencia → imagen → sujeto aislado → video → tramo limpio → cuadros → alojamiento → página
```

> Generar con Higgsfield gasta créditos de la cuenta de quien lo pide: **se le consulta antes** (qué,
> cuántas tomas y cuánto cuesta).
> Si el cliente tiene material propio, va primero: fotos y videos reales ganan casi siempre.
>
> **Alternativa gratis: Vibes** (https://vibes.ai, de Meta, en beta). No tiene API ni MCP: se opera por el
> navegador con Claude in Chrome, con la cuenta de quien lo pide ya logueada. Cuando no hace falta calidad de
> paga, ofrecerla antes que Higgsfield. Flujo: Proyectos > "Crear nuevo" > escribir el prompt en "Describe un
> vídeo…" > elegir Vídeo o imagen > flecha azul para generar > bajar el resultado desde "Contenido multimedia".
> Lo descargado va a la carpeta del cliente, nunca al Motor.

## Reglas que no se negocian

1. **La proporción se fija antes de animar.** La imagen sale ya en la proporción que va a ocupar
   (16:9 para una portada de escritorio; pensar el recorte vertical del celular: el sujeto al
   centro). Recortar después tira el encuadre para el que se hizo el video.
2. **Un sujeto por imagen, sobre fondo liso o transparente.** Una escena ya compuesta se puede
   escalar pero no atravesar. Rescatar un sujeto de un fondo cargado cuesta más que regenerarlo.
3. **Lugar para el texto:** dejar a propósito una zona tranquila y de poco contraste donde va el título.
4. **La luz se dice en cada pedido.** Dos imágenes generadas por separado no coinciden en la
   dirección de la luz salvo que se pida ("luz desde arriba a la izquierda") en las dos.
5. **Movimiento lento, continuo, sin cortes y con la cámara quieta o en un solo gesto.** La
   persona maneja la cabeza de reproducción y se va a parar justo en el corte. Más lento de lo que
   parece necesario: después se muestrea.
6. **Se generan dos opciones y se elige,** en vez de iterar sobre una.

## Recetas

### Video para película con scroll
1. Imagen inicial en la proporción final. Es el cuadro 1 de todo.
2. Imagen → video: un solo movimiento (acercamiento, giro, recorrido). 8–10 s.
3. Recortar al movimiento mismo: nada antes ni después.
4. A cuadros (ver abajo). La cantidad se decide contra el largo del escenario.

### Bucle que no salta
Al generar el video, darle **cuadro inicial y cuadro final, y que sean el mismo archivo**. El clip
viaja por el movimiento y vuelve exactamente a donde empezó: el bucle sale perfecto por
construcción. El pedido describe el viaje, no los extremos. Los dos cuadros tienen que ser nítidos
(sin desenfoque de movimiento). Lo aprendimos también en Carta Viva: sin cuadro final fijo, el
generador hace zoom por su cuenta.

### Video que congela (portada)
Clip de 4–6 s que **termina quieto**. Se guarda además su último cuadro exacto como imagen
(`--final` lo saca la herramienta): la página lo muestra al terminar y el empalme no se ve. Si el
sujeto tiene que quedar por encima del título, se recorta ese último cuadro con alfa.

### Personaje que mira
Personaje sobre fondo liso, cámara fija. Video "mirando alrededor": arriba, abajo, a cada lado y
las diagonales, volviendo al frente. 45–190 cuadros según cuánto detalle se quiera. Para una
versión mínima alcanzan dos poses (mira a un lado / al otro) y un parpadeo entre ellas.

### Par para el foco que revela
Primero la imagen base, terminada. Después la segunda, pidiendo **explícitamente** que pose, luz y
encuadre queden idénticos y que cambie **una sola cosa**. Compararlas una sobre otra al 100% antes
de escribir código: si la mandíbula bajó cuatro píxeles, no hay CSS que lo arregle; se regenera.

### Capas para profundidad
Una imagen compuesta de referencia (no se usa en el sitio: sirve para que las capas coincidan en
luz y paleta) y después cada capa por separado: fondo a sangre; sujeto o puerta, con transparencia;
elementos del frente (nubes, ramas, niebla), con transparencia. Revisar los bordes al 100%: un
halo invisible en miniatura se ve mucho a tamaño portada.

## De video a cuadros

```bash
node C:/Claude/Motor/01-Capacidades/web/webi/herramientas/video-a-cuadros.js medios/toma.mp4 --salida=medios/cuadros --nombre=toma --cuadros=120 --ancho=1280
```

Deja `toma-0001.webp…`, `toma-poster.jpg`, `toma-final.jpg` y `toma.json` (el manifiesto que
lee la página). Opciones: `--hoja` (una sola imagen con todos los cuadros: un pedido en vez de
cien; conviene hasta ~60 cuadros chicos), `--web` (clip comprimido para portada), `--intra` (clip
todo-intra para mover con el scroll).

**Cuántos cuadros:**

| Uso | Cuadros | Ancho | Peso buscado |
|---|---|---|---|
| Tramo corto dentro de una sección | 60–90 | 960–1280 | 2–4 MB |
| Escenario de una portada | 120–192 | 1280 | 4–8 MB |
| Película larga, por capítulos | 240–300 | 1280–1600 | 8–14 MB |
| Personaje con el puntero | 45–190 | 720–960 | 1–4 MB |

Menos de lo que pide el instinto: se suman solo si se ve el escalón. WebP siempre (borde limpio
como PNG a peso de JPEG). Nombres con ceros a la izquierda para que ordenen bien.

## Dónde se alojan

- Hasta ~10 MB en total: junto al sitio, en `medios/`.
- Videos de portada pesados o muchas películas: en un alojamiento de medios aparte (bucket o
  servicio de video) y la página recibe la URL. Un repo no es lugar para videos grandes.
- Todo video de portada lleva **póster** (lo que se ve antes de que arranque) y va comprimido,
  sin audio.

## Antes de pasar a la página

- [ ] La proporción es la final y el sujeto sobrevive al recorte vertical
- [ ] El tramo es solo el movimiento, sin cuadros muertos
- [ ] El peso total está dentro de lo que dice la ficha
- [ ] Existen póster y cuadro final
- [ ] Los pares y las capas se revisaron superpuestos al 100%
