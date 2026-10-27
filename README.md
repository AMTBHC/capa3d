# Capa3D

Sitio de impresión 3D con cotizador en línea: el cliente sube su modelo (STL, OBJ o 3MF), lo ve en 3D sobre la cama de la impresora, elige material, calidad, relleno y color, y recibe un precio estimado al instante.

## Estructura

```
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

## Configurar el negocio

| Qué | Dónde |
|---|---|
| Número de WhatsApp y correo | `web/.env.local` (`NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_EMAIL`) |
| Precio por gramo, tarifa por hora, cargo base | `web/src/lib/config.ts` → `pricing` |
| Volumen de impresión, tamaño máximo de archivo | `web/src/lib/config.ts` → `printer` |
| Materiales, calidades (altura de capa y velocidad), colores | `web/src/lib/catalog.ts` |
| Galería (fotos en `web/public/`), FAQ, pasos | `web/src/lib/catalog.ts` |
| Precios de los planes | `web/src/components/Plans.tsx` |

Textos pendientes de completar: busca `[TU` en `web/src`.

## Cómo se calcula el precio

`web/src/lib/pricing.ts`, sin slicer:

- **Volumen extruido** = paredes (área × 1,2 mm) + interior × % de relleno
- **Gramos** = volumen extruido × 1,1 (desperdicio) × densidad del material
- **Horas** = volumen / caudal de la calidad × 1,25 + 0,2 h de calentamiento
- **Precio por unidad** = cargo base + gramos × $/g + horas × tarifa, redondeado a $100

Es un estimado. No tiene en cuenta los soportes ni la orientación; por eso el precio final se confirma al revisar el archivo.

## Hoja de ruta

1. ✅ **Frontend**: migración del mockup a Next.js, visor WebGL con capas visibles y volumen de la impresora, lectura correcta de 3MF (unidades, componentes y transformaciones), análisis en un Web Worker.
2. **Backend de cotización** (Python + FastAPI): subida del archivo, laminado real con PrusaSlicer u OrcaSlicer por línea de comandos (gramos y tiempo exactos, con soportes), conversión de STEP y precios en el servidor.
3. **Pedidos y pagos**: base de datos, almacenamiento de archivos, Wompi o Mercado Pago, estados del pedido.
4. **Panel de administración**: pedidos, precios y materiales sin tocar código.
