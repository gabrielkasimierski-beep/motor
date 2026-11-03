# Historial del Motor

Hitos del sistema, **sin datos de clientes** (la historia de cada cliente vive en su propio proyecto).

| Fecha | Qué pasó |
|---|---|
| 10-sep-2026 | Arranca el proyecto como negocio nuevo y separado de AbrazArte. Decisiones: el stack se elige por cliente; paquete base con formulario + catálogo + blog; sin panel de edición en el base (se cotiza aparte). Se construye una demo ficticia de referencia. Se instala Node.js (Carril B habilitado). |
| 11-sep-2026 | Primer cliente real. Aprendizajes que valen para todos: el contacto termina en WhatsApp con una persona (el formulario ordena el primer mensaje); el material bueno ya existe y hay que pedirlo; revisar el material del propio cliente (links rotos, dominio vencido, precios que no coinciden entre piezas) vale tanto como la web. |
| 12-sep-2026 | La parte de vender: grilla de precios con datos de mercado, skill `buscar-clientes` y skill `diagnostico-digital` con su herramienta `diagnostico.js`. |
| 13 al 23-sep-2026 | Primera **app** (turnos con QR + panel por rol), frente estático + base en Supabase, costo fijo $0. Resulta revendible a otros rubros: lo propio del cliente queda aislado en un archivo de configuración. Nacen `servidor.js` y mejoras de `vista-previa.js`. |
| 24-sep-2026 | "Pensar en grande": los primeros proyectos fueron para aprender; el mercado objetivo son PyMEs con presupuesto real (fábricas, distribuidoras, servicios a empresas, salud y educación privadas). |
| 25-sep-2026 | Se deja de ofrecer "diagnóstico gratis": al prospecto se le ofrece una propuesta concreta y 15 minutos. |
| 26-sep-2026 | Nace Carta Viva, producto propio de gastronomía (con Juanma). |
| 07-oct-2026 | Reorganización a **Motor Cliente nuevo**: multi-rubro y multi-capacidad (web, apps, 3D/animación, diseño gráfico). Nace `01-Capacidades/` y la skill `cliente-nuevo` (prototipo primero). El 3D queda como capacidad en formación, con bitácora de estudio. |
| 11-oct-2026 | El Motor pasa a **nivel global** (`C:\Claude\Motor`), compartido por todos los proyectos de clientes mediante un plugin. Cada cliente es su propio proyecto en `C:\Claude\Clientes\`, con su identidad, su `.env` y permisos que lo aíslan de los demás. Los accesos del estudio quedan inventariados en `04-Accesos/`. |
| 12-oct-2026 | Entra el **kit webi** (nacido el 11-oct como "Motor webi", estudiando un sitio publicado): 15 skills, un kit de código sin dependencias y un banco de pruebas para **sitios con movimiento**. Queda como capacidad de la línea web en `01-Capacidades/web/webi/`; `construir-web` deriva a `dirigir-sitio` cuando el sitio lleva una pieza firma. |
| 13-oct-2026 | Cada cliente nuevo nace con un **`00-ARRANQUE.md`**: el pedido de arranque ya con nombre y rubro, que se completa con lo que se sepa (o se pega el WhatsApp tal cual) y que `cliente-nuevo` lee entero: audita, arma el mapa, propone un prototipo, hace las preguntas que falten y **frena** hasta que se elija. |
| 03-nov-2026 | Entra el **guardián de código** (`motor-guardian` + `herramientas/repo_guard.py` y `scan_repo.py`): traer una skill o repo de afuera pasa por auditar en cuarentena aislada → Gaby aprueba el hash → vendorizar ese commit con `PROVENANCE.json` → verificar. Nunca se ejecuta el repo; se fija el commit, no la rama. Nueva regla dura 14. |
