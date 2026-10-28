# Capa3D

Sitio de impresión 3D con cotizador en línea. El cliente sube su modelo (STL, OBJ, 3MF o STEP) y lo ve en 3D sobre la cama de la impresora. Elige material, calidad, relleno, color y soportes, y recibe un estimado al instante, que luego se reemplaza por el **precio laminado** con PrusaSlicer en el servidor.

## Probarlo en tu computador

1. Instala, una sola vez:
   - [Node.js](https://nodejs.org) (versión LTS)
   - [Python 3](https://www.python.org/downloads/). En Windows, marca **"Add python.exe to PATH"** en el instalador.
   - [PrusaSlicer](https://www.prusa3d.com/page/prusaslicer_424/). Sin él, el sitio funciona igual, pero con precio estimado y sin abrir STEP.
   - [OpenSCAD](https://openscad.org/downloads.html), para los llaveros con nombre del catálogo. En Windows usa el instalador; `iniciar` lo encuentra en `C:\Program Files\OpenSCAD`.
2. Doble clic en **`iniciar.bat`** (Windows) o **`iniciar.command`** (Mac y Linux).
   - La primera vez tarda unos minutos porque instala todo. Después arranca en segundos.
   - En Mac, si no abre con doble clic: clic derecho → Abrir, o en una terminal `bash iniciar.command`.
3. Se abre http://localhost:3000 con el sitio completo. La API queda en http://localhost:8000.

Para apagarlo, cierra las ventanas de la terminal.

## Estructura

```
api/                 API de cotización (Python + FastAPI + PrusaSlicer)
  config/
    catalog.toml     ← Precios, tarifas, materiales, calidades y cama (fuente de verdad)
    profiles/        ← Perfiles de impresora (Bambu X1/P1, Bambu A1, genérico)
  capa3d_api/
    main.py          Rutas HTTP (incluye el panel: /api/admin/…)
    service.py       Subida, análisis, cotización y laminado en segundo plano
    slicer.py        PrusaSlicer por línea de comandos (G-code, STEP → STL)
    calibrate.py     Ajusta tiempo y gramos para que coincidan con Bambu Studio
    mesh/            Lectura de STL/OBJ/3MF (mismas camas que la web) y análisis
    orders.py        Pedidos: estados, confirmación y pagos
    wompi.py         Enlace de pago, consulta de transacciones y eventos de Wompi
    pricing.py       Fórmula de precio
    store.py         SQLite: archivos y cotizaciones
web/                 Sitio (Next.js 16 + TypeScript + Three.js)
  src/app/           Layout, página y estilos globales (tokens de diseño)
  src/components/    Secciones de la página
    quoter/          Cotizador: carga de archivo, visor 3D, análisis y precio
  src/lib/
    config.ts        ← Precios, tarifas, volumen de la impresora, WhatsApp
    catalog.ts       ← Materiales, calidades, colores, galería, FAQ
    pricing.ts       Fórmula de cotización (pura, con pruebas)
    checks.ts        Revisión de imprimibilidad (malla cerrada, cabe en la cama…)
    mesh/            Lectura de STL/OBJ/3MF y análisis geométrico (en un Web Worker)
      threemf.ts     Lector 3MF propio: camas, objetos en subarchivos, datos del slicer
design/reference/    Mockup original exportado de la herramienta de diseño (solo referencia)
```

## Desarrollo

Requiere Node 20.9 o superior.

```bash
cd web
cp .env.example .env.local   # pon tu número de WhatsApp y correo
npm install
npm run dev                  # http://localhost:3000
```

Comprobaciones (las mismas que corre la CI en `.github/workflows/web.yml`):

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### API

Requiere Python 3.11 o superior y PrusaSlicer (`sudo apt install prusa-slicer` en Ubuntu/Debian).

```bash
cd api
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn capa3d_api.main:create_app --factory --reload   # http://localhost:8000/docs
pytest -q && ruff check .
```

Para conectarla con la web, pon `NEXT_PUBLIC_API_URL=http://localhost:8000` en `web/.env.local`. Sin esa variable, la web funciona sola con el estimado.

Con Docker, sitio y API juntos: `docker compose up --build` (sitio en :3000, API en :8000).

## Configurar el negocio

| Qué | Dónde |
|---|---|
| Número de WhatsApp y correo | `web/.env.local` (`NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_EMAIL`) |
| Precio por gramo, tarifa por hora, cargo base, vigencia de cotizaciones | `api/config/catalog.toml` (la web los lee de la API; `web/src/lib/config.ts` es solo el respaldo sin API) |
| Tu impresora (cama y perfil) | `api/config/catalog.toml` → `[printer]`. Viene con la Bambu X1C/P1S; ahí mismo están las líneas para A1 y A1 mini |
| Corrección de tiempo y gramos frente a Bambu Studio | `api/config/catalog.toml` → `[calibration]`. Se calcula con `calibrate` (ver abajo) |
| Temperaturas y densidad de cada material | `api/config/catalog.toml` → `[materials.*]` |
| Orígenes permitidos (CORS), carpeta de datos, límites, clave del panel | `api/.env` (ver `api/.env.example`) |
| Materiales, calidades (altura de capa y velocidad), colores | `web/src/lib/catalog.ts` |
| Galería (fotos en `web/public/`), FAQ, pasos | `web/src/lib/catalog.ts` |
| Precios de los planes | `web/src/components/Plans.tsx` |

Textos pendientes de completar: busca `[TU` en `web/src`.

## Pedidos y pagos

```
Cliente cotiza → "Hacer pedido": datos y dirección, sin pagar             → Recibido
Tú revisas el archivo en el panel, ajustas impresión y envío, confirmas    → Por pagar
Cliente elige: pagar todo, o abonar el 50 % y el resto en efectivo al recibir → Pagado
Tú imprimes → Imprimiendo → Enviado (transportadora + guía) → Entregado (y cobras el saldo)
```

**Para el cliente**
- Al hacer el pedido ve su **número de pedido**, un botón para **enviarlo a Capa3D por WhatsApp** (así le queda el enlace en el chat) y otro para copiar el enlace.
- **Mis pedidos** (en el menú y en el pie de página) muestra los pedidos hechos desde ese navegador, y permite buscarlos con el **correo y el celular** del pedido.
- Su página de pedido se actualiza **en vivo**: cuando confirmas el precio, marcas un estado o entra un pago, lo ve en uno o dos segundos sin recargar.

**Para ti (panel)**
- Entra desde **"Acceso del taller"** en el pie de página, o con el botón **Panel** del menú, que solo aparece en el navegador donde ya iniciaste sesión. `iniciar` abre el panel solo.
- El panel está **en vivo**: cuando llega un pedido suena un aviso, aparece arriba y la pestaña muestra cuántos hay por revisar, por ejemplo "(2) Panel". Con "Activar avisos en el computador" también te llega una notificación de Windows.
- **Pagos con abono:** el panel muestra cuánto se pagó y cuánto falta. Al entregar, el botón dice "Entregado · cobré $…" y registra el cobro. Si te pagan por fuera de Wompi, usa "Recibí el total" o "Recibí el abono".
- **El porcentaje del abono** se configura en `api/config/catalog.toml` → `[payments] deposit_percent` (0 = solo pago total).
- **Sin llaves de Wompi**, el cliente ve "Pagar por WhatsApp" y tú registras el pago a mano.
- **Costo de envío:** `api/config/catalog.toml` → `[shipping]`. Ahí van la tarifa general y las ciudades con otra tarifa. En cada pedido lo puedes ajustar antes de confirmar.

### Activar Wompi

1. Crea tu cuenta de comercio en https://comercios.wompi.co.
2. En **Desarrolladores** copia la llave pública, el secreto de integridad y el secreto de eventos. Empieza con las de **prueba** (`pub_test_…`): los pagos van al sandbox y no se cobra nada.
3. Ponlas en `api/.env`. La llave **privada** (`prv_test_…`) es opcional, pero en tu computador es la que confirma el pago sola:
   ```
   CAPA3D_WOMPI_PUBLIC_KEY=pub_test_...
   CAPA3D_WOMPI_INTEGRITY_SECRET=test_integrity_...
   CAPA3D_WOMPI_EVENTS_SECRET=test_events_...
   CAPA3D_WOMPI_PRIVATE_KEY=prv_test_...
   CAPA3D_SITE_URL=http://localhost:3000
   ```
4. Reinicia `iniciar`. Haz un pedido, confírmalo en el panel y págalo con los datos de prueba que indica la documentación de Wompi.
5. **En producción:** cambia a las llaves `pub_prod_…` (y `prv_prod_…`), pon en `CAPA3D_SITE_URL` la dirección real del sitio y, en Wompi → Eventos, registra la URL `https://<tu-api>/api/payments/wompi`.

**En tu computador funciona un poco distinto.** Wompi bloquea con un error 403 los pagos cuya página de regreso es `localhost`, y tampoco puede enviarte eventos. Por eso, cuando el sitio corre en tu computador:
- "Pagar ahora" abre Wompi en **otra pestaña**, sin página de regreso, y la página del pedido queda esperando.
- Con la llave privada, la API consulta el pago en Wompi y la página cambia sola a **Pagado**. Sin ella, revisa el pago en comercios.wompi.co y márcalo como pagado en el panel; el panel te avisa cuando el cliente abrió un pago.

Con el sitio publicado en un dominio real, Wompi devuelve al cliente a su pedido y además envía el evento de pago.

### Descargar los archivos

WhatsApp no deja adjuntar archivos desde un enlace, por eso el archivo del cliente queda en la API. En el panel, **Descargar** baja un zip con el archivo original, el G-code de cada cama y un `resumen.txt` con los datos del cliente y del pedido.

La clave del panel la genera `iniciar` la primera vez, la muestra al arrancar y la guarda en `api/.env` como `CAPA3D_ADMIN_TOKEN`. En producción usa una clave larga.

## Catálogo

Además del cotizador, el sitio tiene una tienda de productos listos para imprimir:

- `/catalogo`: las colecciones **Lo más pedido**, **Novedades virales**, **Virales de redes sociales**, **Llaveros** y **Personajes y figuras**. En la página de inicio aparece la sección **Elige algo listo para imprimir**.
- `/catalogo/<colección>`: los productos, filtrables por subsección (Juguetes y antiestrés, Hogar y cocina, Animales articulados, Decoración y lámparas…).
- `/producto/<producto>`: fotos, vista 3D, tamaño, material, color y cantidad. El precio se calcula laminando el modelo, y **Pedirlo** usa el mismo flujo de pedido y pago del cotizador.

### Productos importados

La API trae una lista de productos sacados de las carpetas de Google Drive del área de miembros de Maestro 3D (`api/config/catalog_import.json`). Al arrancar:

1. Crea los productos que falten, con su foto, sus tamaños y un precio de referencia ya laminado.
2. Descarga las fotos en segundo plano (`api/data/catalog/images`).
3. El modelo 3D se descarga de Drive **la primera vez que alguien abre el producto** (unos segundos) y desde ahí queda guardado. Así no se bajan gigas de archivos al arrancar.

Los productos con personajes o marcas de terceros (Disney, Marvel, Pokémon, Nintendo, Minecraft, Stanley, Crocs…) se importan como **borrador**: no se ven en la tienda hasta que los publiques. Antes de hacerlo, ten en cuenta que comprar el pack de archivos no da derecho a vender figuras de esos personajes. En el panel, **Publicar borradores** los publica todos de una colección.

Un producto que borres en el panel no se vuelve a importar. Para no importar nada, deja vacío `CAPA3D_CATALOG_IMPORT` en `api/.env`.

### Manejarlo desde el panel

En el panel, pestaña **Catálogo**:

1. **+ Nueva colección** o **Editar** (nombre, emoji, descripción, orden, publicada). Toca la portada para subir una foto; si no, se usa la del primer producto.
2. **+ Producto** en una colección: nombre, subsección, descripción, etiquetas (Viral, Más pedido, Nuevo), tamaños como % de escala sobre el modelo, y color sugerido.
3. Después de crearlo, sube el modelo (STL, 3MF, OBJ o STEP) y las fotos. La primera foto es la portada.
4. Marca **Publicado**. Un producto sin modelo no aparece en la tienda, y una colección sin productos visibles tampoco.

El **Llavero con tu nombre** viene creado: el cliente escribe el nombre y OpenSCAD genera el modelo en uno o dos segundos (plantilla en `api/config/templates/llavero_nombre.scad`). Si OpenSCAD no está instalado, el producto queda oculto y el panel lo avisa.

Usa fotos de tus propias impresiones cuando puedas: venden mejor y evitas problemas con las fotos de otros.

## Calibrar con Bambu Studio

La API lamina con PrusaSlicer usando un perfil que imita la velocidad de las Bambu. Aun así, el tiempo y los gramos no salen idénticos a los de Bambu Studio. Para que coincidan, calcula un factor de corrección con piezas reales:

1. En Bambu Studio, abre 3 o más piezas distintas (una pequeña, una mediana y una grande), con tu material y tus ajustes de siempre.
2. Lamina **todas las camas** y guarda el proyecto (**Archivo → Guardar proyecto**). El 3MF guarda el tiempo y los gramos de cada cama.
3. En la carpeta `api`, con el entorno activado (en Windows: `.venv\Scripts\activate`):
   ```bash
   python -m capa3d_api.calibrate pieza1.3mf pieza2.3mf pieza3.3mf --guardar
   ```
   Compara cada cama, muestra la diferencia y guarda `time_factor` y `weight_factor` en `catalog.toml`.
4. Reinicia la API, o cierra y vuelve a abrir `iniciar`.

Si el 3MF no trae el tiempo, pásalo a mano con los datos que muestra Bambu Studio:
```bash
python -m capa3d_api.calibrate pieza.stl --tiempo "1h 23m" --gramos 38.2 --relleno 15 --material PLA
```

## Archivos 3MF con varias camas

Los proyectos de **Bambu Studio y OrcaSlicer** guardan sus camas en `Metadata/model_settings.config`. El cotizador las lee y muestra:

- Cada cama con su nombre, su miniatura, sus piezas, sus medidas y si cabe en la impresora.
- Los datos laminados, si el archivo los trae (`slice_info.config`): gramos y tiempo reales del slicer.
- La impresora, la altura de capa, el relleno y los filamentos del proyecto, con un botón para usar esos ajustes en la cotización.

Si el archivo no declara camas (por ejemplo, un 3MF exportado de PrusaSlicer) y las piezas no caben juntas, se agrupan por posición en camas que sí quepan.

En el visor se puede ver una cama o todas lado a lado, y ampliarlo a pantalla completa (Esc para cerrar).

Cada cama se cotiza como una impresión aparte (con su propio calentamiento). El cargo base se cobra una vez por copia del proyecto.

## Cómo se calcula el precio

**Precio laminado (con la API).** Cada cama se lamina con PrusaSlicer usando el perfil de tu impresora, el material, la calidad, el relleno, los soportes y la escala que eligió el cliente. Del G-code salen los gramos y el tiempo, ajustados con los factores de calibración:

- **Precio por unidad** = cargo base + gramos × $/g + (horas del slicer + preparación por cama) × tarifa, redondeado a $100

Cada cotización queda guardada con un número (por ejemplo `Q1A2B3C4D`), su vigencia y el G-code de cada cama, listo para imprimir. El número aparece en el mensaje de WhatsApp. Si el laminado falla, esa cama se cotiza con el estimado y la respuesta lo indica.

**Estimado inmediato** (`web/src/lib/pricing.ts` y `api/capa3d_api/pricing.py`, la misma fórmula):

- **Volumen extruido** = paredes (área × 1,2 mm) + interior × % de relleno
- **Gramos** = volumen extruido × 1,1 (desperdicio) × densidad del material
- **Horas** = volumen / caudal de la calidad × 1,25 + 0,2 h de calentamiento
- **Precio por unidad** = cargo base + gramos × $/g + horas × tarifa, redondeado a $100

El estimado no tiene en cuenta los soportes ni la orientación. Sirve para mostrar un precio al instante mientras llega el laminado.

## Hoja de ruta

1. ✅ **Frontend**: migración del mockup a Next.js, visor WebGL con capas visibles y volumen de la impresora, lectura correcta de 3MF (unidades, componentes y transformaciones), análisis en un Web Worker.
2. ✅ **Backend de cotización** (Python + FastAPI): subida del archivo, laminado real con PrusaSlicer (gramos y tiempo exactos, con soportes), conversión de STEP para verlo y cotizarlo, y precios en el servidor.
3. ✅ **Pedidos y pagos**: pedido sin pago, confirmación del precio en el panel, pago con Wompi (o manual), estados hasta la entrega, página de seguimiento para el cliente.
4. ✅ **Catálogo**: colecciones, productos con fotos y modelo, precio laminado por tamaño, llaveros con nombre generados con OpenSCAD.
5. **Panel de administración**: pedidos, precios y materiales sin tocar código.
