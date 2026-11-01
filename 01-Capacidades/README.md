# Capacidades — el menú

Esto es **lo que le podemos ofrecer a un cliente**. Es la fuente que usa la skill `cliente-nuevo`
para armar el mapa de oportunidades de cada negocio. Crece a medida que aprendemos: cada línea
tiene su carpeta con aprendizajes y casos reales, y cuando aparece algo nuevo se suma acá.

Para elegir qué le corresponde a un cliente: primero [`00-Motor/decidir-trabajo.md`](../00-Motor/decidir-trabajo.md).
Los precios viven solo en [`03-Comercial/precios.md`](../03-Comercial/precios.md).

| Línea | Estado | Carpeta |
|---|---|---|
| **Web** | Maduro (proceso + precios + plantillas) | [`web/`](web/) |
| **Apps** | Maduro técnicamente, precio por proyecto | [`apps/`](apps/) |
| **3D y animación** | En formación | [`3d-animacion/`](3d-animacion/) |
| **Diseño gráfico** | Sin proceso ni precio todavía | [`diseno-grafico/`](diseno-grafico/) |
| **Publicación en redes** | Publicador por comando; puesta en marcha automática pendiente | [`redes/`](redes/) |

---

## Web

**Qué es:** landing, institucional, catálogo con filtros, blog, y SIEMPRE formulario → mail +
WhatsApp. Carril A estático (el 80 % de los casos) o Carril B cuando hay una función que el
estático no puede hacer.

**Cuándo le sirve a un negocio:** cuando hoy no lo encuentran, no tiene web, la que tiene está
rota o vieja, o no sabe cómo convertir visitas en consultas.

**Qué impacto tiene (Norte 1):** más consultas por WhatsApp y por mail, y una imagen lo bastante
seria como para ganar cuentas de empresas.

**Casos nuestros:** Charlie (cadetería, `C:/Claude/Clientes/charlie/`) · Vulcano (demo ficticia,
`C:/Claude/Clientes/demo-vulcano/`) · Ginotto (web de marca que deriva el pedido a fu.do,
`C:/Claude/Clientes/ginotto/`).

**Estado:** **maduro.** Tiene proceso (skills), grilla de precios, sistema de diseño, kit de
secciones y plantillas. Ver [`web/aprendizajes.md`](web/aprendizajes.md).

**Sitios con movimiento (kit webi):** cuando la web tiene que impactar —un producto que gira con el
scroll, un video de portada, un fondo vivo, una escena 3D— se arma con [`web/webi/`](web/webi/README.md):
15 skills, un kit de código sin dependencias y un banco de pruebas con una página por pieza. Regla de
oro: **una sola pieza firma por sitio** y que nunca demore el botón de contacto. Crece estudiando sitios
publicados (skill `estudiar-sitio`). Estado: **nuevo** (11-oct-2026), todavía sin un caso de cliente.

## Apps

**Qué es:** turnos y reservas con QR y panel por rol con PIN (Fena); carta digital con pedidos
desde la mesa y club de fidelización (Carta Viva). Patrón propio: **app estática + Supabase, sin
Next.js, costo fijo $0, validación en la base.**

**Cuándo le sirve a un negocio:** cuando sus clientes tienen que *hacer* algo (reservar, pedir,
sumar puntos) o cuando el equipo gestiona algo a mano y se pisa (turnos superpuestos, comandas
perdidas).

**Qué impacto tiene:** menos trabajo operativo, menos errores, y un cliente que vuelve (club,
turnos guardados en el celular).

**Casos nuestros:** Fena Studio (`C:/Claude/Clientes/fena/`) · Carta Viva (`C:/Claude/Estudio/carta-viva/`).

**Estado:** **maduro técnicamente.** Precio **por proyecto**, no hay paquete cerrado en la grilla.
Ver [`apps/aprendizajes.md`](apps/aprendizajes.md).

## 3D y animación

**Qué es:** platos y productos que giran con el dedo (three.js), recortes de foto real que giran,
producto en AR sobre la mesa real (model-viewer + `.glb`), video y 3D de producto.

**Cuándo le sirve a un negocio:** cuando lo que vende entra por los ojos (gastronomía, productos
con forma, objetos) y las fotos planas no alcanzan para dar ganas.

**Qué impacto tiene:** es el **diferencial** que casi nadie ofrece: el dueño se ve a sí mismo, con
su propio plato, girando en el celular. Eso vende la reunión.

**Casos nuestros:** Carta Viva (platos 3D, fotos reales que giran, AR, pizza en video/3D).

**Skills de esta línea:** `motor:skill-cookie` — landings y heros de producto que se abren, se parten o giran al
hacer scroll (clip generado con IA atado al scroll, sin WebGL). Cuándo sí, cuándo no (si el cliente quiere
rotar o configurar el producto con el dedo, eso es 3D real con GLB + Three.js) y el paso a paso están en
`plugin/skills/skill-cookie/SKILL.md`. Necesita ffmpeg y créditos de Higgsfield para generar el clip.

**Estado:** **en formación.** Gaby está estudiando para mejorarlo; la bitácora está en
[`3d-animacion/por-estudiar.md`](3d-animacion/por-estudiar.md). Sin precio propio todavía. Ver
[`3d-animacion/aprendizajes.md`](3d-animacion/aprendizajes.md).

## Diseño gráfico

**Qué es:** logo e identidad, placas para redes, cartas y menús impresos, señalética, piezas de
campaña.

**Cuándo le sirve a un negocio:** cuando la marca está floja o no existe, o cuando las piezas que
ya usa (placas de Instagram, carta impresa) se ven desparejas o tienen errores.

**Qué impacto tiene:** una marca que se ve seria sube la confianza, y es la base para que la web
o la app salgan con identidad propia.

**Casos nuestros:** `{completar: todavía ninguno como servicio; Charlie y Ginotto sirvieron de base visual para sus webs}`

**Estado:** **sin proceso ni precio todavía.** Se ofrece y se describe; se formaliza cuando
aparezca el primer caso real (como se hizo con web). Ver [`diseno-grafico/README.md`](diseno-grafico/README.md).

---

## Publicación en redes

Herramientas para conectar una cuenta profesional de Instagram, verificar su acceso y publicar contenido aprobado por la API oficial. La plantilla se copia al proyecto local: sus credenciales, medios y registros quedan allí. No instala tareas automáticas ni configura alojamiento de archivos.

La instalación y los comandos están en [`redes/README.md`](redes/README.md). Para retomar la conexión de las redes del estudio, leer [`redes/CONTINUAR-CONEXION-ESTUDIO.md`](redes/CONTINUAR-CONEXION-ESTUDIO.md).

**Cómo elegir para un cliente:** primero [`00-Motor/decidir-trabajo.md`](../00-Motor/decidir-trabajo.md).
