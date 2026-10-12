---
name: revisar-sitio
description: Revisión de un sitio con movimiento antes de mostrarlo o publicarlo - tamaños de pantalla, táctil, reducir movimiento, peso, escenarios fijos, y el pulido final. Usar cuando una página "ya anda" y hay que dejarla terminada, antes de pasarle un link a Gaby o a un cliente, cuando algo de scroll se rompe (salta, queda pegado, una banda negra, un pie que no se queda), o cuando un arreglo pareció demasiado fácil.
---

# Revisar un sitio

> **Kit webi:** las rutas `kit/`, `banco/`, `herramientas/` y `referencias/` de esta skill viven en
> `C:/Claude/Motor/01-Capacidades/web/webi/` (el mapa está en su `README.md`). En el sitio del cliente, `kit/` es la copia que
> deja `nuevo-sitio.js`.

> Esta revisión es la del **movimiento**. La lista general de toda web (textos, formulario, SEO,
> accesibilidad) es `C:/Claude/Motor/00-Motor/control-calidad.md`: se pasan las dos.

Lograr algo que impresiona es el primer diez por ciento. El noventa restante es que parezca
terminado y no generado. Esta revisión es ese noventa.

## Cómo se mira

Con el servidor local y el navegador integrado. Se lee la consola primero (errores y 404), después
se recorre. Para lo visual: captura a tamaño reducido, y **una diferencia nombrada por vez**.
Tamaños: **375** (celular), **768** y **1280**. El celular se revisa primero.

## Lista

### Se entiende y se puede actuar
- [ ] En la primera pantalla se sabe qué es y hay un botón para actuar, en 375 px también
- [ ] El botón principal responde antes de que termine de cargar la pieza firma
- [ ] Ningún texto queda encima del sujeto ni cortado en ningún tamaño
- [ ] Los datos del negocio están verificados o marcados `{completar}`; una demo dice que es demo

### El movimiento
- [ ] Con rueda de mouse y con trackpad el recorrido se siente parecido (son muy distintos)
- [ ] Cada escenario fijo **suelta** bien: la banda siguiente entra sin salto ni hueco
- [ ] Al subir, todo vuelve por donde vino
- [ ] Nada anima fuera de pantalla (mirar el uso de CPU con la página quieta abajo de todo)
- [ ] Recargar a mitad de página deja todo en un estado coherente

### Táctil
- [ ] Lo que seguía al puntero tiene su versión decidida (se mueve solo, responde al arrastre o queda quieto)
- [ ] Arrastrar un carrusel no traba el scroll vertical de la página
- [ ] No hay nada que dependa de pasar el puntero por encima para poder leerse

### Reducir movimiento
- [ ] Con la preferencia activada se lee todo y cada pieza muestra su estado final quieto
- [ ] Ningún video arranca solo

### Peso y carga
- [ ] `node C:/Claude/Motor/01-Capacidades/web/webi/herramientas/archivos-del-sitio.js <carpeta>`: sin avisos, o cada aviso justificado
- [ ] Lo primero que se pinta es liviano: el póster, no el video; el cuadro 1, no los 120
- [ ] Los cuadros se piden al acercarse la sección y el cargador muestra progreso **real**
- [ ] Fuentes: solo los pesos que se usan, con `display=swap`

### Pulido (lo que separa un prototipo de un sitio)
- [ ] Espacios parejos entre bandas; una sola escala de tipos
- [ ] El fondo de cada escena es un fondo de verdad, no un color plano
- [ ] Estados: foco visible con teclado, botón apretado, campo con error, lista vacía
- [ ] Título de la pestaña, descripción, imagen para compartir y favicon
- [ ] Los paneles de deslizadores del armado ya no están

## Cuando algo se rompe

**Capas y posiciones son la falla más común** en páginas con scroll. Antes de tocar nada:

| Síntoma | Mirar primero |
|---|---|
| Un `position: sticky` no pega | Un ancestro con `overflow: hidden/auto` o con altura fija; usar `overflow-x: clip` en vez de `hidden` |
| Banda negra o blanca a pantalla completa | Un escenario cuya pista quedó sin altura, o una capa `fixed` que no se oculta al salir |
| El escenario salta al soltar | La pista y la escena no miden lo que se cree (`100vh` contra `100svh` en celular) |
| El pie queda detrás o encima de todo | Contextos de apilamiento: un `transform` o `filter` en un ancestro crea uno nuevo |
| El canvas se ve borroso o estirado | Tamaño interno contra tamaño CSS y `devicePixelRatio` |
| Se traba al hacer scroll | Algo mide el DOM en cada evento de scroll en vez de una vez por cuadro |

**"Se ve bien de nuevo" no es "se arregló".** Si el arreglo fue chico para el tamaño de la rotura
(un `z-index: 9999`, un `!important`, un `setTimeout`), es un parche que tapa la causa. Se busca la
causa, se arregla ahí y se saca el parche.

## Cómo se muestra

Nada sale a un tercero sin el OK de quien lleva el cliente (regla 3 del Motor). Para mostrárselo: el sitio como Artifact con sus
archivos al lado (`node C:/Claude/Motor/01-Capacidades/web/webi/herramientas/archivos-del-sitio.js <carpeta> --json` da la lista), que
nace privado. El link para un cliente es siempre uno público y estable, nunca el del Artifact.
