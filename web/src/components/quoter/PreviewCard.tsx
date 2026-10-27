"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties } from "react";
import { COLORS, MATERIALS, QUALITIES, vase } from "@/lib/catalog";
import { printer, whatsappUrl } from "@/lib/config";
import { duration, money, num1 } from "@/lib/format";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import { BedPlate, LayerStack } from "../LayerStack";
import { Icon, ICONS } from "../Icon";
import type { QuoteOptions } from "./Quoter";
import type { useModelFile } from "./useModelFile";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <Spinner label="CARGANDO VISOR 3D…" />,
});

const sampleProfile = vase(70, 96, 36);

interface Props {
  file: ReturnType<typeof useModelFile>;
  opts: QuoteOptions;
  k: number;
  /** Cama seleccionada; -1 = todas. */
  plate: number;
  onPlate: (i: number) => void;
  /** Si cada cama cabe en la impresora. */
  fits: boolean[];
  /** Medidas reales de cada cama. */
  dims: ModelMetrics[];
  quote: Quote;
}

const dimText = (m: ModelMetrics) => `${num1(m.dx)} × ${num1(m.dy)} × ${num1(m.dz)} mm`;

export function PreviewCard({ file, opts, k, plate, onPlate, fits, dims, quote }: Props) {
  const [wire, setWire] = useState(false);
  const [auto, setAuto] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const color = COLORS[opts.color];
  const model = file.status === "ok" ? file.model : null;
  const plates = model?.plates ?? [];
  const multi = plates.length > 1;
  const pieces = plates.reduce((s, p) => s + p.plate.objects.length, 0);
  const triangles = plates.reduce((s, p) => s + p.analysis.triangles, 0);

  // Modo expandido: Esc cierra y la página no se desplaza por detrás.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);
  // Sin modelo no hay nada que expandir (por ejemplo, al cambiar de archivo).
  const isExpanded = expanded && !!model;

  const grams = num1(quote.grams);
  const hours = duration(quote.hours);
  const msg = [
    "Hola Capa3D, quiero cotizar esta impresión:",
    `• Archivo: ${file.fileName || "(lo envío por aquí)"}`,
    `• Material: ${material.id}, color ${color.name}`,
    `• Calidad: ${quality.name} (${quality.layerMm} mm), relleno ${opts.infill}%`,
    ...(model
      ? [
          multi ? `• Proyecto: ${plates.length} camas, ${pieces} piezas` : `• Tamaño: ${dimText(dims[0])}`,
          `• Cantidad: ${quote.qty}`,
        ]
      : []),
    `• Estimado en la web: $${money(quote.total)} COP`,
  ].join("\n");

  const breakdown = [
    [`Material (${grams} g × $${money(quote.pricePerGram)}/g)`, quote.materialCost],
    [`Tiempo de máquina (${hours}${multi ? ` en ${plates.length} camas` : ""})`, quote.machineCost],
    ["Cargo base", quote.baseFee],
    [`Precio por unidad × ${quote.qty}`, quote.unitPrice],
  ] as const;

  const viewerBox: CSSProperties = isExpanded
    ? { position: "fixed", inset: 0, zIndex: 60, height: "100dvh", background: "radial-gradient(circle at 50% 60%,#1b1b20,#0b0b0d 70%)" }
    : { position: "relative", height: 420, perspective: 1000, background: `radial-gradient(circle at 50% 65%,${color.render}33,transparent 60%)` };

  const label = model
    ? multi
      ? `${plates.length} CAMAS · ${pieces} PIEZAS · ${color.name.toUpperCase()}`
      : `${triangles.toLocaleString("es-CO")} TRIÁNGULOS · ${color.name.toUpperCase()}`
    : `${quality.previewLayers * 10} CAPAS · ${color.name.toUpperCase()}`;

  const sel = plate >= 0 && plate < plates.length ? plate : -1;
  const detail = model
    ? sel >= 0
      ? `${plates[sel].plate.name} · ${plates[sel].plate.objects.length} ${plates[sel].plate.objects.length === 1 ? "pieza" : "piezas"} · ${dimText(dims[sel])}`
      : `${plates.length} camas de ${printer.bed.x} × ${printer.bed.y} mm · ${pieces} piezas`
    : "";

  return (
    <div style={{ flex: "1 1 420px", minWidth: 0, borderRadius: 28, background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden" }}>
      <div style={viewerBox} role={isExpanded ? "dialog" : undefined} aria-modal={isExpanded || undefined} aria-label={isExpanded ? "Visor 3D ampliado" : undefined}>
        {model ? (
          <ModelViewer
            plates={plates.map((p, i) => ({ positions: p.positions, analysis: p.analysis, fits: fits[i] ?? true }))}
            selected={sel}
            k={k}
            color={color.render}
            wire={wire}
            autoRotate={auto}
            layerMm={quality.layerMm}
            bed={printer.bed}
          />
        ) : file.status !== "reading" ? (
          <div aria-hidden="true" className="turnF" style={{ position: "absolute", left: "50%", top: "62%", width: 260, height: 260, margin: "-130px 0 0 -130px" }}>
            <BedPlate />
            <LayerStack layers={quality.previewLayers} size={260} height={150} profile={sampleProfile} color={color.render}
              border={quality.previewBorder} infill={opts.infill} wire={wire} alpha="2e" />
          </div>
        ) : null}
        {file.status === "reading" && <Spinner label="ANALIZANDO MALLA…" />}

        <div style={{ position: "absolute", left: 16, right: 16, top: 16, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, pointerEvents: "auto" }}>
            <button className="pill" aria-pressed={!wire} onClick={() => setWire(false)}>Sólido</button>
            <button className="pill" aria-pressed={wire} onClick={() => setWire(true)}>Malla</button>
            {model && <button className="pill" aria-pressed={auto} onClick={() => setAuto(!auto)}>Girar solo</button>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", pointerEvents: "auto" }}>
            <span className="mono tag">{label}</span>
            {model && (
              <button onClick={() => setExpanded(!isExpanded)} aria-label={isExpanded ? "Cerrar vista ampliada" : "Ampliar visor"} title={isExpanded ? "Cerrar (Esc)" : "Ampliar"} style={iconBtn}>
                <Icon d={isExpanded ? ICONS.close : ICONS.expand} size={18} stroke={2} />
              </button>
            )}
          </div>
        </div>

        {model && (
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, pointerEvents: "none" }}>
            {multi && (
              <div role="tablist" aria-label="Camas" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, pointerEvents: "auto", maxWidth: "100%" }}>
                <button role="tab" aria-selected={sel < 0} className="pill" onClick={() => onPlate(-1)} style={plateTab(sel < 0, true)}>Todas</button>
                {plates.map((p, i) => (
                  <button key={p.plate.id} role="tab" aria-selected={sel === i} className="pill" onClick={() => onPlate(i)}
                    style={plateTab(sel === i, fits[i] !== false)}>
                    {p.plate.name}
                  </button>
                ))}
              </div>
            )}
            <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: "var(--text-3)", textAlign: "center" }}>
              {isExpanded ? `${detail.toUpperCase()} · ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR · ESC PARA CERRAR` : multi ? detail.toUpperCase() : "ARRASTRA PARA GIRAR"}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: 28, borderTop: "1px solid var(--line)" }}>
        <span className="mono label">{model ? (multi ? `PRECIO ESTIMADO DEL PROYECTO · ${plates.length} CAMAS` : "PRECIO ESTIMADO DE TU MODELO") : "ESTIMADO DE EJEMPLO"}</span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, margin: "8px 0 6px" }} aria-live="polite">
          <span className="display" style={{ fontSize: "clamp(38px,5vw,54px)", fontWeight: 700, letterSpacing: -1.5 }}>${money(quote.total)}</span>
          <span className="mono muted">COP</span>
        </div>
        <p style={{ margin: "0 0 18px", color: "var(--text-3)" }}>
          ≈ {hours} de impresión · {grams} g de {material.id}
          {quote.qty > 1 && ` · por unidad · ${quote.qty} unidades`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 20, borderTop: "1px solid var(--line)" }}>
          {breakdown.map(([key, v]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 14 }}>
              <span className="muted">{key}</span><span className="mono">${money(v)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {[material.id, quality.name, `Relleno ${opts.infill}%`, color.name].map((c) => (
            <span key={c} className="mono chip">{c}</span>
          ))}
        </div>
        <a className="btn btn-primary glow" href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", padding: 18, borderRadius: 16 }}>
          Pedir esta impresión por WhatsApp
        </a>
        <p style={{ fontSize: 12, color: "var(--text-4)", margin: "12px 0 0", lineHeight: 1.5 }}>
          {model
            ? "Calculado con el volumen real de tu modelo. Confirmamos el precio final al revisar el archivo."
            : "Estimado de una pieza de ejemplo de 60 × 60 × 90 mm. Sube tu archivo para calcularlo con tu modelo."}
        </p>
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.2)", background: "rgba(11,11,13,.75)",
  color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

/** Pestaña de cama; las que no caben llevan borde rojo. */
const plateTab = (on: boolean, fits: boolean): CSSProperties => ({
  padding: "7px 12px",
  fontSize: 12,
  ...(on ? {} : { background: "rgba(11,11,13,.75)" }),
  ...(fits || on ? {} : { borderColor: "var(--bad)" }),
});

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(11,11,13,.7)" }}>
      <span className="rot" style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--ac)" }} />
      <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}
