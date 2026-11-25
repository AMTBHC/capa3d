# Rediseño CR3D: impresión 3D sin archivos ni tecnicismos

**Problema.** La portada empujaba a subir un archivo `.stl`/`.3mf` y elegir relleno, capas y soportes. El público (clientes que llegan desde redes sociales, en el celular) no tiene archivos 3D ni conoce esa jerga, así que no convertía.

**Objetivo.** Cualquier persona, sin conocimientos técnicos, puede:

1. Elegir una pieza de un catálogo visual y pedirla en pocos toques.
2. Si no la encuentra, mandar una foto, un boceto o una descripción para que la diseñemos e imprimamos.

**Principios.**

- **Dos caminos, siempre visibles:** «Ver catálogo» y «Pedir algo con una foto», en el hero, el menú, entre secciones y al final.
- **Cero jerga en la ruta principal:** tamaños como Pequeño/Mediano/Grande o «cabe en la mano»; el material solo aparece en «Opciones avanzadas» y en lenguaje sencillo («que aguante sol o agua»).
- **WhatsApp como cierre natural:** el pedido y la consulta terminan en un chat con el resumen ya escrito.
- **Sin compromiso:** se repite que se revisa y se confirma el precio antes de imprimir o pagar.
- **Móvil primero:** objetivos de toque de 44 px como mínimo, ventanas que suben desde abajo y barra flotante «Mi pedido».

---

## 1. Arquitectura de la información

```
/  Portada
├─ Encabezado fijo:   Logo · Catálogo · Pedido a medida · Cómo funciona · Preguntas · Mis pedidos
│                     [🛍 Mi pedido (n)]  [📷 Pedir con una foto]          (celular: logo · 🛍 · ☰)
├─ 1. Hero                     Titular + 2 CTA + 3 garantías + ilustración «tu foto → tu pieza»
├─ 2. Catálogo  #catalogo      Filtros por categoría · 8 tarjetas · «Ver todo» · puente «¿No lo encuentras?»
├─ 3. Pedido a medida  #a-medida   Mensaje tranquilizador + formulario guiado de 3 pasos
├─ 4. Cómo funciona  #como-funciona   3 pasos + los 2 CTA
├─ 5. Trabajos realizados  #trabajos   Galería de trabajos reales + 4 garantías
├─ 6. Preguntas frecuentes  #preguntas   8 preguntas en lenguaje sencillo + WhatsApp
├─ 7. Llamado final            Los 2 CTA sobre fondo morado oscuro
├─ Pie                         Tienda · Ayuda · «¿Tienes archivo 3D?» → /cotizar
└─ Flotante                    WhatsApp (sin pedido) o barra «Mi pedido · desde $X · Enviar» (con pedido)

/catalogo            Catálogo completo: colecciones (barra lateral o fichas), búsqueda, orden
/producto/[id]       Fotos · tamaño (cm) · color · acabado · cantidad · [Opciones avanzadas: material]
                     → Agregar a mi pedido · Comprar ahora y pagar en línea · Preguntar por WhatsApp
/disenos             Pedido a medida (misma sección de la portada) + Cómo funciona
/diseno/[id]?t=      Seguimiento de la solicitud (Recibida → En diseño → Propuesta → Lista para pagar)
/mis-pedidos         Pedidos y solicitudes hechos desde este navegador
/pedido/[id]?t=      Seguimiento y pago de un pedido
/cotizar             Cotizador avanzado (STL, OBJ, 3MF, STEP): solo para quien ya tiene su archivo
/admin               Panel del taller (sin encabezado ni botones de la tienda)
```

---

## 2. Flujos de usuario

### A. Elegir del catálogo → WhatsApp

