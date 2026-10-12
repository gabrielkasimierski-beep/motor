---
name: escena-3d
description: Escenas 3D en el navegador con three.js - objeto procedural que se desarma con el scroll, modelo que el scroll posa y que se acopla a un hueco de la página, cámara por capítulos, partículas que arman una figura, luz de estudio y fondos con profundidad. Usar cuando se pide un producto en 3D, una "web 3D", WebGL, un modelo .glb en la página, una vista explotada, partículas, o cuando hay que decidir si una idea necesita 3D de verdad o alcanza con cuadros o capas.
---

# Escena 3D

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

El 3D es la pieza más cara del motor en trabajo y en riesgo. Se usa cuando el objeto **tiene que
responder de formas que un video no puede**: verse desde cualquier ángulo, desarmarse en piezas
con nombre, reaccionar al puntero, acomodarse dentro de la página.

Kit: `kit/escena3d.js` · Demostración: `banco/escena-3d.html`

## Antes: ¿hace falta 3D?

| Lo que se quiere | Alcanza con |
|---|---|
| Que gire o se acerque con el scroll | `pelicula-con-scroll` (se ve mejor y anda en todos lados) |
| Sensación de profundidad en una imagen | `profundidad-por-capas` |
| Que el producto real se vea fiel | Fotos y video reales |
| Desarmarlo, mirarlo libre, que reaccione, partículas, física | **3D** |

En Carta Viva quedó claro: fotos reales primero, el 3D como opción que se carga solo si se elige.

## Tres caminos para el objeto

1. **Procedural (sin modelo).** Todo es geometría escrita en código: cada pieza es una variable
   que se cambia pidiéndolo. No hay archivo que exportar ni megas que bajar. Sirve para objetos
   de formas simples (frasco, lámpara, engranaje, cámara, instrumento). Las referencias que
   ayudan son de **las partes**, no del objeto entero.
2. **Modelo `.glb`.** Un producto real escaneado o generado. Hay que optimizarlo (2–3 MB como
   mucho), y los generados por IA vienen en escala de ~1 metro: se llevan a tamaño real. Son una
   muestra convincente, no una copia fiel.
3. **Partículas.** Miles de puntos que pasan de dispersos a una figura (una letra, un logo, una
   silueta). Los destinos se muestrean de un texto o una imagen (`puntosDeTexto`).

## Se arma por etapas (no es cortesía: es poder depurar)

1. **Geometría.** Formas y posiciones, con material plano. Se ve bien quieta.
2. **Materiales y luz.** Vidrio, metal, la luz de estudio (`luzDeEstudio`: principal, relleno y
   un contraluz del color del acento).
3. **Scroll.** Nada se mueve hasta que se ve bien parado.

Si las tres llegan juntas y algo está mal, no se sabe cuál de las tres es. Y no se pule una etapa
que todavía no es correcta: buen material sobre mala geometría es trabajo perdido dos veces.

## Los movimientos

- **El objeto queda en el centro y la página pasa.** El scroll lo *posa* (rota, inclina, abre);
  no lo pasea por la pantalla.
- **Cámara por capítulos** (`camaraPorCapitulos`): poses resueltas a mano (posición y a dónde
  mira) y el progreso interpola entre ellas. Tres o cuatro encuadres pensados valen más que una
  órbita libre.
- **La luz también se mueve:** girar la luz principal alrededor del objeto con el scroll cambia
  el ánimo sin tocar la geometría.
- **Vista explotada:** las piezas se separan sobre un eje, con una línea fina y una etiqueta
  HTML en cada una (el punto 3D se proyecta a pantalla).
- **Acople al DOM** (`acoplar`): al final, el objeto se achica y se acomoda en un hueco de la
  página (una tarjeta con precio y botón). El 3D termina siendo la foto del producto.
- **Inclinación hacia el puntero:** unos pocos grados, amortiguados.

## El fondo no es un detalle

Un objeto procedural no trae su ambiente. Sobre un gris plano, una escena buena parece un
prototipo. Es el cambio de más rendimiento: un fondo con profundidad de verdad (degradé + campo de
puntos, un `fondo-shader` detrás, niebla) y, mejor, que también responda. Se referencia aparte del
objeto.

## Rendimiento y respaldo

- three.js **duerme** hasta que la escena está por entrar en pantalla (`escena3d` lo hace).
- `devicePixelRatio` limitado (2; en celular 1.5). Menos partículas en celular.
- Se dibuja solo en pantalla y con la pestaña visible.
- Los materiales transmisivos (vidrio real) son caros: probar primero en un celular medio.
- **Sin WebGL:** el contenedor recibe `.sin-3d` y la página muestra una imagen del objeto. Esa
  imagen existe siempre; es también el póster mientras carga.
- **Reducir movimiento:** sigue respondiendo al scroll (lo maneja la persona) pero sin animación
  propia ni giro en reposo.

## Depurar

Con capturas y una diferencia nombrada. Los parámetros (separación, ritmo, intensidad de luz) en un
panel con deslizadores: afinar con un deslizador lleva segundos; pedir cada ajuste, una
reconstrucción.

## Se comprueba

- [ ] Quieta y sin scroll, la escena ya se ve terminada
- [ ] El objeto nunca se sale de cuadro ni se corta en 375 px
- [ ] Las etiquetas siguen a sus piezas y no se pisan
- [ ] El acople cae exactamente en el hueco al cambiar el tamaño de la ventana
- [ ] En un celular medio se mueve fluido; si no, bajar partículas, DPR o materiales
- [ ] El respaldo `.sin-3d` se ve bien
