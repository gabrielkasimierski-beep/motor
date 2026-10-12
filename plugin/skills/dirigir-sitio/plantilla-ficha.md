# Ficha de pieza — plantilla

Una ficha por pieza. Es el encargo que recibe quien la construye: tiene que alcanzar para armarla
sin preguntar. Medidas, no adjetivos.

```markdown
# {Nombre de la pieza} — {sitio}

**Qué es:** una frase. Qué ve la persona y qué siente que controla.
**Referencia:** {imagen o link, y qué exactamente se toma de ella}
**Skill y kit:** {skill} · {archivos del kit}

## Zonas
Dibujo en texto de la pantalla a 1280 px y a 375 px. Dónde va cada cosa y cuánto ocupa.
- Sujeto: {centrado / al tercio derecho}, ocupa {60%} del alto
- Título: {arriba a la izquierda / detrás del sujeto}, ancho máximo {12 caracteres por línea}
- Botón principal: {dónde}, visible sin hacer scroll

## Tipos
| Rol | Familia | Peso | Tamaño | Interlínea | Espaciado |
|---|---|---|---|---|---|
| Título | {--f-titulo} | 800 | clamp(2.6rem, 8vw, 5.5rem) | 0.95 | −0.03em |
| Bajada | {--f-texto} | 400 | 1.0625rem | 1.6 | 0 |
| Etiqueta | {--f-mono} | 500 | 0.6875rem | 1.2 | 0.2em, mayúsculas |

## Color
Qué token va en cada cosa, y los valores de la marca si pisan los del kit.

## Movimiento (lo que pasa solo)
En orden. Para cada cosa: qué entra, desde dónde, cuánto viaja, cuánto dura, con qué curva y con
cuánta demora respecto de la anterior.
1. {Etiqueta}: sube 14 px y aparece · 0.9 s · curva de salida · 0 ms
2. {Título}: por líneas, cada una 70 ms después de la anterior
3. …

## Scroll (lo que maneja la persona)
- Largo del escenario: {400vh}
- Capítulos: {0–0.25} pasa X · {0.25–0.6} pasa Y · {0.6–1} pasa Z
- Qué queda fijo, qué se mueve y qué suelta el escenario al terminar

## Recursos
| Archivo | Qué es | Medida | Peso | Cuándo se baja |
|---|---|---|---|---|
| medios/cuadros/toma-####.webp | 120 cuadros | 1280×720 | ~5 MB | al acercarse la sección |
| medios/toma-poster.jpg | primer cuadro | 1280×720 | 90 KB | de entrada |

## Adaptación
- **375 px:** {qué cambia: recorte, foco de la imagen, texto debajo en vez de al costado}
- **Táctil:** {qué hace lo que seguía al puntero}
- **Reducir movimiento:** {qué estado quieto se ve}
- **Sin la pieza** (no cargó, no hay WebGL): {qué queda}

## Cómo se comprueba
- [ ] En 375, 768 y 1280 px no se pisa ningún texto con el sujeto
- [ ] El botón principal se puede tocar antes de que termine de cargar la escena
- [ ] Con rueda y con trackpad el recorrido se siente igual
- [ ] Al terminar el escenario, la banda siguiente entra sin salto
- [ ] Con "reducir movimiento" se lee todo
- [ ] {lo propio de esta pieza}
```
