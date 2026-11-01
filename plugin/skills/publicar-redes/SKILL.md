---
name: publicar-redes
description: Conecta y verifica Instagram, simula publicaciones y publica piezas autorizadas mediante el publicador de Meta del Motor. Usar para tareas de publicación orgánica de redes en un proyecto.
---

# Publicar redes

Leé la guía de la capacidad en `C:\Claude\Motor\01-Capacidades\redes\README.md`, o su ruta equivalente `01-Capacidades/redes/README.md` en el checkout local del Motor.

Trabajá desde la copia del publicador en el proyecto del negocio. El Motor contiene la plantilla neutral; las credenciales, el calendario y los registros de una cuenta real viven en su proyecto.

- Para conectar o verificar, usá el asistente local y los comandos de la guía. Los tokens van en `.env` local, fuera de Git y del chat.
- Para revisar una publicación, corré `publicar` sin `--de-verdad` y comprobá la cuenta, el contenido y los medios que muestra la simulación.
- Publicá únicamente cuando la petición vigente autorice esa pieza y cuenta, el contenido esté aprobado en el calendario y la simulación corresponda a esa versión. Entonces usá `--de-verdad` y comprobá el resultado y los registros.
- El publicador tiene estado local. Acordá un único ejecutor para publicaciones reales hasta que el proyecto tenga coordinación remota.

Solo si la tarea es continuar **las redes del Estudio / Webi / @webi2027**, leé además `C:\Claude\Motor\01-Capacidades\redes\CONTINUAR-CONEXION-ESTUDIO.md` o su equivalente en el checkout. No cargues ese estado para otros negocios.

Esta skill permite usar las herramientas en el alcance pedido. No activa tareas programadas ni concede autonomía para publicar por existir; la programación se configura cuando el responsable del proyecto la solicite.
