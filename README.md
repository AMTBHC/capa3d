# Capa3D

Sitio de impresión 3D con cotizador en línea. El cliente sube su modelo (STL, OBJ, 3MF o STEP) y lo ve en 3D sobre la cama de la impresora. Elige material, calidad, relleno, color y soportes, y recibe un estimado al instante, que luego se reemplaza por el **precio laminado** con PrusaSlicer en el servidor.

## Probarlo en tu computador

1. Instala, una sola vez:
   - [Node.js](https://nodejs.org) (versión LTS)
   - [Python 3](https://www.python.org/downloads/). En Windows, marca **"Add python.exe to PATH"** en el instalador.
   - [PrusaSlicer](https://www.prusa3d.com/page/prusaslicer_424/). Sin él, el sitio funciona igual, pero con precio estimado y sin abrir STEP.
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

## Recibir los pedidos

WhatsApp no deja adjuntar archivos desde un enlace. Por eso el archivo del cliente queda en la API y el mensaje de WhatsApp trae el número de cotización (por ejemplo `QE909DD9F`).

1. Entra al panel: **http://localhost:3000/admin** (en producción, `tusitio.com/admin`).
2. Escribe la clave del panel. `iniciar` la genera la primera vez, la muestra al arrancar y la guarda en `api/.env` como `CAPA3D_ADMIN_TOKEN`.
3. En **"Pedidas por WhatsApp"** aparecen las cotizaciones donde el cliente tocó el botón, con el material, el color, la calidad, el relleno, la cantidad y el precio. En **"Todas las cotizaciones"** están también las que solo cotizó.
4. **Descargar** baja un zip con el archivo original del cliente, el G-code de cada cama y un `resumen.txt`.

En producción, usa una clave larga y difícil de adivinar.

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
3. **Pedidos y pagos**: base de datos, almacenamiento de archivos, Wompi o Mercado Pago, estados del pedido.
4. **Panel de administración**: pedidos, precios y materiales sin tocar código.
