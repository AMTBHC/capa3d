import { pricing as defaultRates, type MaterialId } from "./config";

/** Medidas del modelo ya escalado, en mm / cm³ / cm². */
export interface ModelMetrics {
  dx: number;
  dy: number;
  dz: number;
  volumeCm3: number;
  areaCm2: number;
}

/** Pieza de ejemplo que se cotiza mientras el cliente no sube un archivo. */
export const SAMPLE_MODEL: ModelMetrics = { dx: 60, dy: 60, dz: 90, volumeCm3: 40, areaCm2: 90 };

export interface QuoteInput {
  metrics: ModelMetrics;
  material: { id: MaterialId; density: number };
  /** mm³/s efectivos que extruye la impresora con esta calidad. */
  flow: number;
  /** 0–100 */
  infill: number;
  qty: number;
  rates?: typeof defaultRates;
}

export interface Quote {
  grams: number;
  hours: number;
  pricePerGram: number;
  materialCost: number;
  machineCost: number;
  baseFee: number;
  unitPrice: number;
  qty: number;
  total: number;
}

/** Espesor de pared equivalente (cm) usado para estimar el volumen del perímetro. */
const SHELL_CM = 0.12;
/** Margen por purga, faldón y desperdicio. */
const WASTE = 1.1;
/** Factor por desplazamientos, aceleración y cambios de capa. */
const TIME_OVERHEAD = 1.25;
/** Calentamiento y preparación, en horas. */
const WARMUP_H = 0.2;

/**
 * Estimado sin slicer: paredes + relleno proporcional. Sirve para dar un precio
 * inmediato; el precio final se confirma al laminar el archivo.
 */
export function estimateQuote({ metrics, material, flow, infill, qty, rates = defaultRates }: QuoteInput): Quote {
  const vol = metrics.volumeCm3;
  const shell = Math.min(vol, metrics.areaCm2 * SHELL_CM);
  const extruded = shell + Math.max(0, vol - shell) * (infill / 100);
  const grams = extruded * WASTE * material.density;
  const hours = ((extruded * 1000) / flow / 3600) * TIME_OVERHEAD + WARMUP_H;
  const pricePerGram = rates.pricePerGram[material.id];
  const materialCost = grams * pricePerGram;
  const machineCost = hours * rates.machineRatePerHour;
  const unitPrice = Math.round((rates.baseFee + materialCost + machineCost) / rates.roundTo) * rates.roundTo;
  const q = Math.max(1, Math.floor(qty));
  return {
    grams,
    hours,
    pricePerGram,
    materialCost,
    machineCost,
    baseFee: rates.baseFee,
    unitPrice,
    qty: q,
    total: unitPrice * q,
  };
}
