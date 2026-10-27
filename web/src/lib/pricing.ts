import { pricing as defaultRates, type MaterialId, type PricingRates } from "./config";

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
  /** Una cama o varias: cada cama es una impresión aparte. */
  metrics: ModelMetrics | ModelMetrics[];
  material: { id: MaterialId; density: number };
  /** mm³/s efectivos que extruye la impresora con esta calidad. */
  flow: number;
  /** 0–100 */
  infill: number;
  qty: number;
  rates?: PricingRates;
}

export interface PrintEstimate {
  grams: number;
  hours: number;
}

export interface Quote {
  /** Estimado de cada cama, en el mismo orden de entrada. */
  plates: PrintEstimate[];
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

/** Gramos y horas de una cama, sin slicer: paredes + relleno proporcional, más la preparación. */
export function estimatePrint(
  metrics: ModelMetrics,
  density: number,
  flow: number,
  infill: number,
  setupHours = defaultRates.setupHoursPerPlate,
): PrintEstimate {
  const vol = metrics.volumeCm3;
  const shell = Math.min(vol, metrics.areaCm2 * SHELL_CM);
  const extruded = shell + Math.max(0, vol - shell) * (infill / 100);
  return {
    grams: extruded * WASTE * density,
    hours: ((extruded * 1000) / flow / 3600) * TIME_OVERHEAD + setupHours,
  };
}

/**
 * Precio inmediato de un modelo o proyecto. Cada cama suma su material y su tiempo
 * (incluido el calentamiento); el cargo base se cobra una vez por unidad del proyecto.
 * El precio final se confirma al laminar el archivo.
 */
export function estimateQuote({ metrics, material, flow, infill, qty, rates = defaultRates }: QuoteInput): Quote {
  const plates = (Array.isArray(metrics) ? metrics : [metrics]).map((m) => estimatePrint(m, material.density, flow, infill, rates.setupHoursPerPlate));
  const grams = plates.reduce((s, p) => s + p.grams, 0);
  const hours = plates.reduce((s, p) => s + p.hours, 0);
  const pricePerGram = rates.pricePerGram[material.id];
  const materialCost = grams * pricePerGram;
  const machineCost = hours * rates.machineRatePerHour;
  const unitPrice = Math.round((rates.baseFee + materialCost + machineCost) / rates.roundTo) * rates.roundTo;
  const q = Math.max(1, Math.floor(qty));
  return {
    plates,
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
