# Catálogo de componentes — recetas

Cada fila: qué hace, con qué se hace y el truco que la sostiene. **En el kit** = ya está escrita y
probada en el banco. Lo demás es receta lista para encargar. Las familias vienen del estudio de
Scrolltide; los nombres y las recetas son nuestros.

## Carruseles planos

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Arco | Tarjetas sobre un círculo enorme, la enfocada derecha en la cima | CSS + JS | Una sola rotación del contenedor con el centro muy abajo | ✔ `carrusel-arco` |
| Astillas que se abren | Riel de tiras altas; una se ensancha | CSS (flex) | Epígrafe maquetado una vez al ancho abierto | ✔ `tarjetas-expandibles` |
| Abanico | Mano de naipes; la enfocada "se levanta" | CSS + JS | La enfocada sale de la escala de sus vecinas (no es "la más cercana": está aparte) | receta |
| Mazo con bisagra | Naipes abiertos desde un punto bajo el mazo | CSS | Una rotación con el pivote fuera del borde inferior | receta |
| Riel solapado | Tira de tarjetas altas, cada una inclinada a su modo, se arroja | JS | Inercia + enderezar al pasar el puntero; clic abre a pantalla completa | receta |
| Foco central | Fotos en teja; la del medio se abre con su epígrafe | CSS + JS | Re-encuadra (cambia el recorte) en vez de escalar | receta |
| Publicación con álbum | Una "publicación" con carrusel y el resto del álbum flotando a los lados | JS | Al cambiar, las vecinas viajan desde detrás a su nuevo lugar | receta |

## Carruseles con profundidad

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Anillo | Tarjetas alrededor de un cilindro que se gira arrastrando | CSS 3D | El lado lejano se ve por los huecos; `z-index` calculado por cuadro | ✔ `carrusel-anillo` |
| Rueda de fichas | Decenas de páginas de canto alrededor de una rueda inclinada | CSS 3D + JS | Mismo orden de profundidad a mano, con inercia | receta |
| Coverflow de canto | Cada tarjeta gira más de canto al alejarse hasta ser una astilla | CSS 3D | Sin canvas; las de los costados se funden en vidrio esmerilado | receta |
| Hélice | Paneles curvos enroscados que avanzan como un tornillo | CSS 3D o WebGL | El lado de atrás, esmerilado, visible entre los huecos | receta |
| Cinta en ola | Tarjetas sobre una cinta que sube una cresta y se hunde en niebla | WebGL | Los títulos van impresos en la superficie: la letra se curva con la tarjeta | receta |
| Lente al pasar rápido | Deslizador horizontal que se abomba al scrollear rápido | WebGL | La panza es una lente fija en el centro; la velocidad maneja su fuerza | receta |
| Galería envolvente | Retratos sobre un anillo que rodea a quien mira | CSS 3D | Los espacios se resuelven en pantalla, así quedan parejos en los bordes | receta |

## Tarjetas

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Tarjeta con video | Póster quieto, video al pasar, borde de luz que orbita | CSS + JS | `preload="none"`; `conic-gradient` con `@property` y máscara para dejar solo el borde | ✔ `tarjeta-video` |
| Pasos con línea | Pasos unidos por una punteada que se dibuja | SVG + scroll | El recorrido se mide de los puntos reales; `stroke-dashoffset` atado al progreso | ✔ `pasos-camino` |
| Pastilla que se vuelve tarjeta | Un avatar en pastilla crece hasta ser una ficha | JS | Una sola superficie entre dos maquetas medidas | receta |
| Acordeón con imagen | Pasos numerados; la imagen se desliza junto al abierto | CSS + JS | Avanza solo y se detiene mientras se lee | receta |
| Mazo de historias | Testimonios junto a un mazo que se arroja | JS | La de arriba vuela, entra la siguiente; anillo de progreso en el botón | receta |
| Lista con retrato | Lista de nombres + un retrato grande que cambia | CSS + JS | Las letras del nombre ruedan de a una; el retrato se limpia hacia abajo | receta |
| Carpeta | La pestaña baja y asoma un objeto recortado | CSS + SVG | La muesca es una máscara SVG: la cara puede ser cualquier degradé | receta |
| Marco elástico | Un marco que se "pulsa" como una cuerda al acercar el puntero | SVG + JS | El borde es una curva con resortes | receta |
| Galería que irrumpe | Al pasar por una foto, otra la atraviesa con un efecto | SVG/WebGL | Varias máscaras intercambiables; la página se tiñe con el color de la foto | receta |

