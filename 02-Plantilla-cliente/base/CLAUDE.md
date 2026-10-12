# {{CLIENTE}}

> Proyecto de cliente del **Motor Cliente nuevo**. Creado el {{FECHA}}.
> **Esta carpeta es la identidad de {{CLIENTE}}.** Nada de lo que hay acá se usa en otro cliente,
> y nada de otro cliente se usa acá. Los permisos de este proyecto lo bloquean.

## El Motor (método, skills y reglas compartidas)

@C:/Claude/Motor/MOTOR.md

## Quién es

- **Rubro:** {{RUBRO}}
- **Estado del proyecto:** nuevo
- **Qué hace / a quién le vende / cómo capta hoy:** {completar}
- **Contacto del lado del cliente (quién decide):** {completar}

## Su identidad (siempre cargada)

@identidad/marca.md
@identidad/voz.md
@identidad/visual.md
@identidad/reglas-del-negocio.md

## Cómo se trabaja acá

- Se arranca con la skill `cliente-nuevo` (*"tengo un cliente nuevo"*): deja `analisis.md` y propone
  el **primer prototipo** para mostrar. Después se profundiza.
- Los archivos del cliente viven en la **raíz de esta carpeta**: `analisis.md`, `brief.md`,
  `propuesta.md`, `decisiones.md`, `sitio/` o `app/`, `qa.md`, `entrega.md`.
- Los tokens y accesos **de este cliente** van en `.env` (no se sube a git y nunca se escribe en un
  `.md` ni en el chat). Los del estudio están inventariados en `C:/Claude/Motor/04-Accesos/`.
- Si de este trabajo sale un aprendizaje que le sirva a otros clientes, va al Motor
  (`C:/Claude/Motor/01-Capacidades/`) **sin datos de este cliente**.
