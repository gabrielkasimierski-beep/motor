# Publicador de redes

`publicador-meta/` es una plantilla reutilizable del publicador directo de Meta y su asistente de conexión local. Permite conectar una cuenta de Instagram, verificarla, simular una publicación y publicar piezas ya preparadas cuando estén autorizadas.

## Usarlo en un proyecto

1. Creá una carpeta local para el proyecto y copiá allí **el contenido completo de `publicador-meta/`**, incluidos `.gitignore` y `.env.ejemplo`. Trabajá desde esa copia; la plantilla del Motor queda sin credenciales ni estado de una cuenta real.
2. Instalá **Node.js 22 o posterior**. Estas herramientas usan módulos incluidos en Node; no necesitan `npm install`.
3. En el `config.json` de la copia, completá `meta.usuarioInstagram` con el usuario esperado **sin `@`**. Definí `medios.baseUrl` con la dirección HTTPS pública de los medios cuando esté disponible. El token se guarda en `.env`, nunca en `config.json`.
4. Ejecutá `npm run conectar` o, en Windows, abrí `conectar-instagram.cmd`. El navegador se abre con un formulario local; pegá allí el token generado en el panel oficial de Meta. El asistente comprueba la cuenta antes de guardarlo. Como alternativa, copiá `.env.ejemplo` a `.env` y completá `INSTAGRAM_TOKEN` directamente en ese archivo local.
5. Ejecutá `npm run verificar` y `npm test`. Si la cuenta y el permiso de publicación están correctos pero falta `medios.baseUrl`, la conexión está establecida y todavía falta completar el alojamiento de los medios.

```text
npm run conectar
npm run verificar
npm run estado
npm test
node herramientas/meta.mjs ayuda
```

Las pruebas usan un simulador local. `verificar` consulta la cuenta y puede renovar el token si corresponde; esa renovación necesita que el comando se ejecute periódicamente. Cada computadora mantiene su `.env` local. Compartí credenciales mediante el gestor acordado por los responsables de la cuenta, fuera de Git y del chat.

## Preparar y publicar una pieza

Los insumos son JPEG, MP4 y su `publicacion.json`, preparados con las herramientas de producción del proyecto. La plantilla contiene el motor de publicación, el asistente y las pruebas; las plantillas gráficas, los renderizadores y las piezas de cada negocio pertenecen a su proyecto.

Dejá los archivos en `publicar/<tanda>/<id>/`, cargá su texto y orden en `publicacion.json`, y registrá la pieza con su aprobación y fecha en `calendario.md`. Instagram debe poder descargar los medios desde sus direcciones públicas; configurá el almacenamiento y subí los archivos antes de publicar.

El [README del publicador](publicador-meta/README.md) trae el esquema de `publicacion.json` y un ejemplo de fila de calendario. Los identificadores del JSON deben coincidir con `--tanda` y `--id`. La celda **Carpeta** usa `salidas/<tanda>/<id>/` para identificar la fila; los archivos que se publican van en `publicar/<tanda>/<id>/`. Cambiá el estado a `aprobado` solo con la aprobación real de esa versión. El contrato completo está en [el lector de piezas](publicador-meta/herramientas/meta/publicar.mjs) y [el lector del calendario](publicador-meta/herramientas/meta/calendario.mjs).

Primero revisá la simulación:

```text
node herramientas/meta.mjs publicar --tanda=tanda-demo --id=pieza-demo
```

Revisá cuenta, texto, archivos y destinos. Usá `--de-verdad` únicamente cuando la petición vigente autorice publicar esa pieza en esa cuenta y el calendario la marque `aprobado`. Los registros de la operación quedan en el proyecto local.

## Automatización y uso entre computadoras

La entrega incluye el publicador por comando. El ejecutor diario, las tareas programadas, los avisos y la subida automática de medios se implementan en el proyecto cuando se acuerden con su responsable. Tener esta capacidad instalada no activa publicaciones ni concede autonomía de calendario.

Hasta disponer de coordinación remota, elegí **una sola computadora para las publicaciones reales y la renovación periódica**. El historial y el candado son locales: dos clones pueden publicar la misma pieza, y Git no evita esa simultaneidad.

La herramienta conserva una restricción heredada que rechaza archivos de la unidad **G:** y direcciones de **Google Drive**. Usá una carpeta local distinta de G: y un alojamiento público de medios compatible. Los MP4, los archivos preparados de `publicar/`, `.env`, candados y temporales se mantienen fuera del repo.

## Continuar las redes del Estudio

Para retomar **Webi / @webi2027**, leé [CONTINUAR-CONEXION-ESTUDIO.md](CONTINUAR-CONEXION-ESTUDIO.md). Ese estado corresponde al Estudio; la plantilla sigue vacía para otros proyectos.