## Texto

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Foco de cámara | Las palabras están borrosas hasta que un marco las enfoca | CSS + JS | Cajas medidas: sirve con cualquier tipografía | ✔ `texto-foco` |
| Palabra que se deshace | Se desarma en partículas y vuelve | Canvas | Cada recorrido es función del tiempo: el retroceso es exacto | receta |
| Grilla que corta | Una palabra vista por una grilla gruesa que el puntero arrastra | Canvas / WebGL | Las celdas se mueven como bloques: las letras se cortan en escalones | receta |
| Título que se escribe | Se tipea solo, con cursor | JS | Velocidad irregular; respeta "reducir movimiento" mostrando el texto entero | receta |

## Fondos que reaccionan

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Estela de imágenes | Deja figuritas por donde pasa el puntero | JS | Espaciadas por distancia; no bloquean los clics | ✔ `estela-imagenes` |
| Grilla que se hunde | Puntos casi invisibles que el puntero deforma | Canvas 2D | Una sola campana de Gauss; no hace falta shader | receta |
| Lente de tramado | Una foto se vuelve grabado bajo el puntero | Canvas 2D | Solo la zona del puntero se procesa; el resto sigue siendo la imagen real | receta |
| Mosaico que florece | Miniaturas grises que se agrandan y toman color al pasar | WebGL | Un solo pase, por densa que sea la grilla | receta |
| Vidrio acanalado | Una imagen detrás de vidrio con costillas | WebGL | Cada costilla es una lente con una tajada comprimida de la imagen | receta |
| Costura que se derrite | Imágenes a sangre cuyas uniones se marmolan al scrollear rápido | WebGL | La fuerza depende de la velocidad del scroll | receta |

## Botones y cargador

| Pieza | Qué hace | Con qué | El truco | Kit |
|---|---|---|---|---|
| Botón de vidrio | Desenfoca el fondo; el brillo del bisel sigue al puntero | CSS | Luces y presión sobre propiedades registradas; JS solo escribe variables | ✔ `boton-vidrio` |
| Anillo que orbita | Ícono con un aro iridiscente que lo recorre | CSS | `conic-gradient` + `@property`; se asienta al pasar | receta |
| Enviar que avisa | El botón de enviar se enciende a medida que se llena el campo | CSS + JS | El control dice que está listo antes de que se lo busque | receta |
| Entrada de página | Lema palabra por palabra → logo → la pantalla se abre | CSS + JS | Se ata a la carga real y se saca del DOM | ✔ `cargador-intro` |
| Cinta infinita | Texto o logos que pasan sin fin | CSS | `translate(-50%)` sobre contenido duplicado | ✔ `marquesina` |

## Objetos 3D sueltos

| Pieza | Qué hace | Con qué | El truco |
|---|---|---|---|
| Campo de bloques | Bloques que ondulan como agua bajo el puntero | WebGL | Cada bloque es un resorte atado a sus vecinos |
| Globo de puntos | Continentes hechos de puntos que giran; se arrastra con inercia | WebGL | Los puntos se muestrean de un mapa |
| Tecla de vidrio | Una tecla que gira con el cursor y se hunde al clic | WebGL | La etiqueta está hundida en la superficie, no impresa |

Estas van con `escena-3d` (three.js dormido) y solo si son la pieza firma.
