"use client";

import { COLORS, MATERIALS, METER_LABELS, QUALITIES } from "@/lib/catalog";
import { infillPattern } from "../LayerStack";

interface PickerProps {
  value: number;
  onChange: (v: number) => void;
}

export function MaterialPicker({ value, onChange }: PickerProps) {
  return (
    <div className="card">
      <div className="mono label" style={{ marginBottom: 16 }}>02 / MATERIAL</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {MATERIALS.map((m, i) => {
          const on = i === value;
          return (
            <button key={m.id} className="option" aria-pressed={on} onClick={() => onChange(i)}
              style={{ padding: 18, borderRadius: 18, boxShadow: on ? "0 0 30px #FF5A1F33" : "none", transform: on ? "translateY(-3px)" : "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>{m.id}</span>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${on ? "var(--ac)" : "rgba(255,255,255,.3)"}`, background: on ? "var(--ac)" : "transparent", boxShadow: on ? "0 0 12px var(--ac)" : "none" }} />
              </span>
              <span style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 14px" }}>{m.tag}</span>
              {m.meters.map((v, j) => (
                <span key={j} style={{ width: "100%" }}>
                  <span className="mono label-sm" style={{ display: "block", marginTop: 6 }}>{METER_LABELS[j]}</span>
                  <span style={{ display: "flex", gap: 3, width: "100%", marginTop: 4 }} aria-label={`${METER_LABELS[j]} ${v} de 5`}>
                    {[0, 1, 2, 3, 4].map((s) => (
                      <span key={s} style={{ flex: 1, height: 6, borderRadius: 2, background: s < v ? (on ? "var(--ac)" : "var(--text-2)") : "rgba(255,255,255,.1)" }} />
                    ))}
                  </span>
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function QualityPicker({ value, onChange }: PickerProps) {
  return (
    <div className="card" style={{ flex: "1 1 280px" }}>
      <div className="mono label" style={{ marginBottom: 16 }}>03 / CALIDAD DE CAPA</div>
      <div style={{ display: "flex", gap: 10 }}>
        {QUALITIES.map((q, i) => {
          const on = i === value;
          const h = Math.max(2, Math.round(18 / q.lines));
          return (
            <button key={q.name} className="option" aria-pressed={on} onClick={() => onChange(i)} style={{ flex: 1, padding: 14, borderRadius: 16 }}>
              <span aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 3, width: 40, marginBottom: 10 }}>
                {Array.from({ length: q.lines }, (_, k) => (
                  <span key={k} style={{ display: "block", height: h, borderRadius: 1, background: on ? "var(--ac)" : "#6A6A70" }} />
                ))}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{q.name}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{q.layerMm.toFixed(2)} mm</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InfillPicker({ value, onChange }: PickerProps) {
  return (
    <div className="card" style={{ flex: "1 1 220px" }}>
      <div className="mono label" style={{ marginBottom: 12 }}>04 / RELLENO</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div aria-hidden="true" style={{ width: 68, height: 68, flex: "none", borderRadius: 12, border: "2px solid var(--ac)", background: infillPattern("#FF5A1F", value) }} />
        <span className="display" style={{ fontSize: 34, fontWeight: 700 }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(+e.target.value)} aria-label="Densidad de relleno" style={{ marginTop: 16 }} />
    </div>
  );
}

export function ColorPicker({ value, onChange }: PickerProps) {
  return (
    <div className="card">
      <div className="mono label" style={{ marginBottom: 16 }}>05 / COLOR DEL FILAMENTO · {COLORS[value].name}</div>
      <div className="row" style={{ gap: 14 }}>
        {COLORS.map((c, i) => {
          const on = i === value;
          return (
            <button key={c.name} aria-label={c.name} aria-pressed={on} onClick={() => onChange(i)}
              style={{
                width: 52, height: 52, borderRadius: "50%", cursor: "pointer", padding: 0, transition: "transform .2s",
                background: `radial-gradient(circle,#0B0B0D 0 18%,#2A2A30 19% 24%,transparent 25%),repeating-radial-gradient(circle,${c.spool} 0 2px,${c.render}cc 2px 3px)`,
                border: on ? "3px solid var(--ac)" : "1px solid rgba(255,255,255,.18)",
                boxShadow: on ? `0 0 0 4px #0B0B0D,0 0 22px ${c.render}99` : "none",
                transform: on ? "scale(1.08)" : "none",
              }} />
          );
        })}
      </div>
    </div>
  );
}

export function SupportsPicker({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const opts = [
    [true, "Automáticos", "Donde la pieza los necesite"],
    [false, "Sin soportes", "La pieza no tiene voladizos"],
  ] as const;
  return (
    <div className="card">
      <div className="mono label" style={{ marginBottom: 16 }}>06 / SOPORTES</div>
      <div style={{ display: "flex", gap: 10 }}>
        {opts.map(([v, name, sub]) => (
          <button key={name} className="option" aria-pressed={value === v} onClick={() => onChange(v)} style={{ flex: 1, padding: 14, borderRadius: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
            <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
