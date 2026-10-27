"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties } from "react";
import { COLORS, QUALITIES, vase } from "@/lib/catalog";
import type { Bed } from "@/lib/checks";
import { num1 } from "@/lib/format";
import type { ModelMetrics } from "@/lib/pricing";
import { BedPlate, LayerStack } from "../LayerStack";
import { Icon, ICONS } from "../Icon";
import type { QuoteOptions } from "./Quoter";
import type { LoadedModel, FileStatus } from "./useModelFile";
import { FILE_INPUT_ID } from "./FileDrop";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <Overlay title="Cargando el visor 3D…" />,
});

const sampleProfile = vase(70, 96, 36);

interface Props {
  status: FileStatus;
  model: LoadedModel | null;
  opts: QuoteOptions;
  k: number;
  /** Cama seleccionada; -1 = todas. */
  plate: number;
  onPlate: (i: number) => void;
  fits: boolean[];
  dims: ModelMetrics[];
  bed: Bed;
}

const dimText = (m: ModelMetrics) => `${num1(m.dx)} × ${num1(m.dy)} × ${num1(m.dz)} mm`;

/** Visor 3D del modelo del cliente, con modo ampliado a pantalla completa. */
export function ViewerCard({ status, model, opts, k, plate, onPlate, fits, dims, bed }: Props) {
  const [wire, setWire] = useState(false);
  const [auto, setAuto] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const quality = QUALITIES[opts.quality];
  const color = COLORS[opts.color];
  const plates = model?.plates ?? [];
  const multi = plates.length > 1;
  const pieces = plates.reduce((s, p) => s + p.plate.objects.length, 0);
  const isExpanded = expanded && !!model;

  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isExpanded]);

  const sel = plate >= 0 && plate < plates.length ? plate : -1;
  const caption = model
    ? sel >= 0
      ? `${plates[sel].plate.name} · ${dimText(dims[sel])}`
      : multi
        ? `${plates.length} camas · ${pieces} piezas`
        : dimText(dims[0])
    : "";

  const box: CSSProperties = isExpanded
    ? { position: "fixed", inset: 0, zIndex: 60, background: "radial-gradient(circle at 50% 60%,#1b1b20,#0b0b0d 70%)" }
    : { position: "relative", perspective: 1000, background: `radial-gradient(circle at 50% 65%,${color.render}33,transparent 60%)` };

  return (
    <div className="quote-viewer-card" style={{ borderRadius: 24, background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden" }}>
      <div className={isExpanded ? undefined : "quote-viewer"} style={box}
        role={isExpanded ? "dialog" : undefined} aria-modal={isExpanded || undefined} aria-label={isExpanded ? "Visor 3D ampliado" : undefined}>
        {model ? (
          <ModelViewer
            plates={plates.map((p, i) => ({ positions: p.positions, analysis: p.analysis, fits: fits[i] ?? true }))}
            selected={sel}
            k={k}
            color={color.render}
            wire={wire}
            autoRotate={auto}
            layerMm={quality.layerMm}
            bed={bed}
          />
        ) : status !== "reading" ? (
          <>
            <div aria-hidden="true" className="turnF" style={{ position: "absolute", left: "50%", top: "52%", width: 220, height: 220, margin: "-110px 0 0 -110px", opacity: 0.85 }}>
              <BedPlate />
              <LayerStack layers={quality.previewLayers} size={220} height={120} profile={(u) => sampleProfile(u) * 0.85}
                color={color.render} border={quality.previewBorder} infill={opts.infill} wire={wire} alpha="2e" />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <label htmlFor={FILE_INPUT_ID} className="btn btn-primary glow" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 14 }}>
                <Icon d={ICONS.upload} size={18} stroke={2} />Sube tu modelo para verlo aquí
              </label>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Vista de ejemplo · cambia con el color, la calidad y el relleno</span>
            </div>
          </>
        ) : null}
        {status === "reading" && <Overlay title="Analizando tu modelo…" sub="Medimos el tamaño, el volumen y si se puede imprimir" />}

        {model && (
          <>
            <div style={{ position: "absolute", left: 12, right: 12, top: 12, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
              <div role="group" aria-label="Vista" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(11,11,13,.75)", border: "1px solid rgba(255,255,255,.1)", pointerEvents: "auto" }}>
                <ToolBtn on={!wire} onClick={() => setWire(false)} label="Sólido" />
                <ToolBtn on={wire} onClick={() => setWire(true)} label="Malla" />
                <ToolBtn on={auto} onClick={() => setAuto(!auto)} label="Girar" />
              </div>
              <button onClick={() => setExpanded(!isExpanded)} aria-label={isExpanded ? "Cerrar vista ampliada" : "Ampliar visor"} title={isExpanded ? "Cerrar (Esc)" : "Ampliar"} style={iconBtn}>
                <Icon d={isExpanded ? ICONS.close : ICONS.expand} size={18} stroke={2} />
              </button>
            </div>
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
              {multi && (
                <div role="tablist" aria-label="Camas" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, pointerEvents: "auto" }}>
                  <button role="tab" aria-selected={sel < 0} className="pill" onClick={() => onPlate(-1)} style={plateTab(sel < 0, true)}>Todas</button>
                  {plates.map((p, i) => (
                    <button key={p.plate.id} role="tab" aria-selected={sel === i} className="pill" onClick={() => onPlate(i)} style={plateTab(sel === i, fits[i] !== false)}>
                      {p.plate.name}
                    </button>
                  ))}
                </div>
              )}
              <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: "var(--text-3)", textAlign: "center", padding: "4px 10px", borderRadius: 8, background: "rgba(11,11,13,.6)" }}>
                {caption.toUpperCase()}{isExpanded ? " · ESC PARA CERRAR" : " · ARRASTRA PARA GIRAR"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button aria-pressed={on} onClick={onClick}
      style={{ padding: "7px 12px", borderRadius: 10, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 500, color: on ? "var(--bg)" : "var(--text-2)", background: on ? "var(--ac)" : "transparent" }}>
      {label}
    </button>
  );
}

function Overlay({ title, sub }: { title: string; sub?: string }) {
  return (
    <div role="status" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(11,11,13,.75)", textAlign: "center", padding: 20 }}>
      <span className="rot" style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--ac)" }} />
      <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
      {sub && <span style={{ fontSize: 13, color: "var(--text-3)" }}>{sub}</span>}
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", background: "rgba(11,11,13,.75)",
  color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto",
};

/** Pestaña de cama; las que no caben llevan borde rojo. */
const plateTab = (on: boolean, fits: boolean): CSSProperties => ({
  padding: "6px 12px",
  fontSize: 12,
  ...(on ? {} : { background: "rgba(11,11,13,.75)" }),
  ...(fits || on ? {} : { borderColor: "var(--bad)" }),
});
