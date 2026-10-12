# Inventario de accesos (plantilla)

Copiá este archivo como `inventario.md` (queda **fuera de git**: es de tu máquina) y completalo. Solo nombres, usos y
ubicaciones. **Sin valores.** Lo que no esté confirmado va como `{completar}`.

## Nivel estudio (tus cuentas)

| Acceso | Para qué | Cómo se usa hoy | Dónde vive | Estado |
|---|---|---|---|---|
| **Netlify** | Publicar sitios estáticos | `netlify-cli` | Sesión del CLI o `NETLIFY_AUTH_TOKEN` | {completar} |
| **Supabase** | Base de datos y funciones de las apps | Panel web + SQL Editor | Sesión del panel; `SUPABASE_ACCESS_TOKEN` si se usa el CLI | {completar} |
| **Vercel** | Publicar proyectos que lo requieran | `vercel` CLI / conector | Sesión del CLI | {completar} |
| **GitHub** | Repos privados | `git` / `gh` | Credenciales de git / sesión de `gh` | {completar} |

## Conectores de claude.ai (a nivel cuenta, no son archivos)

| Conector | Para qué | Cuidado |
|---|---|---|
| **Higgsfield** | Imágenes, videos y modelos 3D | Consume créditos: mirar `balance` antes de tandas grandes |
| **Gmail / Calendar / Drive** | Mails, agenda y documentos | **Nada se manda sin tu OK.** Son tuyos, no de un cliente |

## Nivel cliente

No se lista acá (sería mezclar clientes). Cada cliente tiene su `.env.example` en su carpeta y su `.env` real.

Regla: la cuenta de cobros de un cliente (por ejemplo Mercado Pago) es **del cliente**. Su token va como secreto de
la base de ese cliente, nunca acá.

## Historial de rotaciones

| Fecha | Acceso | Qué pasó |
|---|---|---|
| | | |
