import type { MeshAnalysis } from "./mesh/analyze";
import type { ModelMetrics } from "./pricing";

export const FILE_UNITS = [
  { id: "mm", label: "mm", factor: 1 },
  { id: "cm", label: "cm", factor: 10 },
  { id: "in", label: "pulgadas", factor: 25.4 },
] as const;

export type FileUnit = (typeof FILE_UNITS)[number]["id"];

export function unitFactor(unit: FileUnit, scalePct: number): number {
  const u = FILE_UNITS.find((x) => x.id === unit) ?? FILE_UNITS[0];
  return (u.factor * scalePct) / 100;
}

/** Medidas del análisis llevadas a mm reales según unidades y escala. */
export function scaledMetrics(an: MeshAnalysis, k: number): ModelMetrics {
  return {
    dx: an.dx * k,
    dy: an.dy * k,
    dz: an.dz * k,
    volumeCm3: an.volumeCm3 * k ** 3,
    areaCm2: an.areaCm2 * k ** 2,
  };
}
