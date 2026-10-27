"use client";
/* eslint-disable @next/next/no-img-element -- miniaturas locales (blob:) generadas por el slicer */

import { FILE_UNITS, type FileUnit } from "@/lib/units";
import { duration, num1 } from "@/lib/format";
import type { ProjectInfo } from "@/lib/mesh/project";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import type { Level, ProjectReport } from "@/lib/checks";
import type { LoadedPlate } from "./useModelFile";

const LEVEL: Record<Level, { color: string; sym: string; verdict: string }> = {
  ok: { color: "var(--ok)", sym: "✓", verdict: "Listo para imprimir" },
  warn: { color: "var(--warn)", sym: "!", verdict: "Lo revisamos antes de imprimir" },
  bad: { color: "var(--bad)", sym: "×", verdict: "No cabe en la impresora" },
};

interface Props {
  plates: (LoadedPlate & { metrics: ModelMetrics })[];
  info: ProjectInfo;
  quote: Quote;
  sliced: boolean;
  report: ProjectReport;
  selected: number;
  onSelect: (i: number) => void;
  /** Aplica los ajustes guardados en el archivo; ausente si el archivo no trae ajustes útiles. */
  fileOptions?: () => void;
  unit: FileUnit;
  onUnit: (u: FileUnit) => void;
  scale: number;
  onScale: (s: number) => void;
}

const dim = (m: ModelMetrics) => `${num1(m.dx)} × ${num1(m.dy)} × ${num1(m.dz)} mm`;

/** Resumen de la revisión del archivo: lo importante a la vista y el detalle plegado. */
export function AnalysisPanel(props: Props) {
  const { plates, info, quote, sliced, report, selected, onSelect, fileOptions, unit, onUnit, scale, onScale } = props;
  const v = LEVEL[report.verdict];
  const multi = plates.length > 1;
  const pieces = plates.reduce((s, p) => s + p.plate.objects.length, 0);
  const volume = plates.reduce((s, p) => s + p.metrics.volumeCm3, 0);
  const problems = report.checks.filter((c) => c.level !== "ok");
  const sizeOpen = !report.fits || unit !== "mm" || scale !== 100;

  const facts = [
    multi ? `${plates.length} camas · ${pieces} piezas` : dim(plates[0].metrics),
    `${num1(volume)} cm³`,
    `${sliced ? "" : "≈ "}${num1(quote.grams)} g`,
    `${sliced ? "" : "≈ "}${duration(quote.hours)}`,
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600, color: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}>
          <span aria-hidden="true">{v.sym}</span>{v.verdict}
        </span>
        {facts.map((f) => (
          <span key={f} style={{ fontSize: 13, color: "var(--text-2)" }}>{f}</span>
        ))}
      </div>

      {problems.length > 0 && (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 0", padding: 0, listStyle: "none" }}>
          {problems.map((c) => (
            <li key={c.text} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, color: "#D8D8D2" }}>
              <span aria-hidden="true" style={{ flex: "none", width: 20, height: 20, marginTop: 1, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--bg)", background: LEVEL[c.level].color }}>{LEVEL[c.level].sym}</span>
              {c.text}
            </li>
          ))}
        </ul>
      )}

      {(info.slicer || info.printer) && <ProjectInfoBox info={info} onApply={fileOptions} />}

      {multi && <PlateList plates={plates} quote={quote} sliced={sliced} report={report} selected={selected} onSelect={onSelect} from={info.platesFrom} />}

      <details className="more" open={sizeOpen} style={{ marginTop: 14 }}>
        <summary>Tamaño y unidades{scale !== 100 ? ` · escala ${scale}%` : ""}</summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8 }}>¿En qué unidades está tu archivo?</div>
            <div style={{ display: "flex", gap: 6 }}>
              {FILE_UNITS.map((u) => (
                <button key={u.id} className="chip-btn" aria-pressed={u.id === unit} onClick={() => onUnit(u.id)} style={{ flex: 1 }}>{u.label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: "2 1 240px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>Escala: <strong style={{ color: "var(--text)" }}>{scale}%</strong></span>
              {!report.fits && (
                <button onClick={() => onScale(Math.min(400, report.maxScale))} className="chip-btn" aria-pressed="true">Ajustar para que quepa</button>
              )}
            </div>
            <input type="range" min={10} max={400} step={5} value={scale} onChange={(e) => onScale(+e.target.value)} aria-label="Escala del modelo" />
          </div>
        </div>
      </details>
    </div>
  );
}

function ProjectInfoBox({ info, onApply }: { info: ProjectInfo; onApply?: () => void }) {
  const parts = [
    info.printer,
    info.layerHeight && `capa ${info.layerHeight} mm`,
    info.infill !== undefined && `relleno ${info.infill}%`,
    info.filaments.length > 0 && info.filaments.map((f) => f.type).join(", "),
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between", padding: 12, marginTop: 14, borderRadius: 14, background: "var(--ac-tint)", border: "1px solid var(--ac-line)" }}>
      <div style={{ minWidth: 0, flex: "1 1 220px", fontSize: 13, lineHeight: 1.5 }}>
        <strong>Proyecto de {info.slicer ?? "slicer"}</strong>
        <span style={{ display: "block", color: "var(--text-2)" }}>{parts.join(" · ")}</span>
      </div>
      {onApply && <button onClick={onApply} className="chip-btn" aria-pressed="true">Usar estos ajustes</button>}
    </div>
  );
}

function PlateList({ plates, quote, sliced, report, selected, onSelect, from }: {
  plates: Props["plates"];
  quote: Quote;
  sliced: boolean;
  report: ProjectReport;
  selected: number;
  onSelect: (i: number) => void;
  from: ProjectInfo["platesFrom"];
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 8 }}>
        {from === "position" ? "Separamos tus piezas en estas camas según su posición:" : "Camas del proyecto (toca una para verla):"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {plates.map((p, i) => {
          const r = report.plates[i];
          const est = quote.plates[i];
          const on = selected === i;
          return (
            <button key={p.plate.id} onClick={() => onSelect(on ? -1 : i)} aria-pressed={on}
              style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", width: "100%", padding: 8, borderRadius: 12, cursor: "pointer", color: "var(--text)", background: on ? "var(--ac-tint)" : "var(--surface-3)", border: `1px solid ${on ? "var(--ac)" : r.fits ? "transparent" : "var(--bad)"}` }}>
              <span style={{ width: 44, height: 44, flex: "none", borderRadius: 8, overflow: "hidden", background: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.thumbUrl ? <img src={p.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="display" style={{ fontWeight: 700, color: "var(--text-3)" }}>{p.plate.id}</span>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                  <strong style={{ fontWeight: 600 }}>{p.plate.name}</strong>
                  {!r.fits && <span style={{ fontSize: 12, color: "var(--bad)", fontWeight: 600 }}>No cabe</span>}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {summarize(p.plate.objects.map((o) => o.name))}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-3)" }}>
                  {dim(p.metrics)} · {sliced ? "" : "≈ "}{num1(est.grams)} g · {duration(est.hours)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Tapa ×2, Base" */
function summarize(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
}
