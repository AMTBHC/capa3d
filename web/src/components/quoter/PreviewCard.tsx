"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { COLORS, MATERIALS, QUALITIES, vase } from "@/lib/catalog";
import { printer, whatsappUrl } from "@/lib/config";
import { duration, money, num1 } from "@/lib/format";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import { BedPlate, LayerStack } from "../LayerStack";
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
  metrics: ModelMetrics;
  quote: Quote;
  fits: boolean;
}

export function PreviewCard({ file, opts, k, metrics, quote, fits }: Props) {
  const [wire, setWire] = useState(false);
  const [auto, setAuto] = useState(true);
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const color = COLORS[opts.color];
  const model = file.status === "ok" ? file.model : null;

  const grams = num1(quote.grams);
  const hours = duration(quote.hours);
  const dims = `${num1(metrics.dx)} × ${num1(metrics.dy)} × ${num1(metrics.dz)} mm`;
  const msg = [
    "Hola Capa3D, quiero cotizar esta impresión:",
    `• Archivo: ${file.fileName || "(lo envío por aquí)"}`,
    `• Material: ${material.id}, color ${color.name}`,
    `• Calidad: ${quality.name} (${quality.layerMm} mm), relleno ${opts.infill}%`,
    ...(model ? [`• Tamaño: ${dims}`, `• Cantidad: ${quote.qty}`] : []),
    `• Estimado en la web: $${money(quote.total)} COP`,
  ].join("\n");

  const breakdown = [
    [`Material (${grams} g × $${money(quote.pricePerGram)}/g)`, quote.materialCost],
    [`Tiempo de máquina (${hours})`, quote.machineCost],
    ["Cargo base", quote.baseFee],
    [`Precio por unidad × ${quote.qty}`, quote.unitPrice],
  ] as const;

  return (
    <div style={{ flex: "1 1 420px", minWidth: 0, borderRadius: 28, background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden" }}>
      <div style={{ position: "relative", height: 420, perspective: 1000, background: `radial-gradient(circle at 50% 65%,${color.render}33,transparent 60%)` }}>
        {model ? (
          <>
            <ModelViewer
              positions={model.positions}
              analysis={model.analysis}
              k={k}
              color={color.render}
              wire={wire}
              autoRotate={auto}
              layerMm={quality.layerMm}
              bed={printer.bed}
              fits={fits}
            />
            <span className="mono" style={{ position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)", fontSize: 11, letterSpacing: 1, color: "var(--text-3)", pointerEvents: "none", whiteSpace: "nowrap" }}>
              ARRASTRA PARA GIRAR
            </span>
          </>
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
          <span className="mono tag">
            {model
              ? `${model.analysis.triangles.toLocaleString("es-CO")} TRIÁNGULOS · ${color.name.toUpperCase()}`
              : `${quality.previewLayers * 10} CAPAS · ${color.name.toUpperCase()}`}
          </span>
        </div>
      </div>

      <div style={{ padding: 28, borderTop: "1px solid var(--line)" }}>
        <span className="mono label">{model ? "PRECIO ESTIMADO DE TU MODELO" : "ESTIMADO DE EJEMPLO"}</span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, margin: "8px 0 6px" }} aria-live="polite">
          <span className="display" style={{ fontSize: "clamp(38px,5vw,54px)", fontWeight: 700, letterSpacing: -1.5 }}>${money(quote.total)}</span>
          <span className="mono muted">COP</span>
        </div>
        <p style={{ margin: "0 0 18px", color: "var(--text-3)" }}>
          ≈ {hours} de impresión · {grams} g de {material.id}
          {quote.qty > 1 && ` · por unidad · ${quote.qty} unidades`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 20, borderTop: "1px solid var(--line)" }}>
          {breakdown.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 14 }}>
              <span className="muted">{k}</span><span className="mono">${money(v)}</span>
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

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(11,11,13,.7)" }}>
      <span className="rot" style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--ac)" }} />
      <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}
