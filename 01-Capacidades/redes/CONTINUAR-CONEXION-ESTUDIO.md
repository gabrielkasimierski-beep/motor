# Continuar la conexión de redes del Estudio

**Estado observado al 1 de noviembre de 2026.** Juanma pidió entregar las herramientas en el Motor y dejar la continuación a cargo de Gabi. La conexión de Instagram quedó comprobada; la publicación automática completa sigue pendiente.

## Lo que quedó comprobado

| Recurso | Estado |
|---|---|
| Instagram del Estudio | **@webi2027**, cuenta profesional **BUSINESS**, ID **17841427596455231** |
| App de Meta | **Webi Publicador**, ID **1151822694076220** |
| App de Instagram | **Webi Publicador-IG**, ID **2085264025443994** |
| Accesos de Gabi | Rol **Administrador aceptado** en la app de Meta |
| Cuenta evaluadora | Invitación de **@webi2027 aceptada** como evaluadora de Instagram |
| Token | Generado y guardado **solo en `.env` de la copia local de Juanma**; no se entrega en Git |
| Verificación de la API | Cuenta esperada, `instagram_business_basic` y `instagram_business_content_publish`: **OK**. Cupo observado: **0 de 100** |
| Insights | Opcional; su funcionamiento **no se comprobó** |
| Facebook | Pendiente; la asociación con el portfolio y los ingresos con Facebook/Instagram fueron inconsistentes. No quedó una conexión de Facebook confirmada |

El cupo es una observación de esa verificación, no una reserva ni una garantía para futuras corridas. El token y su estado deben verificarse nuevamente en la computadora que vaya a ejecutar el publicador.

## Incidentes resueltos durante la conexión

- Con Gabi como **Desarrollador**, el panel mostró «El usuario no tiene autorización para realizar esta acción» al generar el token. Tras aceptar el rol de **Administrador**, funcionó. Es una **observación de este caso**; no demuestra que todas las apps requieran ese rol para generar tokens.
- El formulario local inicialmente rechazaba el envío con «Origen del formulario inválido». Se corrigió su cabecera a **`Referrer-Policy: same-origin`**, manteniendo la comparación estricta de `Origin`. El envío se volvió a probar desde Chrome.
- El asistente acepta las respuestas de cuenta de Instagram tanto planas como dentro de `data`.

## Pendientes para publicar automáticamente

1. **Medios públicos:** elegir el almacenamiento, subir JPEG/MP4 y completar `config.json → medios.baseUrl`. El valor seguía vacío al cerrar esta etapa.
2. **Contenido aprobado y fechas:** completar el calendario real. La tanda de lanzamiento local seguía con fechas `{completar}` y estado `para-aprobar`; no debe tomarse como una cola lista para publicar. El contenido de Webi no se incluye en la plantilla neutral del Motor.
3. **Ejecutor diario y avisos:** implementar la selección de piezas por fecha/hora, su preparación/subida de medios y los avisos de fallos. No quedaron esos componentes instalados.
4. **Tareas programadas:** configurar el ejecutor y la verificación periódica en una sola computadora o servicio acordado. La consulta del Programador de tareas de Windows no encontró tareas de Webi, y tampoco se encontró una rutina de Webi configurada en las tareas locales de Claude.
5. **Primera publicación real:** hacer la simulación y, con la pieza y su cuenta expresamente autorizadas, publicar una pieza, revisar su visibilidad y comprobar los registros.

La renovación del token ya existe **dentro** de `verificar` y de la publicación real, cuando corresponde. Todavía requiere una ejecución periódica; no había una tarea instalada que la iniciara sola.

## Instrucciones para el agente de Gabi

1. Leé el [README de esta capacidad](README.md). Copiá `publicador-meta/` a un proyecto local vacío y operá desde esa copia, fuera del Motor.
2. Para este proyecto del Estudio, poné `webi2027` en `config.json → meta.usuarioInstagram`. Conservá los identificadores de la tabla para comprobar que el panel y la cuenta sean los correctos; otros proyectos necesitan sus propios datos.
3. Obtené el token mediante el gestor de credenciales acordado con Juanma o generalo con el acceso autorizado de Gabi en la app existente. Guardalo con el asistente local o en `.env`; nunca lo pegues en el chat, lo copies a documentación ni lo subas al repo.
4. Ejecutá `npm run verificar` y `npm test`. Si el token no sirve o le faltan permisos, resolvé esa conexión antes de seguir con una publicación.
5. Completá los pendientes anteriores con Gabi. Antes de publicar, identificá la pieza, su versión aprobada y la cuenta de destino. La conexión verificada y la existencia de esta skill no autorizan publicaciones espontáneas ni la creación de un calendario automático.

El historial y el candado actuales son locales. Acordá un único ejecutor de publicaciones reales para evitar que dos computadoras publiquen lo mismo. Facebook y las métricas opcionales se continúan como trabajos separados cuando Gabi los solicite.
