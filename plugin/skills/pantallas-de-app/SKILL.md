---
name: pantallas-de-app
description: Pantallas de aplicación - paneles, tableros y consolas con métricas, gráficos, tablas con estados y navegación lateral - con datos de forma real y sus estados vacío y cargando. Usar cuando se pide un dashboard, un panel de administración, "la pantalla de adentro" de un producto, una maqueta de app para mostrarle a un cliente, o gráficos (barras, dona, dial, área) para una web.
---

# Pantallas de app

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

La pantalla que está detrás de la página de venta: donde la gente vive una vez que entró. Se
arma con **datos de forma real y estados reales**, no con rectángulos grises: una maqueta con
números creíbles vende; una con "Lorem 1.234" no.

Kit: `kit/graficos.js`, `kit/pantalla.css` · Demostración: `banco/pantalla-app.html`

## Primero: qué pregunta responde la pantalla

Un panel es bueno cuando contesta **una** pregunta de un vistazo ("¿cómo viene hoy?", "¿qué
tengo que atender?"). Se escribe la pregunta, y de ella salen las tres zonas:

1. **El número** que la contesta (arriba, grande).
2. **El porqué** (el gráfico que lo explica).
3. **Lo que hay que hacer** (la lista o tabla con acciones).

## Anatomía

| Zona | Qué lleva | Decisiones |
|---|---|---|
| **Riel lateral** | 4–6 destinos con ícono | Angosto, solo íconos con etiqueta al pasar, o ancho con texto. En celular pasa a barra inferior |
| **Cabecera** | Saludo o título, buscador, período, usuario | El selector de período (hoy / 7 / 30 días) cambia toda la pantalla |
| **Métricas** | 3–4 mosaicos: valor grande, variación, chispa | La variación lleva flecha, signo **y** color (no solo color). Comparada contra un período dicho |
| **Gráfico principal** | El porqué | Uno solo grande; los demás, chicos al costado |
| **Secundarios** | Dona de reparto, dial de avance, matriz de actividad | Cada uno responde algo distinto |
| **Lista o tabla** | Lo último, lo pendiente | Estados en pastillas, filtro, acción por fila. En celular las filas pasan a tarjetas |
| **Mosaico de acento** | Una acción o un aviso | Un solo bloque de color pleno por pantalla |

## Qué gráfico

| Para mostrar | Gráfico | En el kit |
|---|---|---|
| Cómo cambia algo en el tiempo | Área o línea | `area` |
| Comparar categorías, o dos series lado a lado | Barras (emparejadas) | `barras` |
| La tendencia dentro de un mosaico | Chispa | `chispa` |
| Reparto de un total (hasta 5 partes) | Dona con el total al centro | `dona` |
| Avance hacia una meta, un puntaje | Dial segmentado | `dial` |
| Actividad por día y franja | Matriz de puntos | `matriz` |

Reglas de los gráficos: ejes mínimos con números redondos, guías tenues, etiquetas en mono chico,
sin leyenda si se puede rotular directo, el dato exacto al pasar el puntero **y** con teclado,
colores desde los tokens (cambian solos con el tema), y cada uno con un texto alternativo que
resume el dato.

## Datos de forma real

- Nombres, importes y fechas **creíbles para el rubro y el país** (pesos con separador de miles,
  nombres de acá, productos del negocio).
- **Irregulares:** un día flojo, un pedido cancelado, un nombre largo que obliga a cortar.
- Los totales **cierran** con las partes.
- Siempre los tres estados: **con datos, vacío** (qué hacer para que deje de estarlo) y
  **cargando** (esqueletos con la forma de lo que viene).

## Estilo

- El mismo sistema visual que la web del cliente (`tokens.css`), en claro u oscuro.
- Mosaicos con esquinas generosas, borde de línea y mucho aire; jerarquía por tamaño, no por color.
- Un acento, usado poco: el número clave, la barra activa, el botón principal.
- Números en la voz de título; etiquetas en mono.

## Para qué sirve en una venta

Mostrarle a un cliente **su** negocio en una pantalla (sus productos, sus canales, sus importes
estimados) antes de construir nada. Es el prototipo más convincente para vender una app o un
sistema. Va con el cartel de demo.

## Se comprueba

- [ ] De un vistazo se contesta la pregunta de la pantalla
- [ ] Los números cierran entre sí
- [ ] En 375 px: una columna, riel abajo, tabla en tarjetas, nada con scroll horizontal
- [ ] Tema claro y oscuro legibles; contraste medido en el texto chico
- [ ] Vacío y cargando existen y se ven cuidados
- [ ] Todo se puede recorrer con teclado, incluidos los datos de los gráficos
