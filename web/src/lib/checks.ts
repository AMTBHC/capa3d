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

export interface PlateInput {
  name: string;
  metrics: ModelMetrics;
  openEdges: number;
}

export interface ProjectReport extends PrintabilityReport {
  /** Revisión de cada cama, en el mismo orden de entrada. */
  plates: PrintabilityReport[];
}

/** Revisión de un proyecto: con una cama es la revisión normal; con varias, un resumen por cama. */
export function projectPrintability(plates: PlateInput[], bed: Bed, scalePct: number): ProjectReport {
  const reports = plates.map((p) => printability(p.metrics, p.openEdges, bed, scalePct));
  if (plates.length === 1) return { ...reports[0], plates: reports };

  const checks: Check[] = [];
  const names = (pred: (i: number) => boolean) => plates.filter((_, i) => pred(i)).map((p) => p.name).join(", ");

  const open = names((i) => plates[i].openEdges > 0);
  const unknown = names((i) => plates[i].openEdges < 0);
  if (!open && !unknown) checks.push({ level: "ok", text: "Todas las mallas están cerradas y se pueden imprimir." });
  if (open) checks.push({ level: "warn", text: `Hay bordes abiertos en: ${open}. Los revisamos y reparamos antes de imprimir.` });
  if (unknown) checks.push({ level: "warn", text: `Modelos muy detallados en: ${unknown}. Revisamos la malla manualmente.` });

  const fits = reports.every((r) => r.fits);
  const maxScale = Math.min(...reports.map((r) => r.maxScale));
  if (fits) checks.push({ level: "ok", text: `Las ${plates.length} camas caben en la impresora (${bed.x} × ${bed.y} × ${bed.z} mm).` });
  else
    checks.push({
      level: "bad",
      text: `${names((i) => !reports[i].fits)} excede el volumen de impresión. Escala el proyecto a ${maxScale}% o lo repartimos en más camas.`,
    });

  reports.forEach((r, i) =>
    r.checks
      .filter((c) => c.level === "warn" && !/malla|detallado/i.test(c.text))
      .forEach((c) => checks.push({ level: "warn", text: `${plates[i].name}: ${c.text}` })),
  );

  const verdict = checks.some((c) => c.level === "bad") ? "bad" : checks.some((c) => c.level === "warn") ? "warn" : "ok";
  return { checks, verdict, fits, maxScale, plates: reports };
}
