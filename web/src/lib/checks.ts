import { num1 } from "./format";
import type { ModelMetrics } from "./pricing";

export type Level = "ok" | "warn" | "bad";

export interface Check {
  level: Level;
  text: string;
}

export interface Bed {
  x: number;
  y: number;
  z: number;
}

export interface PrintabilityReport {
  checks: Check[];
  verdict: Level;
  /** El modelo cabe en la cama, permitiendo rotarlo. */
  fits: boolean;
  /** Escala (%) máxima con la que cabe, en pasos de 5. */
  maxScale: number;
}

/**
 * @param openEdges bordes que no comparten exactamente dos triángulos; -1 si no se calculó.
 * @param scalePct escala aplicada a `m`, para sugerir la escala que cabe.
 */
export function printability(m: ModelMetrics, openEdges: number, bed: Bed, scalePct: number): PrintabilityReport {
  const checks: Check[] = [];
  const bedArr = [bed.x, bed.y, bed.z];
  const ds = [m.dx, m.dy, m.dz].sort((a, b) => a - b);
  const bs = [...bedArr].sort((a, b) => a - b);

  if (openEdges === 0) checks.push({ level: "ok", text: "Malla cerrada: el modelo es sólido y se puede imprimir." });
  else if (openEdges > 0)
    checks.push({
      level: "warn",
      text: `La malla tiene ${openEdges.toLocaleString("es-CO")} bordes abiertos. La revisamos y reparamos antes de imprimir.`,
    });
  else checks.push({ level: "warn", text: "Modelo muy detallado: revisamos la malla manualmente." });

  const fitDirect = m.dx <= bed.x && m.dy <= bed.y && m.dz <= bed.z;
  const fits = ds[0] <= bs[0] && ds[1] <= bs[1] && ds[2] <= bs[2];
  const maxScale = Math.max(
    10,
    Math.floor((Math.min(bs[0] / ds[0], bs[1] / ds[1], bs[2] / ds[2]) * scalePct) / 5) * 5,
  );
  if (fitDirect) checks.push({ level: "ok", text: `Cabe en la impresora (${bedArr.join(" × ")} mm).` });
  else if (fits) checks.push({ level: "ok", text: "Cabe en la impresora girándolo sobre la cama." });
  else
    checks.push({
      level: "bad",
      text: `Excede el volumen de impresión. Escálalo a ${maxScale}% o lo imprimimos en partes.`,
    });

  if (ds[2] < 5)
    checks.push({ level: "warn", text: "Mide menos de 5 mm. Si tu archivo está en cm o pulgadas, cámbialo en Unidades." });
  else if (ds[0] < 0.8)
    checks.push({ level: "warn", text: `Su lado más delgado mide ${num1(ds[0])} mm; puede quedar frágil.` });

  const verdict = checks.reduce<Level>(
    (w, c) => (c.level === "bad" ? "bad" : c.level === "warn" && w !== "bad" ? "warn" : w),
    "ok",
  );
  return { checks, verdict, fits, maxScale };
}
