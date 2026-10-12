---
name: fondos-shader
description: Fondos animados que corren en la placa de video (shaders) - degradé de malla, aurora, metal, semitono, remolino, celdas y llama - con la paleta de la marca, y sus tres entregas (en vivo, video y foto). Usar cuando una portada o un cierre necesita un fondo que se mueva sin tener video ni foto, cuando se pide "un degradé animado", "aurora", "fondo líquido", "metal líquido", "mesh gradient", o hay que hacer la imagen para compartir o un video corto de marca.
---

# Fondos shader

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

La parte de una página que nadie sabe nombrar y todos notan: el degradé lento detrás del título,
la luz que se mueve bajo el pliegue. Corre en la placa de video, hace bucle sin costura y **no
pesa nada** al lado de un video de lo mismo. Es la pieza firma cuando el cliente solo tiene
palabras.

Kit: `kit/fondo-shader.js` (un archivo, sin dependencias) · Demostración: `banco/shaders.html`

```js
import { fondoShader } from "./kit/fondo-shader.js";
const fondo = fondoShader(canvas, { familia: "aurora", velocidad: 0.6, grano: 0.05 });
// sin `paleta`, toma los colores de la marca desde tokens.css
```

## Las siete familias

| Familia | Qué es | Ánimo | Va con |
|---|---|---|---|
| `malla` | Manchas blandas de color que se desplazan | Tranquilo, actual | Servicios, software, estudios. La más segura |
| `aurora` | Cortinas de luz sobre oscuro | Nocturno, mágico | Lanzamientos, eventos, bienestar |
| `metal` | Cromo o acero con reflejos | Técnico, lujo | Autos, joyas, herramientas, finanzas |
| `semitono` | Puntos de imprenta que respiran | Gráfico, editorial | Estudios de diseño, medios, moda |
| `remolino` | Cintas que giran | Hipnótico | Música, bebidas, marcas jóvenes |
| `celdas` | Mosaico orgánico que deriva | Orgánico, ciencia | Salud, alimentos, biotecnología |
| `llama` | Lenguas que suben | Calor, energía | Parrillas, gastronomía, deporte |

Cada familia con otra paleta es otra pieza: la variedad sale de **familia × paleta**.

## Paleta

Hasta cinco colores; **el primero es el fondo**. Por defecto salen de los tokens (`--tinta`,
`--acento-hondo`, `--acento`, `--acento-claro`, `--hueso`), así el fondo ya es de la marca.

- Para un fondo que deje leer: fondo oscuro + dos tonos del acento. Más colores, más ruido.
- Un color "extraño" en poca cantidad (un coral en una paleta azul) le da vida.
- En tema claro, bajar la saturación y subir el grano.

## Que se pueda leer encima

Un fondo que se mueve compite con el título. Siempre:

1. **Velo** radial oscuro (o claro) blando detrás del bloque de texto.
2. **Degradé** hacia el color de fondo en el borde inferior, para empalmar con la banda siguiente.
3. **Velocidad baja** (0.4–0.8). Si se nota que se mueve mientras se lee, está rápido.
4. **Grano** 0.03–0.06: saca el aspecto digital y evita las bandas del degradé.

## Tres entregas de la misma pieza

| Entrega | Cómo | Para qué |
|---|---|---|
| **En vivo** | El componente en un `<canvas>` | La página |
| **Foto** | `await fondo.foto()` → PNG | Imagen para compartir el link, póster, fondo de una placa |
| **Video** | `await fondo.grabar(6)` → webm | Historia o reel de la marca, fondo en una presentación |

Con un fondo resuelto, el cliente se lleva además su imagen de redes y un video corto.

## Reglas

- **Un canvas en vivo por pantalla visible.** Los demás se pausan solos fuera de pantalla; si hay
  muchos mosaicos, usar la foto y encender en vivo solo al pasar el puntero.
- `dprMax` 1.5: en un fondo blando no se nota y ahorra la mitad del trabajo.
- **Reducir movimiento:** dibuja un cuadro y queda quieto (sigue viéndose como una imagen cuidada).
- **Sin WebGL:** queda un degradé CSS de la misma paleta.
- En celulares de gama baja, `escala` más grande y `velocidad` más baja; si aun así cuesta, la foto.
- El canvas va detrás (`position: absolute; inset: 0`), con `aria-hidden="true"`.

## Sumar una familia

Una familia nueva es un fragmento de shader que recibe los mismos uniformes (tiempo, resolución,
paleta, escala, grano, semilla, puntero). Se escribe propia, se agrega al archivo, se suma a la
página del banco y a la tabla de arriba.

## Se comprueba

- [ ] El título se lee en cualquier momento del ciclo
- [ ] No se ven bandas en el degradé ni parpadeo
- [ ] Fuera de pantalla no consume (la página quieta abajo de todo no calienta)
- [ ] La foto y el video se descargan y coinciden con lo que se ve
- [ ] Con la paleta del cliente sigue viéndose bien, no solo con la de muestra
