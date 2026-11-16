# Clonar un sitio entero — cómo se usa `clone-website` en el Motor

> La skill `plugin/skills/clone-website/` es de terceros (JCodesMore, MIT), vendorizada por el guardián en el
> commit `ee3f5a2f31fd549b9593fa4f7cf6d2955ee593bb` (ver su `PROVENANCE.json`). **No se edita**: lo propio del
> Motor va en este archivo. Regla: la 5 del kit webi (`01-Capacidades/web/webi/README.md`).

## Para qué

Tener un sitio de referencia entero —estructura, layout, estilos, animaciones y comportamiento— como **punto de
partida** que después se modifica para un cliente o una demo. Para aprender una técnica suelta y sumarla al kit,
la skill es `estudiar-sitio`.

## Dónde se arma

La skill está escrita para la plantilla Next.js del autor (`src/app/`, `src/components/sites/<sitio>/`,
`public/sites/<sitio>/`, `docs/research/<sitio>/` y los scripts `npm run check` de su `package.json`). Esa
plantilla **no está en el Motor** (el guardián trajo solo la skill). Se usa una copia de la plantilla fuera del
Motor, por ejemplo la de Gaby en `C:/Claude/landing/ai-website-cloner-template/`, o se baja de nuevo pasando por
el guardián. "Read project instructions" = las de esa copia; "project check" = `npm run check` de esa copia.

## Lo que el Motor agrega

1. **Navegador:** donde la skill pide inventario y descarga de recursos y evaluación del DOM, se usa Claude in Chrome
   o el navegador del app (leer estilos calculados, variables CSS, `currentSrc`).
2. **Contenido ajeno = provisorio.** Los textos, fotos, videos, logos y marca del sitio original se marcan como
   provisorios desde el primer día (por ejemplo, un `PENDIENTES.md` en el clon con la lista). **Antes de mostrarlo
   a un cliente o publicarlo, se reemplazan** por material propio o del cliente. `revisar-sitio` lo controla.
3. **No se clona** lo que está detrás de un pago o de un inicio de sesión, ni se presenta el clon como si fuera el
   sitio original.
4. Cuando el clon pasa a ser el sitio de un cliente, vive en la carpeta de ese cliente (regla 7 del Motor) y sigue
   el camino de siempre (`revisar-sitio`, `publicar-web`).
