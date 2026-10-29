/**
 * Configuración del negocio. Con la API configurada, los precios y la cama se
 * toman de api/config/catalog.toml (GET /api/catalog); estos valores quedan
 * como respaldo si la API no responde.
 */

export type MaterialId = "PLA" | "PETG" | "ABS" | "TPU";

/** URL de la API de cotización (fase 2). Sin ella el sitio cotiza solo con el estimado. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const business = {
  name: "CR3D",
  /** Solo dígitos, con indicativo de país (ej. 573001234567). */
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, ""),
  email: process.env.NEXT_PUBLIC_EMAIL ?? "",
  currency: "COP",
  locale: "es-CO",
};

export const pricing = {
  /** Precio del filamento en COP por gramo. */
  pricePerGram: { PLA: 120, PETG: 140, ABS: 140, TPU: 250 } satisfies Record<MaterialId, number>,
  /** Tarifa de máquina en COP por hora. */
  machineRatePerHour: 2500,
  /** Cargo fijo por pieza (preparación, revisión, retiro de cama). */
  baseFee: 5000,
  /** El precio por unidad se redondea a este múltiplo. */
  roundTo: 100,
  /** Calentamiento y preparación de cada cama, en horas. */
  setupHoursPerPlate: 0.2,
};

export type PricingRates = typeof pricing;

export const printer = {
  /** Volumen de impresión en mm. */
  bed: { x: 256, y: 256, z: 256 },
  maxFileMB: 100,
  maxQty: 500,
};

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${business.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
