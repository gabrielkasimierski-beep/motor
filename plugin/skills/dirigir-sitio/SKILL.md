---
name: dirigir-sitio
description: Dirección de un sitio con movimiento antes de escribir código - concepto, elección de la pieza firma (película con scroll, video de portada, 3D, fondo shader…), guion de bandas y ficha de cada pieza. Usar cuando la web o landing de un cliente va a llevar movimiento o un efecto protagonista ("quiero que impacte", "que el producto gire", "un sitio tipo Apple", "qué efecto le ponemos"), cuando `construir-web` deriva acá, o cuando un sitio en marcha "se ve hecho con IA" y hay que darle dirección.
---

# Dirigir un sitio

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

Un pedido de una línea devuelve el promedio de todos los sitios que existen. Lo que hace que un
sitio sea *uno* es decidir, antes del código, qué entra primero, cuánto viaja y qué le hace el
scroll al fondo. Esa decisión es este trabajo.

**Su lugar en el Motor:** `construir-web` es el camino de siempre (la web que genera consultas: catálogo,
blog, formulario). Esta skill entra cuando ese sitio lleva una **pieza firma con movimiento**: dirige esa
parte y `construir-web` resuelve el resto. El Norte no cambia: el movimiento nunca demora el botón de contacto.

## 1. Juntar lo que hay

Del brief del cliente: qué vende, a quién, qué acción se busca (casi siempre termina en WhatsApp
con una persona), y **qué material existe**: logo original, fotos, videos, el lugar, el producto.
El material bueno suele existir y hay que pedirlo antes de inventar.

Buscar **referencias** para el sitio entero, no solo para la portada: una por banda. Se elige un
resultado que ya se vio funcionando; no se describe uno que se espera.

## 2. Elegir la pieza firma (una sola)

| Lo que el cliente tiene | Pieza firma | Recurso que hay que fabricar | Peso |
|---|---|---|---|
| Un producto que se luce (bebida, mueble, perfume, moto) | `pelicula-con-scroll`: gira, se acerca, se desarma | 1 video de 8–10 s de un solo movimiento → 120–240 cuadros | 4–10 MB, llega tarde |
| Un lugar (local, hotel, obra, taller) | `pelicula-con-scroll` (recorrido) o `video-de-portada` | 1 toma continua, sin cortes | 3–8 MB |
| Un momento (algo que llega, se sirve, se abre) | `video-de-portada` que congela en su último cuadro | 1 clip de 4–6 s + su último cuadro | 1–3 MB |
| Una mascota o personaje de marca | `escena-con-puntero`: mira al cursor | 1 video "mirando alrededor" → 45–190 cuadros | 1–4 MB |
| Un antes/después o un "por dentro" | `escena-con-puntero`: foco que revela | 2 imágenes idénticas salvo lo revelado | < 600 KB |
| Una imagen con profundidad (paisaje, fachada, mesa servida) | `profundidad-por-capas` | 3–6 capas recortadas por distancia | < 1 MB |
| Un producto técnico, o presupuesto para el "wow" | `escena-3d` | nada (procedural) o un `.glb` | 0,6 MB de three + lo propio |
| Solo palabras (servicio, estudio, software) | `fondos-shader` + tipografía | nada | 0 KB |

Reglas para elegir:

- **Una pieza firma por sitio.** Dos compiten y duplican el peso.
- **Gana la que el recurso permite hacer bien.** Sin buen video no hay película.
- **Mirá el celular primero:** la mayoría entra desde ahí. Una pieza que solo vive con cursor
  necesita su versión táctil decidida ahora, no al final.
- **Si el negocio vive de que lo llamen hoy,** la pieza firma no puede demorar el botón de
  contacto: el botón está visible antes de que termine de cargar la escena.

## 3. Escribir el guion de bandas

El orden de la página, de arriba abajo, con una línea por banda: qué dice, qué hace y qué skill la
resuelve (`secciones-de-pagina` tiene el catálogo). El guion marca **dónde está el movimiento y
dónde el descanso**: después de un escenario fijo viene una banda quieta.

## 4. Una ficha por pieza

Cada pieza que no sea trivial lleva su ficha con la [plantilla](plantilla-ficha.md). La ficha es lo
que recibe Sonnet como encargo: zonas, tipos, color, movimiento, scroll, recursos, adaptación,
dependencias y cómo se comprueba. Nada de adjetivos ("premium", "moderno"): medidas.

## 5. Encargar, banda por banda

- La pieza firma primero y **quieta** (maqueta estática correcta) antes de moverla.
- Después las bandas, de a una, cada una con su referencia.
- Cada encargo a Sonnet es cerrado: archivos, ficha, y cómo se verifica. Trabaja contra
  `kit/CONTRATO.md` y copia del kit (`node C:/Claude/Motor/01-Capacidades/web/webi/herramientas/nuevo-sitio.js`).
- Las correcciones: **una captura y una diferencia nombrada por vez** ("el título pisa al sujeto
  en 375 px"), nunca "hacelo más lindo".
- Lo que se afina a ojo (radio de un foco, largo de un escenario, ritmos de capas) se expone en un
  panel con deslizadores durante el armado y se saca antes de publicar.

## Señales de "hecho con IA" (revisar el guion contra esta lista)

- Título centrado + tres tarjetas iguales + degradé + captura de pantalla.
- Todo entra igual: mismo desvanecido hacia arriba en cada elemento de la página.
- Íconos de emoji, frases que sirven para cualquier negocio, números redondos inventados.
- Una sola familia de letra para todo y ningún tamaño realmente grande.
- Video de banco de imágenes de fondo.
- Una portada espectacular y debajo cuatro bandas sin dirección.

Lo que lo rompe siempre es lo mismo: una decisión específica donde había un promedio.
