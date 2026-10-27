"use client";
/* eslint-disable @next/next/no-img-element -- miniaturas locales (blob:) generadas por el slicer */

import { FILE_UNITS, type FileUnit } from "@/lib/units";
import { duration, num1 } from "@/lib/format";
import type { ProjectInfo } from "@/lib/mesh/project";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import type { Level, ProjectReport } from "@/lib/checks";
import type { LoadedPlate } from "./useModelFile";

const LEVEL: Record<Level, { color: string; sym: string; verdict: string }> = {
  ok: { color: "var(--ok)", sym: "✓", verdict: "LISTO PARA IMPRIMIR" },
  warn: { color: "var(--warn)", sym: "!", verdict: "REQUIERE REVISIÓN" },
  bad: { color: "var(--bad)", sym: "×", verdict: "NO CABE ASÍ" },
};

interface Props {
  plates: (LoadedPlate & { metrics: ModelMetrics })[];
  info: ProjectInfo;
  quote: Quote;
  /** El peso y el tiempo de `quote` vienen del slicer. */
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
  qty: number;
  onQty: (q: number) => void;
}

const dim = (m: ModelMetrics) => `${num1(m.dx)} × ${num1(m.dy)} × ${num1(m.dz)} mm`;

export function AnalysisPanel(props: Props) {
  const { plates, info, quote, sliced, report, selected, onSelect, fileOptions, unit, onUnit, scale, onScale, qty, onQty } = props;
  const v = LEVEL[report.verdict];
  const multi = plates.length > 1;
  const pieces = plates.reduce((s, p) => s + p.plate.objects.length, 0);
  const volume = plates.reduce((s, p) => s + p.metrics.volumeCm3, 0);
  const triangles = plates.reduce((s, p) => s + p.analysis.triangles, 0);

  const stats = multi
    ? [
        ["CAMAS", String(plates.length)],
        ["PIEZAS", String(pieces)],
        ["VOLUMEN TOTAL", `${num1(volume)} cm³`],
        [sliced ? "PESO LAMINADO" : "PESO ESTIMADO", `${num1(quote.grams)} g`],
        [sliced ? "TIEMPO LAMINADO" : "TIEMPO ESTIMADO", duration(quote.hours)],
      ]
    : [
        ["DIMENSIONES", dim(plates[0].metrics)],
        ["VOLUMEN", `${num1(volume)} cm³`],
        [sliced ? "PESO LAMINADO" : "PESO ESTIMADO", `${num1(quote.grams)} g`],
        [sliced ? "TIEMPO LAMINADO" : "TIEMPO ESTIMADO", duration(quote.hours)],
        [pieces > 1 ? "PIEZAS" : "TRIÁNGULOS", pieces > 1 ? String(pieces) : triangles.toLocaleString("es-CO")],
      ];

  return (
    <div className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span className="mono label">REVISIÓN AUTOMÁTICA DEL ARCHIVO</span>
        <span className="mono" style={{ padding: "6px 12px", borderRadius: 99, fontSize: 11, letterSpacing: 1, color: v.color, border: `1px solid ${v.color}`, background: `color-mix(in srgb, ${v.color} 8%, transparent)` }}>{v.verdict}</span>
      </div>

      {(info.slicer || info.printer) && <ProjectInfoBox info={info} onApply={fileOptions} />}

      <div className="row" style={{ gap: 10 }}>
        {stats.map(([k, val]) => (
          <div key={k} style={{ flex: "1 1 150px", minWidth: 0, padding: 14, borderRadius: 14, background: "var(--surface-3)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div className="mono label-sm">{k}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 6 }}>{val}</div>
          </div>
        ))}
      </div>

      {multi && (
        <PlateList plates={plates} quote={quote} sliced={sliced} report={report} selected={selected} onSelect={onSelect} from={info.platesFrom} />
      )}
      {!multi && pieces > 1 && <PieceList names={plates[0].plate.objects.map((o) => o.name)} />}

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
          <div className="mono label-sm" style={{ marginBottom: 10 }}>{multi ? "COPIAS DEL PROYECTO" : "CANTIDAD"}</div>
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

function ProjectInfoBox({ info, onApply }: { info: ProjectInfo; onApply?: () => void }) {
  const parts = [
    info.printer && `Impresora: ${info.printer}`,
    info.layerHeight && `Capa ${info.layerHeight} mm`,
    info.infill !== undefined && `Relleno ${info.infill}%`,
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between", padding: 14, marginBottom: 12, borderRadius: 14, background: "var(--ac-tint)", border: "1px solid var(--ac-line)" }}>
      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
        <div className="mono label-sm" style={{ color: "var(--ac)" }}>PROYECTO DE {(info.slicer ?? "SLICER").toUpperCase()}</div>
        <div style={{ fontSize: 14, marginTop: 6, color: "#D8D8D2", lineHeight: 1.5 }}>
          {parts.join(" · ")}
          {info.filaments.length > 0 && (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, marginLeft: parts.length ? 8 : 0, verticalAlign: "middle" }}>
              {info.filaments.map((f, i) => (
                <span key={i} className="mono chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: f.color || "#888", border: "1px solid rgba(255,255,255,.3)" }} />{f.type}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      {onApply && (
        <button onClick={onApply} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ac)", background: "transparent", color: "var(--ac)", fontSize: 12, cursor: "pointer" }}>
          Usar estos ajustes
        </button>
      )}
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
    <div style={{ marginTop: 16 }}>
      <div className="mono label-sm" style={{ marginBottom: 8 }}>
        CAMAS {from === "position" ? "· DETECTADAS POR LA POSICIÓN DE LAS PIEZAS" : "· DEFINIDAS EN EL ARCHIVO"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {plates.map((p, i) => {
          const r = report.plates[i];
          const est = quote.plates[i];
          const on = selected === i;
          const names = summarize(p.plate.objects.map((o) => o.name));
          return (
            <button key={p.plate.id} onClick={() => onSelect(on ? -1 : i)} aria-pressed={on}
              style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", width: "100%", padding: 10, borderRadius: 14, cursor: "pointer", color: "var(--text)", background: on ? "var(--ac-tint)" : "var(--surface-3)", border: `1px solid ${on ? "var(--ac)" : r.fits ? "rgba(255,255,255,.06)" : "var(--bad)"}` }}>
              <span style={{ width: 52, height: 52, flex: "none", borderRadius: 10, overflow: "hidden", background: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.thumbUrl ? <img src={p.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="display" style={{ fontWeight: 700, color: "var(--text-3)" }}>{p.plate.id}</span>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.plate.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: LEVEL[r.verdict].color }}>{r.fits ? `${p.plate.objects.length} ${p.plate.objects.length === 1 ? "PIEZA" : "PIEZAS"}` : "NO CABE"}</span>
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names}</span>
                <span className="mono" style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  {dim(p.metrics)} · {sliced ? "" : "≈ "}{num1(est.grams)} g · {duration(est.hours)}
                  {p.plate.sliced && (p.plate.sliced.grams || p.plate.sliced.seconds) && (
                    <span style={{ color: "var(--ok)" }}>
                      {" "}· EN TU ARCHIVO: {[p.plate.sliced.grams && `${num1(p.plate.sliced.grams)} g`, p.plate.sliced.seconds && duration(p.plate.sliced.seconds / 3600)].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PieceList({ names }: { names: string[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="mono label-sm" style={{ marginBottom: 8 }}>PIEZAS EN LA CAMA</div>
      <div style={{ fontSize: 14, color: "#D8D8D2" }}>{summarize(names)}</div>
    </div>
  );
}

/** "Tapa ×2, Base" */
function summarize(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
}

const qtyBtn = { width: 44, height: 44, border: 0, background: "var(--surface-3)", color: "var(--text)", fontSize: 20, cursor: "pointer" } as const;
