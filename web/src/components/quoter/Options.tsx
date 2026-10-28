"use client";

import { COLORS, MATERIALS, QUALITIES } from "@/lib/catalog";
import { infillPattern } from "../LayerStack";

const Check = () => (
  <span className="choice-check" aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
  </span>
);

/**
 * Archivos de varios colores: imprimir con sus colores (cada cambio de filamento purga material
 * y toma tiempo) o en uno solo, más económico.
 */
export function ColorMode({ colors, filaments, multicolor, onChange }: {
  colors: number;
  filaments: { color: string }[];
  multicolor: boolean;
  onChange: (multi: boolean) => void;
}) {
  const swatches = filaments.map((f) => f.color).filter((c) => /^#[0-9a-f]{6}/i.test(c)).slice(0, colors);
  return (
    <div className="field">
      <div className="field-label">Colores <span className="muted">tu archivo trae {colors}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <button className="choice" aria-pressed={multicolor} onClick={() => onChange(true)}>
          <Check />
          <span style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {(swatches.length ? swatches : ["#E4572E", "#2F6FED", "#F2C94C"]).map((c, i) => (
              <span key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: "1px solid var(--line-3)" }} />
            ))}
          </span>
          <span style={{ fontWeight: 600 }}>Varios colores</span>
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>Como el diseño. Cada cambio de color gasta filamento y tiempo, por eso cuesta más.</span>
        </button>
        <button className="choice" aria-pressed={!multicolor} onClick={() => onChange(false)}>
          <Check />
          <span style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--text-3)", border: "1px solid var(--line-3)" }} />
          </span>
          <span style={{ fontWeight: 600 }}>Un solo color</span>
          <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>Toda la pieza en el color que elijas. Más económico.</span>
        </button>
      </div>
    </div>
  );
}

/** Paso 2: material y color del filamento. */
export function FilamentPicker({ material, color, onMaterial, onColor, showColors = true }: {
  material: number;
  color: number;
  onMaterial: (i: number) => void;
  onColor: (i: number) => void;
  /** En piezas de varios colores no se elige uno. */
  showColors?: boolean;
}) {
  return (
    <>
      <div className="field">
        <div className="field-label">Material</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {MATERIALS.map((m, i) => (
            <button key={m.id} className="choice" aria-pressed={i === material} onClick={() => onMaterial(i)}>
              <Check />
              <span className="display" style={{ fontWeight: 700, fontSize: 18 }}>{m.id}</span>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{m.tag}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, lineHeight: 1.4 }}>Ideal: {m.ideal.toLowerCase()}</span>
            </button>
          ))}
        </div>
      </div>
      {showColors && (
        <div className="field">
          <div className="field-label">
            Color <span className="muted">{COLORS[color].name}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COLORS.map((c, i) => (
              <button key={c.name} className="swatch" aria-pressed={i === color} onClick={() => onColor(i)}>
                <span className="swatch-dot" style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 45%), ${c.render}` }}>
                  {i === color && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={["Blanco", "Amarillo"].includes(c.name) ? "#0B0B0D" : "#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      style={{ position: "absolute", inset: 0, margin: "auto" }} aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                  )}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const QUALITY_TEXT: Record<string, string> = {
  borrador: "Más rápida y económica",
  estandar: "Equilibrio entre detalle y precio",
  detalle: "Superficie más lisa, tarda más",
};

const INFILL_PRESETS = [
  [10, "Ligero", "Decoración"],
  [20, "Estándar", "Uso general"],
  [40, "Resistente", "Piezas funcionales"],
  [100, "Sólido", "Máxima fuerza"],
] as const;

/** Paso 3: calidad de capa, relleno y soportes. */
export function PrintSettings({ quality, infill, supports, showSupports, onQuality, onInfill, onSupports }: {
  quality: number;
  infill: number;
  supports: boolean;
  showSupports: boolean;
  onQuality: (i: number) => void;
  onInfill: (v: number) => void;
  onSupports: (v: boolean) => void;
}) {
  return (
    <>
      <div className="field">
        <div className="field-label">Calidad <span className="muted">qué tan finas son las capas</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {QUALITIES.map((q, i) => {
            const h = Math.max(2, Math.round(16 / q.lines));
            return (
              <button key={q.id} className="choice" aria-pressed={i === quality} onClick={() => onQuality(i)}>
                <Check />
                <span aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 2, width: 34, marginBottom: 8 }}>
                  {Array.from({ length: q.lines }, (_, k) => (
                    <span key={k} style={{ display: "block", height: h, borderRadius: 1, background: i === quality ? "var(--ac)" : "#6A6A70" }} />
                  ))}
                </span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{q.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>{QUALITY_TEXT[q.id]}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>capas de {q.layerMm.toFixed(2)} mm</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <div className="field-label">Relleno <span className="muted">cuánto material va por dentro</span></div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div aria-hidden="true" style={{ width: 64, height: 64, flex: "none", borderRadius: 12, border: "2px solid var(--ac)", background: infillPattern("#FF5A1F", infill) }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {INFILL_PRESETS.map(([v, name, hint]) => (
                <button key={v} className="chip-btn" aria-pressed={infill === v} onClick={() => onInfill(v)} title={hint}>
                  {name} · {v}%
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <input type="range" min={0} max={100} step={5} value={infill} onChange={(e) => onInfill(+e.target.value)} aria-label="Porcentaje de relleno" />
              <span className="mono" style={{ minWidth: 44, textAlign: "right", fontWeight: 600 }}>{infill}%</span>
            </div>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-3)" }}>Más relleno = pieza más fuerte, pero más pesada y costosa.</p>
      </div>

      {showSupports && (
        <div className="field">
          <div className="field-label">Soportes <span className="muted">para partes que quedan en el aire</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([[true, "Automáticos", "Los ponemos donde la pieza los necesite"], [false, "Sin soportes", "La pieza no tiene partes en voladizo"]] as const).map(([v, name, sub]) => (
              <button key={name} className="choice" aria-pressed={supports === v} onClick={() => onSupports(v)}>
                <Check />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
