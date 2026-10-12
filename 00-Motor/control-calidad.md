# Control de calidad

> Esta lista es **para web**. Las apps y el 3D suman sus propios chequeos (ver `01-Capacidades/apps/` y `01-Capacidades/3d-animacion/`). Contenido, mobile y velocidad valen para todo.

**Ninguna web se le muestra al cliente sin pasar esta lista entera.** No es burocracia: es
lo que hace que no vuelva un reclamo dos días después de cobrar.

El agente la corre solo y deja el resultado en `qa.md`, con cada ítem
en ✅ / ⚠️ / ❌ y qué se hizo.

---

## 1. Contenido — lo primero, porque invalida todo lo demás

- [ ] **Cero datos inventados.** Años, cantidades, certificaciones, testimonios: o están en
      el brief, o van como `{completar: ...}`. Ningún `{completar}` queda al publicar.
- [ ] Cero texto de relleno tipo *lorem ipsum* o "somos líderes en soluciones integrales".
- [ ] Los nombres de productos, marcas y personas están **bien escritos** (mayúsculas y todo).
- [ ] Ortografía y tildes revisadas, en **español rioplatense** si el cliente es argentino.
- [ ] Teléfono, WhatsApp, mail, dirección y horarios **son los reales del brief**.
- [ ] El titular del hero dice qué hace la empresa y para quién. Se entiende en 3 segundos.

## 2. Que funcione

- [ ] **Todos los links andan.** Ninguno a `#` ni a una página que no existe.
- [ ] **El formulario envía de verdad** y llega el mail. Probado, no supuesto.
- [ ] El formulario muestra **mensaje de éxito** y de error, y no se puede mandar vacío.
- [ ] El **honeypot** anti-spam está puesto.
- [ ] **Todos los botones de WhatsApp abren** el chat con el mensaje prellenado correcto.
- [ ] El menú abre y cierra en mobile, y se cierra al elegir una opción.
- [ ] Los filtros y el buscador del catálogo funcionan, incluso sin resultados
      (tiene que decir "no encontramos nada", no quedar en blanco).
- [ ] La consola del navegador **no tira ni un error**.

## 3. Mobile (se revisa PRIMERO, en 390 px)

- [ ] **Nada se sale de la pantalla.** Cero scroll horizontal. La prueba: nada más ancho que
      el viewport.
- [ ] Los botones son tocables: **44 px de alto mínimo**, separados entre sí.
- [ ] El texto se lee sin zoom: **16 px mínimo** en el cuerpo.
- [ ] Las tablas y el catálogo scrollean dentro de su caja, no rompen la página.
- [ ] El WhatsApp flotante no tapa nada importante.
- [ ] Probado también en **768 px** (tablet) y **1440 px** (notebook).

## 4. Velocidad

- [ ] Imágenes en **WebP**, redimensionadas al tamaño real que se muestran
      (nunca una foto de 4000 px para un recuadro de 400).
- [ ] Toda imagen fuera de la primera pantalla con `loading="lazy"`.
- [ ] **Ninguna imagen pesa más de 300 KB.** El total de la home, menos de 2 MB.
- [ ] Todas las imágenes tienen `width` y `height` (para que no salte el diseño al cargar).
- [ ] Tipografías con `display=swap` y solo los pesos que se usan.
- [ ] Nada de librerías cargadas "por las dudas".

## 5. SEO

- [ ] `<title>` único por página, con el rubro y la ciudad
      (*"Hornos industriales para panadería | Vulcano — Buenos Aires"*).
- [ ] `meta description` propia por página, de 140-160 caracteres.
- [ ] **Un solo `<h1>` por página**, y los `h2`/`h3` en orden.
- [ ] Toda imagen con `alt` que describe (no "imagen1.jpg").
- [ ] Open Graph + Twitter Card con imagen: al compartir por WhatsApp se ve la tarjeta.
- [ ] `sitemap.xml`, `robots.txt` y URLs limpias (`/catalogo/horno-rotativo`, no `?id=7`).
- [ ] JSON-LD de `LocalBusiness` con dirección, teléfono y horarios.
- [ ] `<html lang="es-AR">`.

## 6. Accesibilidad

- [ ] Contraste **AA**: 4.5:1 en texto normal, 3:1 en texto grande. Se verifica, no se estima.
- [ ] Se puede navegar entero con **Tab**, y se ve dónde está el foco.
- [ ] Los campos del formulario tienen `<label>` (aunque esté oculto visualmente).
- [ ] Los íconos que son botones tienen `aria-label`.
- [ ] `prefers-reduced-motion` apaga las animaciones.
- [ ] El color **no es la única forma** de entender algo (un error no puede ser solo rojo).

## 7. Legal y cierre

- [ ] Aviso de privacidad si hay formulario (Ley 25.326).
- [ ] Ninguna foto ni texto copiado de otro sitio.
- [ ] Favicon puesto.
- [ ] Página 404 propia.
- [ ] El pie calcula el año solo.
- [ ] Analítica instalada y midiendo.

---

## La prueba de los 5 segundos

Mostrale la home a alguien que no sabe nada del cliente, 5 segundos, y tapala.
Tiene que poder decir **qué vende la empresa y a quién**.
Si no puede, el problema es el hero, no el diseño.

## La prueba del logo tapado

Tapá el logo. ¿Podría ser la web de cualquier otra empresa del rubro?
Si sí, falta lo específico de este cliente. Volver a `sistema-diseno.md`, punto 6.
