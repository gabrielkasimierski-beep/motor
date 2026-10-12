---
name: profundidad-por-capas
description: Profundidad sin motor 3D - imágenes planas separadas por distancia que se mueven a ritmos distintos con el scroll y el puntero (paralaje), y la variante portal que atraviesa una puerta, ventana o arco. Usar cuando se pide paralaje, "que tenga profundidad", "que se sienta 3D" a partir de una foto o ilustración, una escena en la que se entra al hacer scroll, o cuando hay una sola buena imagen y se le quiere sacar una escena.
---

# Profundidad por capas

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

El truco más viejo de la animación y todavía el más convincente en la web: no hay geometría, hay
**imágenes planas ordenadas por distancia que se mueven a ritmos distintos**. La profundidad sale
de las capas. Pesa poco, anda en cualquier celular y se arma con cualquier juego de imágenes.

Kit: `kit/capas.js` · Demostración: `banco/capas.html`

## Qué imagen sirve

Una composición con **primer plano, medio y fondo claros**. Una imagen que ya es plana no se
puede separar de forma creíble por buena que sea. Para el portal hace falta un **"a través"**: una
puerta, un arco, una ventana, el hueco entre dos cosas.

## Las capas (skill `fabricar-recursos`)

1. Una **imagen compuesta de referencia** para acordar luz y paleta. No se usa en el sitio.
2. Cada capa **por separado**: fondo a sangre; cada plano siguiente con transparencia.
3. Entre **3 y 6** capas alcanzan. Más de eso solo si salen de un mismo render (un cielo, tres
   filas de montañas, árboles, niebla).
4. Cada capa un poco **más grande que la pantalla** (10–20%), porque se va a mover y no puede
   mostrar su borde.

## Paralaje

```js
import { capas } from "./kit/capas.js";
capas(escenarioEl, {
  capas: [
    { el: cielo,     profundidad: 0.05 },
    { el: montanas,  profundidad: 0.25 },
    { el: arboles,   profundidad: 0.6  },
    { el: niebla,    profundidad: 1, y: [0, -30] },
  ],
  puntero: { fuerza: 10 },
});
```

- **La más cercana se mueve más; la más lejana, casi nada.** Esa relación es todo.
- Se afinan los **ritmos relativos**, no cada capa por separado. Si todas se mueven parecido, se
  lee como una imagen que se desliza; si la diferencia es exagerada, se despegan.
- **La deriva del puntero** suma encima un movimiento chico (8–14 px en la capa más cercana).
- **Lo primero que sale del cuadro es lo más cercano.**
- **Oclusión correcta:** si algo pasa "por delante" de un sujeto (fragmentos, hojas), tiene que
  estar en una capa por encima recién cuando despeja su contorno. Se resuelve con un recorte del
  sujeto en una capa intermedia.

## Portal

```js
import { portal } from "./kit/capas.js";
portal(escenarioEl, { puerta, fondo, frente: [nubes], escalaFinal: 9, origen: [0.5, 0.55] });
```

La puerta crece hasta pasar por encima de quien mira; el fondo se acerca mucho más despacio; lo
del frente (nubes, niebla) se va más rápido que todo, porque es lo más cercano. Al final el fondo
queda a pantalla completa y es la banda siguiente.

- `origen` es el centro del vano: desde ahí escala.
- La escala **acelera hacia el final** (uno "cae" dentro). Lineal se siente como un zoom de cámara.
- El borde interior de la puerta tiene que aguantar verse muy grande: recurso en alta o en SVG.

## Orden de armado

1. La pila **quieta**: tres capas apiladas, en orden, llenando la pantalla. Se confirma antes de
   pedir un solo cuadro de animación.
2. Bordes, escala y alineación, **todavía sin mover**. Una costura que se ve quieta se ve mucho
   más en movimiento.
3. Recién ahí el scroll. Los ritmos, expuestos en un panel, para afinarlos sin rehacer.
4. Contra la referencia: captura al lado de la referencia y una diferencia por vez.

## Celular y accesibilidad

- En táctil no hay deriva de puntero; el paralaje con scroll sigue, con ritmos más cortos.
- En pantallas angostas se sacan capas intermedias antes que achicar todo.
- Con "reducir movimiento": la composición quieta, completa.

## Se comprueba

- [ ] Ninguna capa muestra su borde en ningún punto del recorrido, a 375 y a 1920 px
- [ ] Quieta, la composición ya se ve bien
- [ ] Se percibe profundidad y no "imágenes que se deslizan"
- [ ] El portal termina con el fondo ocupando toda la pantalla, sin salto a la banda siguiente
- [ ] Rueda y trackpad
