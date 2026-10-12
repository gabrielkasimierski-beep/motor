# Accesos — tokens, claves y conectores

Dónde vive cada acceso y quién lo carga. **Acá nunca hay valores**, solo nombres y ubicaciones.

## La regla

> Un valor secreto (token, clave, contraseña) **no se escribe nunca** en un `.md`, en el chat ni en
> el código. Lo carga Gaby a mano. Claude no pide, no lee ni repite valores.

## Los tres lugares donde puede vivir un acceso

| Nivel | Qué es | Dónde vive | Lo ven |
|---|---|---|---|
| **Estudio** | Cuentas de Gaby que usa en todos los trabajos (Netlify, Supabase, Vercel…) | Variables de entorno de usuario de Windows, o la sesión del CLI correspondiente (`netlify login`, etc.) | Todos los proyectos de la máquina |
| **Cliente** | Accesos de UN cliente (ID de su sitio, su base, su cuenta de pagos) | `C:\Claude\Clientes\<cliente>\.env` (fuera de git) | Solo ese proyecto |
| **Conectores de claude.ai** | Higgsfield, Vercel, Gmail, Google Drive, Google Calendar, Claude Docs | Se administran en claude.ai (Configuración → Conectores). No son archivos | Todos los proyectos de la cuenta |

Los accesos **del propio cliente** (su hosting, su dominio, su mail, sus redes) no se piden: los
carga él, o te invita a su cuenta. Ver regla 6 de `MOTOR.md`.

## Cargar una variable de entorno de usuario (lo hace Gaby)

En PowerShell, reemplazando el nombre y pegando el valor a mano:

```powershell
[Environment]::SetEnvironmentVariable('NOMBRE_DE_LA_VARIABLE', 'el-valor', 'User')
```

Después hay que cerrar y volver a abrir la terminal (y Claude Code) para que la tome. Los nombres
estándar están en [`.env.example`](.env.example); el estado de cada acceso, en [`inventario.md`](inventario.md).

## Agregar un MCP compartido por todos los clientes

1. Crear `C:\Claude\Motor\plugin\.mcp.json` con el servidor. Los secretos van como `${NOMBRE_VARIABLE}`,
   nunca el valor.
2. Anotarlo en `inventario.md`.
3. Reabrir Claude Code en un cliente (o `/reload-plugins`): todos los clientes lo ven; los proyectos que no son clientes,
   no.

Un MCP que es **de un solo cliente** va en el `.mcp.json` de la carpeta de ese cliente, no acá.

## Agregar una skill o un agente al Motor

Una skill: `C:\Claude\Motor\plugin\skills\<nombre>\SKILL.md`. Un agente: `C:\Claude\Motor\plugin\agents\<nombre>.md`.
Los clientes la toman en la próxima sesión. Una skill que es **solo de un cliente** va en
`<cliente>\.claude\skills\`.
