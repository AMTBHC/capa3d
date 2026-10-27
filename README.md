# Capa3D

Sitio de impresión 3D con cotizador en línea. El cliente sube su modelo (STL, OBJ, 3MF o STEP) y lo ve en 3D sobre la cama de la impresora. Elige material, calidad, relleno, color y soportes, y recibe un estimado al instante, que luego se reemplaza por el **precio laminado** con PrusaSlicer en el servidor.

## Estructura

```
api/                 API de cotización (Python + FastAPI + PrusaSlicer)
  config/
    catalog.toml     ← Precios, tarifas, materiales, calidades y cama (fuente de verdad)
    printer.ini      ← Perfil de PrusaSlicer de tu impresora
  capa3d_api/
    main.py          Rutas HTTP
    service.py       Subida, análisis, cotización y laminado en segundo plano
    slicer.py        PrusaSlicer por línea de comandos (G-code, STEP → STL)
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
| Volumen de impresión | `api/config/catalog.toml` → `[printer] bed` |
| Velocidades, perímetros y aceleraciones con que se calcula el tiempo | `api/config/printer.ini`: reemplázalo por el perfil exportado de tu PrusaSlicer |
| Temperaturas y densidad de cada material | `api/config/catalog.toml` → `[materials.*]` |
| Orígenes permitidos (CORS), carpeta de datos, límites | `api/.env` (ver `api/.env.example`) |
| Materiales, calidades (altura de capa y velocidad), colores | `web/src/lib/catalog.ts` |
| Galería (fotos en `web/public/`), FAQ, pasos | `web/src/lib/catalog.ts` |
| Precios de los planes | `web/src/components/Plans.tsx` |

Textos pendientes de completar: busca `[TU` en `web/src`.

## Archivos 3MF con varias camas

Los proyectos de **Bambu Studio y OrcaSlicer** guardan sus camas en `Metadata/model_settings.config`. El cotizador las lee y muestra:

- Cada cama con su nombre, su miniatura, sus piezas, sus medidas y si cabe en la impresora.
- Los datos laminados, si el archivo los trae (`slice_info.config`): gramos y tiempo reales del slicer.
- La impresora, la altura de capa, el relleno y los filamentos del proyecto, con un botón para usar esos ajustes en la cotización.

Si el archivo no declara camas (por ejemplo, un 3MF exportado de PrusaSlicer) y las piezas no caben juntas, se agrupan por posición en camas que sí quepan.

En el visor se puede ver una cama o todas lado a lado, y ampliarlo a pantalla completa (Esc para cerrar).

Cada cama se cotiza como una impresión aparte (con su propio calentamiento). El cargo base se cobra una vez por copia del proyecto.

## Cómo se calcula el precio

**Precio laminado (con la API).** Cada cama se lamina con PrusaSlicer usando `printer.ini`, el material, la calidad, el relleno, los soportes y la escala que eligió el cliente. Del G-code salen los gramos y el tiempo exactos:

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
