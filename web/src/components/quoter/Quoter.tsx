"use client";

import { useState } from "react";
import { MATERIALS, QUALITIES } from "@/lib/catalog";
import { printer } from "@/lib/config";
import { printability } from "@/lib/checks";
import { estimateQuote, SAMPLE_MODEL } from "@/lib/pricing";
import { scaledMetrics, unitFactor, type FileUnit } from "@/lib/units";
import { SectionHeader } from "../SectionHeader";
import { useModelFile } from "./useModelFile";
import { PreviewCard } from "./PreviewCard";
import { FileDrop } from "./FileDrop";
import { AnalysisPanel } from "./AnalysisPanel";
import { ColorPicker, InfillPicker, MaterialPicker, QualityPicker } from "./Options";

export interface QuoteOptions {
  material: number;
  quality: number;
  infill: number;
  color: number;
}

export function Quoter() {
  const file = useModelFile();
  const [opts, setOpts] = useState<QuoteOptions>({ material: 0, quality: 1, infill: 20, color: 3 });
  const [unit, setUnit] = useState<FileUnit>("mm");
  const [scale, setScale] = useState(100);
  const [qty, setQty] = useState(1);
  const set = (patch: Partial<QuoteOptions>) => setOpts((o) => ({ ...o, ...patch }));

  // Al cambiar de archivo se reinician unidades, escala y cantidad.
  const [lastFile, setLastFile] = useState(file.fileName);
  if (lastFile !== file.fileName) {
    setLastFile(file.fileName);
    setUnit("mm");
    setScale(100);
    setQty(1);
  }

  const analysis = file.status === "ok" ? file.model?.analysis ?? null : null;
  const k = unitFactor(unit, scale);
  const metrics = analysis ? scaledMetrics(analysis, k) : SAMPLE_MODEL;
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const quote = estimateQuote({ metrics, material, flow: quality.flow, infill: opts.infill, qty: analysis ? qty : 1 });
  const report = analysis ? printability(metrics, analysis.openEdges, printer.bed, scale) : null;

  return (
    <section id="quote" className="section">
      <SectionHeader
        eyebrow="// COTIZADOR"
        title="Configura tu impresión y mira el resultado"
        lead="Sube tu archivo y míralo en 3D sobre la cama de la impresora. El precio cambia con cada elección: material, calidad de capa, relleno y color."
      />
      <div className="row" style={{ gap: 24, alignItems: "flex-start" }}>
        <PreviewCard
          file={file}
          opts={opts}
          k={k}
          metrics={metrics}
          quote={quote}
          fits={report?.fits ?? true}
        />
        <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <FileDrop fileName={file.fileName} status={file.status} onFile={file.load} />
          {analysis && report && (
            <AnalysisPanel
              analysis={analysis}
              metrics={metrics}
              quote={quote}
              report={report}
              unit={unit}
              onUnit={setUnit}
              scale={scale}
              onScale={setScale}
              qty={qty}
              onQty={(q) => setQty(Math.min(printer.maxQty, Math.max(1, q)))}
            />
          )}
          <MaterialPicker value={opts.material} onChange={(material) => set({ material })} />
          <div className="row" style={{ gap: 18 }}>
            <QualityPicker value={opts.quality} onChange={(quality) => set({ quality })} />
            <InfillPicker value={opts.infill} onChange={(infill) => set({ infill })} />
          </div>
          <ColorPicker value={opts.color} onChange={(color) => set({ color })} />
        </div>
      </div>
    </section>
  );
}