```
Hero «Ver catálogo» ─► #catalogo ─► (filtro) ─► tarjeta «Agregar»
    ─► ventana «Elige tus opciones»: tamaño · color · acabado · cantidad (· nombre, si es personalizado)
    ─► «Agregar a mi pedido» ─► aviso «Agregado ✓ [Ver pedido]» + barra flotante «Mi pedido · desde $X»
    ─► (sigue agregando)
    ─► «Mi pedido»: revisar cantidades, nota opcional
    ─► «Enviar pedido por WhatsApp» ─► chat con el resumen escrito ─► el taller confirma precio final, envío y tiempo
```

Mensaje que se envía:

```
Hola CR3D 👋 Quiero hacer este pedido:

1. Dragón articulado × 2
   Mediano · Morado · Mate
   Desde $35.000 c/u
   https://tudominio.com/producto/dragon-articulado

Total de referencia: desde $70.000
Nota: es para un regalo

¿Me confirman el precio final y el tiempo de entrega?
```

Variante: en la página de producto el precio exacto está disponible y existe **Comprar ahora y pagar en línea** (pedido + Wompi, el flujo que ya existía).

### B. Mandar una foto o idea

```
Hero «Pedir algo con una foto» (o puente del catálogo, menú, llamado final) ─► #a-medida
  Paso 1  ¿Qué necesitas?   tipo (5 tarjetas) · fotos opcionales (cámara o galería) · descripción (obligatoria)
  Paso 2  Tamaño y color    medida aproximada o en cm · color o «que me recomienden» · cantidad
                            [Más detalles: sol/calor/flexible · fecha · presupuesto]
  Paso 3  Tus datos         nombre* · WhatsApp* · correo · ciudad · resumen · «No pagas nada…»
  ─► Con API: se crea la solicitud y abre /diseno/[id] («¡Recibimos tu solicitud!»)
  ─► Sin API: abre WhatsApp con el resumen y pide adjuntar las fotos en el chat
Taller: panel ▸ Diseños ▸ escribe por WhatsApp ▸ propuesta ▸ «Crear pedido con el modelo»
        (completa correo/ciudad si faltan) ▸ el cliente paga desde su página
```

Validación por paso: los errores se muestran junto al campo, el foco va al primer error y no se avanza hasta corregirlo. Solo son obligatorios la descripción (una frase), el nombre y el WhatsApp.

### C. Ya tengo un archivo 3D

Pie de página o menú ▸ «¿Ya tienes un archivo 3D?» ▸ `/cotizar` (cotizador anterior, intacto, con un aviso: «¿No tienes archivo? Mándanos una foto»).

---

## 3. Componentes clave

| Componente | Archivo | Qué hace |
|---|---|---|
| `SiteChrome` | `web/src/components/site/SiteChrome.tsx` | Encabezado, pie y botones flotantes en toda la tienda; el panel queda sin ellos |
| `Header` | `site/Header.tsx` | Navegación fija, bolsa con contador, CTA «Pedir con una foto», menú de celular |
| `FloatingActions` | `site/FloatingActions.tsx` | WhatsApp redondo o barra «Mi pedido»; avisos «Agregado ✓»; se aparta si tapa botones de un formulario (`data-hide-fab`) |
| `Hero` | `home/Hero.tsx` | Titular directo, 2 CTA, garantías, ilustración foto → pieza |
| `FeaturedCatalog` | `home/FeaturedCatalog.tsx` | Filtros por categoría, 8 tarjetas, «Ver todo», puente al pedido a medida |
| `ProductCard` | `catalog/ProductCard.tsx` | Foto, categoría, nombre, «Desde $X», colores y tamaños, botón **Agregar** / **Personalizar** |
| `QuickAdd` | `catalog/QuickAdd.tsx` | Ventana de opciones (tamaño, color, acabado, cantidad, texto) → Mi pedido |
| `Pickers` | `catalog/Pickers.tsx` | `SizePicker`, `ColorPicker`, `FinishPicker`, `QtyStepper`, `OptionGroup` reutilizables |
| `CartDrawer` | `cart/CartDrawer.tsx` | Mi pedido: líneas, cantidades, nota, total de referencia, **Enviar por WhatsApp** |
| `PhotoRequestForm` | `design/PhotoRequestForm.tsx` | Formulario guiado de 3 pasos con fotos, medidas aproximadas y envío a la API o a WhatsApp |
| `PhotoRequestSection` | `home/PhotoRequestSection.tsx` | Mensaje tranquilizador, ejemplos y el formulario |
| `HowItWorks`, `Works`, `Faq`, `FinalCta` | `home/` | Cómo funciona, prueba social, preguntas, cierre |
| `Sheet` | `ui/Sheet.tsx` | Ventana accesible: Esc, foco atrapado y devuelto, bloquea el desplazamiento; sube desde abajo en el celular |
| `ProductView` | `catalog/ProductView.tsx` | Página de producto con opciones simples y material en «Opciones avanzadas» |

