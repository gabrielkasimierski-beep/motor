# Motor Cliente nuevo (el repo)

Sesión abierta **en el Motor**: se está cambiando el sistema que usan los clientes de Gaby y de Juanma, no se está
trabajando a un cliente. Acá no se trabaja a ningún cliente.

@MOTOR.md

## Reglas para Claude en este repo

- **Nunca datos de un cliente, claves ni rutas personales.** Lo aprendido de un cliente entra como lección general,
  sin su nombre. Lo de una máquina (`04-Accesos/inventario.md`, `02-Plantilla-cliente/bloqueos-locales.txt`) no se versiona.
- **No se sube a `main`.** Rama con prefijo (`feat/`, `fix/`, `docs/`, `chore/`) y Pull Request que mira el otro
  (ver `CONTRIBUTING.md`). La carpeta `C:\Claude\Motor` queda siempre en `main`: para trabajar una rama usá un
  `git worktree` (ahí está el comando).
- **Este repo lo leen los clientes en vivo.** Un cambio en una skill, en `MOTOR.md` o en el script afecta a todos los
  clientes en su próxima sesión: probalo antes y validá con `claude plugin validate`.
- Las rutas son absolutas (`C:\Claude\Motor`, `C:\Claude\Clientes`): no las cambies sin avisar.
- Una skill nueva: `plugin/skills/<nombre>/SKILL.md` con `name` y `description` (las frases que la activan). Después,
  sumarla a la tabla de `GUIA-DE-USO.md` y, si es de una capacidad, a `01-Capacidades/`.
- Con quien te use: español rioplatense, directo, sin narrar el paso a paso. Nada se manda ni se publica sin su OK.
