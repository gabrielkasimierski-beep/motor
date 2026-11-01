# Publicador de Meta

Plantilla copiable para un proyecto local, con Node.js 22 o posterior y sin dependencias externas. Copiá **esta carpeta completa** fuera del Motor, dentro del proyecto que vas a operar. No ejecutes conexiones ni publicaciones sobre la plantilla compartida.

En la copia local, completá `config.json → meta.usuarioInstagram` con el usuario esperado, sin `@`. Después abrí `conectar-instagram.cmd` o ejecutá `npm run conectar`. El asistente abre un formulario local, verifica la cuenta con Instagram y guarda el token en `.env`. No pegues el token en el chat ni lo subas a Git.

Comandos desde la copia local:

```powershell
npm run conectar
npm run verificar
npm run estado
npm run ayuda
npm test
```

`verificar` y `estado` consultan Meta. `verificar` también renueva el token de Instagram cuando corresponde. Las pruebas usan un simulador y credenciales ficticias; no necesitan una conexión real a Meta. No hace falta ejecutar `npm install`.

Esta entrega contiene el publicador y el asistente de conexión. Las imágenes JPEG, los videos MP4, los textos y el manifiesto `publicacion.json` se preparan en el proyecto y se colocan en `publicar/<tanda>/<pieza>/`. El material no viene incluido. Para Instagram hace falta completar `medios.baseUrl` con la dirección pública del material; el publicador verifica que coincida con los archivos locales.

Por ejemplo, para una imagen ya revisada, dejá estos archivos en la copia local:

```text
publicar/tanda-demo/pieza-demo/01.jpg
publicar/tanda-demo/pieza-demo/publicacion.json
```

El manifiesto mínimo de esa imagen es:

```json
{
  "tanda": "tanda-demo",
  "id": "pieza-demo",
  "texto": "Texto aprobado de la publicación.",
  "laminas": [{ "orden": 1, "archivo": "01.jpg" }]
}
```

Para un carrusel agregá una entrada por JPEG en `laminas`, con `orden` y `archivo`. El formato automático se deduce por cantidad de imágenes. `archivo` debe ser relativo a la carpeta de la pieza; la URL se calcula desde `medios.baseUrl`. No se incluyen herramientas para generar estas imágenes.

La fila correspondiente del calendario usa la ruta lógica `salidas/<tanda>/<pieza>/`, aunque los archivos que se envían están en `publicar/`. Escribí el estado `aprobado` solamente después de que una persona autorice esa versión. Ejemplo de fila para añadir a la tabla existente:

```markdown
| 1 | pendiente | Pieza demo | servicio | — | aprobado | `salidas/tanda-demo/pieza-demo/` |
```

Con `medios.baseUrl` igual a `https://medios.example.test`, el JPEG debería estar disponible como `https://medios.example.test/tanda-demo/pieza-demo/01.jpg`. Esa dirección es ilustrativa: el alojamiento real se configura aparte.

Para un reel, poné `video.mp4` dentro de la misma carpeta; pasalo con `--video=publicar/tanda-demo/pieza-demo/video.mp4`. El texto puede venir del manifiesto (con `laminas: []`) o de `--texto=<archivo.txt>` dentro de la carpeta. Para una historia, usá `--formato=historia --imagen=<archivo.jpg>` o `--formato=historia --video=<archivo.mp4>`; las historias no llevan texto. Todos los archivos, incluida la portada opcional del reel, deben estar dentro de la carpeta de la pieza para publicar de verdad.

La publicación siempre empieza con simulación:

```powershell
node herramientas/meta.mjs publicar --tanda=<tanda> --id=<pieza> --red=instagram
```

Publicar de verdad exige la pieza en estado exacto `aprobado` en `calendario.md`, la autorización de la persona responsable y agregar `--de-verdad`. No uses `--repetir` para resolver una respuesta incierta: revisá la cuenta y usá `resolver` según la ayuda. No hay automatización ni hosting configurados en esta plantilla.

Limitaciones heredadas: el código rechaza archivos de toda la unidad `G:` y URLs de Google Drive. Ese bloqueo se conserva en esta entrega; elegí otra ubicación local para los archivos. El registro y el candado son locales: dos copias en distintas PCs pueden duplicar una publicación. Acordá una sola PC para publicar de verdad hasta que se implemente coordinación entre equipos.