Datos y estado:

| Módulo | Qué contiene |
|---|---|
| `web/src/lib/content.ts` | Todos los textos de la portada, pasos, FAQ, tipos de pedido, medidas aproximadas, acabados, fotos de trabajos |
| `web/src/lib/cart.ts` | Estado de «Mi pedido» (`useSyncExternalStore` + `localStorage`, sincronizado entre pestañas) y el mensaje de WhatsApp |
| `web/src/lib/shop.ts` | `useShop()`: colecciones y productos de la API, o un catálogo de muestra si el sitio corre sin API |

---

## 4. Sistema visual

| Token | Valor | Uso | Contraste sobre blanco |
|---|---|---|---|
| `--ac` | `#6a2ee0` | Botones, acentos, estados elegidos | 6,8:1 |
| `--ac-hover` | `#5822c4` | Hover de botones | 8,6:1 |
| `--brand` | `#8c53fd` | Logo (decorativo) | — |
| `--ac-tint` | `#f3eeff` | Fondos suaves, chips elegidos | `--ac` encima: 6,0:1 |
| `--deep` | `#1d0b4a` | Pie, llamado final, barra «Mi pedido» | blanco encima: 17,5:1 |
| `--text` / `--text-2` / `--text-3` | `#160f2e` / `#3b3452` / `#5f5878` | Títulos / cuerpo / secundario | 18,4:1 / 11,7:1 / 6,7:1 |
| `--wa` | `#25d366` + texto `#06210f` | Solo acciones de WhatsApp | 8,6:1 |

- **Tipografía:** Inter Tight (títulos, 700–800) e Inter (texto, 16 px como mínimo en campos para que iOS no haga zoom).
- **Botones:** primario morado, secundario con borde morado, WhatsApp verde. Alto mínimo de 44 px, y 52–56 px en los CTA principales.
- **Puntos de quiebre:** base celular; 560 px (2 columnas en formularios), 720 px (3 columnas de catálogo, ventanas centradas), 1000 px (navegación completa, 4 columnas).
- **Accesibilidad:** enlace «Saltar al contenido», foco visible, `aria-pressed` en todas las opciones, `aria-invalid` y mensajes junto a los campos, `prefers-reduced-motion`.

---

## 5. Cambios en la API

- `POST /api/designs`: las fotos son **opcionales** (basta la descripción). En el contacto solo son obligatorios nombre y WhatsApp; correo, ciudad y departamento pueden ir vacíos.
- Nuevo tipo de pedido `maqueta` («Maqueta o prototipo»).
- `POST /api/admin/designs/{id}/order` acepta `email`, `city` y `department` para completar lo que el cliente no dejó; si falta algo, responde «Falta la ciudad del cliente» (o el dato que corresponda).

## 6. Pendiente del negocio

- Completar en `content.ts` los tiempos de entrega y los medios de pago (busca `[TU`).
- Subir fotos reales de trabajos a `web/public/trabajos/` y listarlas en `REAL_WORKS`.
- Revisar `FINISHES` (por defecto «Mate» y «Brillante») según los filamentos que ofreces.
- Poner los enlaces reales de Instagram y TikTok en `web/src/components/site/Footer.tsx`.
