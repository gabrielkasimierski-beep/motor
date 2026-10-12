---
name: estudiar-sitio
description: Estudia un sitio web ya publicado y convierte lo que hace en técnicas, skills y piezas del kit webi del Motor. Usar cuando pasan un link y pide "analizá este sitio", "sacá las skills de…", "quiero aprender cómo hicieron…", "sumá esto al motor", o cuando un sitio de referencia tiene un efecto que el motor todavía no sabe hacer.
---

# Estudiar un sitio

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

El resultado de un estudio no es un informe: es el motor sabiendo hacer algo nuevo. Un estudio
termina cuando la técnica quedó en una skill, la pieza en `kit/` y la prueba en `banco/`.

> **Este trabajo cambia el Motor, que es compartido.** Se hace con la sesión abierta en el Motor, en una
> rama (`git worktree`, ver `C:/Claude/Motor/CONTRIBUTING.md`), y entra por Pull Request. Nunca desde
> el proyecto de un cliente ni directo sobre `main`.

## Qué se toma y qué no

Se toma **cómo funciona**: el mecanismo, la estructura, las medidas que se ven (largos, tiempos,
curvas, cantidad de cuadros), el stack y el método de trabajo que el sitio cuente en público.

No se toma **la obra**: textos, imágenes, videos, código fuente, ni nada que esté detrás de un
pago o de un inicio de sesión. No se inicia sesión, no se aprietan botones de "copiar" de material
de pago, no se descargan sus archivos. Si la única forma de aprender algo es saltar esa barrera, se
anota como "no disponible" y se resuelve con conocimiento propio.

## Pasos

1. **Relevar** con el navegador integrado, leyendo texto y estructura (no capturas). Los
   fragmentos listos están en [relevamiento.md](relevamiento.md). En este orden:
   - portada: bandas en orden, de arriba abajo
   - stack: scripts, hojas de estilo, variables globales, `generator`
   - sistema visual: colores, tipos, curvas y `@keyframes` de las hojas de estilo
   - mapa del sitio (`/sitemap.xml`) y páginas de listado: qué ofrece y cuánto
   - páginas públicas de aprendizaje (blog, academia, docs): ahí suele estar el **cómo**
2. **Clasificar por mecanismo, no por nombre.** Cien plantillas suelen ser seis técnicas. La
   pregunta para cada pieza: *¿qué entra, qué lo mueve y dónde se dibuja?*
   (un video → el scroll → un canvas; dos imágenes → el puntero → una máscara).
3. **Cruzar con el motor.** Para cada mecanismo, mirar el mapa de `C:/Claude/Motor/01-Capacidades/web/webi/README.md`:
   - ya lo cubre una skill → sumarle la variante o el dato nuevo
   - no lo cubre nadie → proponer skill nueva, con su pieza de kit
   - es un detalle suelto → va a `componentes-vivos` como receta
4. **Escribir el estudio** en `referencias/<sitio>/analisis.md`, con la misma forma que
   el de Scrolltide (`referencias/scrolltide/analisis.md`): qué es, cómo está hecho,
   qué ofrece, los mecanismos (tabla con "cómo funciona" y "skill nuestra"), el método y cómo
   quedó repartido en el motor. En palabras propias; nombres de piezas ajenas solo como referencia.
5. **Proponer** (a quien pidió el estudio) qué entra al motor (una tanda corta de opciones) si el estudio abre una
   línea nueva. Si son variantes de lo que ya hay, se suman directo.
6. **Construir lo nuevo:** Opus define la firma en `kit/CONTRATO.md` y escribe el encargo; Sonnet
   escribe la pieza y su página del banco; Opus la prueba en el navegador.
7. **Cerrar:** actualizar la skill que corresponde, la tabla "Sitios estudiados" de
   `C:/Claude/Motor/01-Capacidades/web/webi/README.md`, la tarjeta en `banco/index.html` y, si hay skill nueva, la tabla de
   `C:/Claude/Motor/GUIA-DE-USO.md`.

## Señales de un buen estudio

- Cada mecanismo se explica en una línea que un obrero puede implementar.
- Hay números: cuántos cuadros, cuánto mide el escenario, cuánto dura, qué curva.
- Quedó escrito qué **no** se tomó y por qué.
- El motor tiene una página del banco que antes no tenía.
