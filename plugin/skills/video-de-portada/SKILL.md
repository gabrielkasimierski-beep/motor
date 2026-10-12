---
name: video-de-portada
description: Video de fondo en la portada que no parece un video pegado - se reproduce una vez y queda congelado en su último cuadro, bucle sin salto, bumerán, dos clips empalmados, título gigante detrás del sujeto. Usar cuando se pide una portada con video, un "hero cinematográfico", un fondo en movimiento con footage real o generado, o cuando un video de portada se nota que reinicia, pesa demasiado o tapa el texto.
---

# Video de portada

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

Una portada con video a sangre es la forma más rápida de que un sitio se vea caro, y también la
más fácil de arruinar: el video que reinicia a la vista distrae más que no tener ninguno, y el de
banco de imágenes se reconoce al instante.

Kit: `kit/video-portada.js` · Demostración: `banco/portada.html`

## Elegir el modo

| Modo | Qué hace | Cuándo |
|---|---|---|
| **Una vez y congela** | El clip se reproduce al entrar y queda en su último cuadro exacto | El contenido es un *momento*: algo que llega, aterriza, se abre, se sirve. Es el modo por defecto: termina quieto y deja leer |
| **Bucle** | Vuelve a empezar sin que se note | El contenido es *atmósfera*: nubes, luz, agua, humo. Necesita un clip hecho para bucle (cuadro final = cuadro inicial) |
| **Bumerán** | Va y vuelve | Un giro o un vaivén que no se pudo cerrar en bucle. Necesita clip todo-intra |
| **Con botón** | Un clip aparte que se reproduce entero al tocar | Una acción (abrir una puerta, destapar). Se reproduce, no se arrastra con el scroll: por eso "aterriza" |

## Armado (una vez y congela)

```html
<header class="portada">
  <video muted playsinline preload="metadata" poster="medios/toma-poster.jpg">
    <source src="medios/toma-web.mp4" type="video/mp4">
  </video>
  <img class="portada__final" src="medios/toma-final.jpg" alt="" hidden>
  <h1 class="titulo-xl">…</h1>
  <img class="portada__recorte" src="medios/toma-recorte.webp" alt="" hidden>
</header>
```
```js
import { videoPortada } from "./kit/video-portada.js";
videoPortada(video, { modo: "una-vez", final: imgFinal, recorte: imgRecorte });
```

**El empalme que no se ve:** al terminar, el video se cambia por una imagen de su último cuadro
**exacto** (la saca `video-a-cuadros.js`). El cambio es instantáneo, sin fundido: si los dos son el
mismo cuadro, nadie lo nota, y la portada deja de gastar batería.

**El título detrás del sujeto:** el título va encima del video, y encima del título un recorte
con transparencia del sujeto en ese último cuadro, calzado píxel a píxel. El sujeto queda delante
de las letras. Para que calce, el video, la imagen final y el recorte comparten caja y
`object-fit`/`object-position`.

## Lo que hace que no parezca pegado

1. **Movimiento chico.** Un gesto sutil se lee como una página viva; uno dramático, como un video
   incrustado.
2. **Velo y degradé:** un radial oscuro blando detrás del texto y un degradé hacia el color de
   fondo en el borde inferior, para que la banda siguiente empalme.
3. **Grano encima** (`.grano`): une el video con el resto de la página.
4. **Un plano más:** una capa quieta por delante del video (una rama, un marco, niebla) da
   profundidad con una sola imagen.
5. **El texto, donde el video está tranquilo.** El encuadre se pensó con ese lugar libre.

## Dos clips empalmados

Para una toma larga que el generador no da de una: dos clips donde **el último cuadro del primero
es el primer cuadro del segundo**. Se reproducen seguidos (o cada uno en su tramo de scroll) y la
toma no corta.

## Reglas técnicas

- `muted`, `playsinline` y **póster** siempre. Sin `muted` no hay reproducción automática.
- `preload="metadata"` (o `"none"` si la portada no es lo primero) y reproducir al entrar en pantalla.
- Comprimido, sin audio, con `faststart` (`--web`). Guía: **1–3 MB** para 4–6 s a 1280 px.
- Pausado fuera de pantalla.
- Celular: el recorte vertical se decide con `object-position`. Si el sujeto no entra, hay un
  clip vertical aparte (`<source media="(max-width: 700px)">`).
- **Reducir movimiento** o reproducción bloqueada (ahorro de batería): se muestra directamente el
  cuadro final. La portada tiene que estar bien así.
- Videos pesados no van en el repo: alojamiento de medios aparte, y la página recibe la URL.

## Se comprueba

- [ ] El cambio de video a imagen no se percibe (mirarlo tres veces seguidas)
- [ ] El bucle no salta
- [ ] El título se lee en todo momento del clip, en 375 px también
- [ ] Antes de que cargue se ve el póster, no un rectángulo negro
- [ ] Con "reducir movimiento" se ve el cuadro final y nada se mueve
- [ ] El peso del clip está dentro de la ficha
