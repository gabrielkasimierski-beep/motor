# Cómo cambiamos el Motor

Para Gaby y Juanma (y para cualquier Claude que trabaje acá). El Motor es **compartido por los dos y lo usan los
clientes en vivo**: un cambio mal hecho le rompe el trabajo al otro. Por eso, pocas reglas y se cumplen siempre.

## Lo que nunca va en este repo

- **Datos de un cliente** (marca, precios del cliente, contactos, decisiones). Eso vive en el proyecto del cliente.
- **Claves, tokens, contraseñas, `.env`.** Si se subió una por error, se **rota** (borrar el commit no alcanza).
- **Lo personal de una máquina:** el inventario de cuentas (`04-Accesos/inventario.md`) y las carpetas privadas
  (`02-Plantilla-cliente/bloqueos-locales.txt`). Ya están en `.gitignore`; para eso hay un `.ejemplo` de cada uno.
- **Lo aprendido de un cliente** entra **sin su nombre ni sus datos**: se escribe como lección general en
  `01-Capacidades/`.

## La regla de `main`

`main` es lo que usan los clientes de los dos. **Siempre tiene que andar** y **nadie sube directo a `main`**: todo
entra por **Pull Request**. Con tu copia local siempre parada en `main` (es la que lee Claude en cada cliente).

## Ramas y commits

Una rama por tema, con prefijo y en minúsculas: `feat/` (algo nuevo), `fix/` (arreglar), `docs/` (documentación),
`chore/` (mantenimiento). Ejemplo: `feat/skill-landing-3d`. Commits en español, en imperativo, con el mismo
prefijo y **una línea que diga qué cambió**: `feat: skill para el hero con producto 3D`.

## Trabajar un cambio sin romper tus clientes

Tu `C:\Claude\Motor` tiene que quedar siempre en `main`. Para trabajar en una rama usá una **segunda carpeta
de trabajo** (`git worktree`), que comparte el mismo repo:

```powershell
git -C C:\Claude\Motor worktree add C:\Claude\Motor-trabajo -b feat/mi-cambio   # crea la carpeta y la rama
# ...editás en C:\Claude\Motor-trabajo, commit, push...
git -C C:\Claude\Motor-trabajo push -u origin feat/mi-cambio                    # y abrís el PR
git -C C:\Claude\Motor worktree remove C:\Claude\Motor-trabajo                  # cuando se mergeó
git -C C:\Claude\Motor pull                                                     # y traés lo nuevo
```

Para **probar una skill modificada** sin tocar tus clientes, abrí un cliente de prueba y cargá el plugin de la
carpeta de trabajo: `claude --plugin-dir C:\Claude\Motor-trabajo\plugin`.

## Antes de abrir un PR

- [ ] `claude plugin validate C:\Claude\Motor-trabajo` pasa (o el nombre de tu carpeta de trabajo).
- [ ] Probaste la skill o el script que tocaste en un cliente de prueba.
- [ ] No hay datos de clientes, claves ni rutas personales.
- [ ] Si cambió algo que el otro tiene que saber (una regla, una ruta, el script), está en el PR y en `MOTOR.md` o
      `GUIA-DE-USO.md`.
- [ ] Una decisión importante queda anotada con fecha en `00-Motor/historial.md`.

## Dónde va cada cosa

| Qué | Dónde |
|---|---|
| Skills y agentes | `plugin/skills/<nombre>/SKILL.md` · `plugin/agents/<nombre>.md` |
| Cómo trabajamos (embudo, calidad, decidir el tipo de trabajo) | `00-Motor/` |
| Lo que ofrecemos y lo aprendido (web, apps, 3D, diseño) | `01-Capacidades/` |
| Kit de sitios con movimiento: código, banco de pruebas, estudios de sitios | `01-Capacidades/web/webi/` (pieza nueva = kit + banco + skill) |
| Lo que se copia al crear un cliente, y el script | `02-Plantilla-cliente/` |
| Precios, condiciones, datos del estudio | `03-Comercial/` |
| Política de tokens y plantilla del inventario | `04-Accesos/` |
