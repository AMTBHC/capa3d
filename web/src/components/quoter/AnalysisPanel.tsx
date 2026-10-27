"use client";

import { FILE_UNITS, type FileUnit } from "@/lib/units";
import { duration, num1 } from "@/lib/format";
import type { MeshAnalysis } from "@/lib/mesh/analyze";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import type { Level, PrintabilityReport } from "@/lib/checks";

const LEVEL: Record<Level, { color: string; sym: string; verdict: string }> = {
  ok: { color: "var(--ok)", sym: "✓", verdict: "LISTO PARA IMPRIMIR" },
  warn: { color: "var(--warn)", sym: "!", verdict: "REQUIERE REVISIÓN" },
  bad: { color: "var(--bad)", sym: "×", verdict: "NO CABE ASÍ" },
};

interface Props {
  analysis: MeshAnalysis;
  metrics: ModelMetrics;
  quote: Quote;
  report: PrintabilityReport;
  unit: FileUnit;
  onUnit: (u: FileUnit) => void;
  scale: number;
  onScale: (s: number) => void;
  qty: number;
  onQty: (q: number) => void;
}

export function AnalysisPanel({ analysis, metrics, quote, report, unit, onUnit, scale, onScale, qty, onQty }: Props) {
  const v = LEVEL[report.verdict];
  const stats = [
    ["DIMENSIONES", `${num1(metrics.dx)} × ${num1(metrics.dy)} × ${num1(metrics.dz)} mm`],
    ["VOLUMEN", `${num1(metrics.volumeCm3)} cm³`],
    ["PESO ESTIMADO", `${num1(quote.grams)} g`],
    ["TIEMPO ESTIMADO", duration(quote.hours)],
    ["TRIÁNGULOS", analysis.triangles.toLocaleString("es-CO")],
  ];
  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span className="mono label">REVISIÓN AUTOMÁTICA DEL ARCHIVO</span>
        <span className="mono" style={{ padding: "6px 12px", borderRadius: 99, fontSize: 11, letterSpacing: 1, color: v.color, border: `1px solid ${v.color}`, background: `color-mix(in srgb, ${v.color} 8%, transparent)` }}>{v.verdict}</span>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {stats.map(([k, val]) => (
          <div key={k} style={{ flex: "1 1 150px", minWidth: 0, padding: 14, borderRadius: 14, background: "var(--surface-3)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div className="mono label-sm">{k}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 6 }}>{val}</div>
          </div>
        ))}
      </div>
      <ul style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0 0", padding: 0, listStyle: "none" }}>
        {report.checks.map((c) => (
          <li key={c.text} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span className="mono" aria-hidden="true" style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: "var(--bg)", background: LEVEL[c.level].color }}>{LEVEL[c.level].sym}</span>
            <span style={{ color: "#D8D8D2", fontSize: 14, lineHeight: 1.5, paddingTop: 2 }}>{c.text}</span>
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 20, marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div className="mono label-sm" style={{ marginBottom: 10 }}>UNIDADES DEL ARCHIVO</div>
          <div style={{ display: "flex", gap: 6 }}>
            {FILE_UNITS.map((u) => {
              const on = u.id === unit;
              return (
                <button key={u.id} aria-pressed={on} onClick={() => onUnit(u.id)}
                  style={{ flex: 1, minHeight: 44, padding: "0 10px", borderRadius: 10, cursor: "pointer", fontSize: 13, color: on ? "var(--bg)" : "var(--text)", background: on ? "var(--ac)" : "var(--surface-3)", border: `1px solid ${on ? "var(--ac)" : "rgba(255,255,255,.12)"}` }}>
                  {u.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: "2 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span className="mono label-sm">ESCALA · {scale}%</span>
            {!report.fits && (
              <button onClick={() => onScale(Math.min(400, report.maxScale))}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ac)", background: "transparent", color: "var(--ac)", fontSize: 12, cursor: "pointer" }}>
                Ajustar a la impresora
              </button>
            )}
          </div>
          <input type="range" min={10} max={400} step={5} value={scale} onChange={(e) => onScale(+e.target.value)} aria-label="Escala del modelo" />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <div className="mono label-sm" style={{ marginBottom: 10 }}>CANTIDAD</div>
          <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", overflow: "hidden" }}>
            <button onClick={() => onQty(qty - 1)} aria-label="Quitar una unidad" style={qtyBtn}>−</button>
            <span className="mono" aria-live="polite" style={{ minWidth: 48, textAlign: "center", fontSize: 16 }}>{qty}</span>
            <button onClick={() => onQty(qty + 1)} aria-label="Agregar una unidad" style={qtyBtn}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const qtyBtn = { width: 44, height: 44, border: 0, background: "var(--surface-3)", color: "var(--text)", fontSize: 20, cursor: "pointer" } as const;
