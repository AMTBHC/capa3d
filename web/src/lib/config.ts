/**
 * Configuración del negocio. En la fase 2 los precios pasan al backend;
 * mientras tanto este archivo es la única fuente de verdad.
 */

export type MaterialId = "PLA" | "PETG" | "ABS" | "TPU";

export const business = {
  name: "Capa3D",
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
};

export const printer = {
  /** Volumen de impresión en mm. */
  bed: { x: 220, y: 220, z: 250 },
  maxFileMB: 100,
  maxQty: 500,
};

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${business.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
