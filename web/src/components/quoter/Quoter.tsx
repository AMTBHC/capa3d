"use client";

import { useState } from "react";
import { MATERIALS, QUALITIES } from "@/lib/catalog";
import { printer } from "@/lib/config";
import { projectPrintability } from "@/lib/checks";
import { estimateQuote, SAMPLE_MODEL } from "@/lib/pricing";
import type { ProjectInfo } from "@/lib/mesh/project";
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

/** Opciones del cotizador más cercanas a los ajustes guardados en el archivo del slicer. */
function optionsFromFile(info: ProjectInfo): Partial<QuoteOptions> {
  const out: Partial<QuoteOptions> = {};
  if (info.layerHeight) {
    const lh = info.layerHeight;
    out.quality = QUALITIES.reduce((best, q, i) => (Math.abs(q.layerMm - lh) < Math.abs(QUALITIES[best].layerMm - lh) ? i : best), 0);
  }
  if (info.infill !== undefined) out.infill = Math.min(100, Math.max(0, Math.round(info.infill / 5) * 5));
  const type = info.filaments[0]?.type.toUpperCase() ?? "";
  const mat = MATERIALS.findIndex((m) => type.startsWith(m.id));
  if (mat >= 0) out.material = mat;
  return out;
}

export function Quoter() {
  const file = useModelFile();
  const [opts, setOpts] = useState<QuoteOptions>({ material: 0, quality: 1, infill: 20, color: 3 });
  const [unit, setUnit] = useState<FileUnit>("mm");
  const [scale, setScale] = useState(100);
  const [qty, setQty] = useState(1);
  /** Cama que muestra el visor; -1 = todas. */
  const [plate, setPlate] = useState(-1);
  const set = (patch: Partial<QuoteOptions>) => setOpts((o) => ({ ...o, ...patch }));

  // Al cambiar de modelo se reinician unidades, escala, cantidad y cama.
  const [lastModel, setLastModel] = useState(file.model);
  if (lastModel !== file.model) {
    setLastModel(file.model);
    setUnit("mm");
    setScale(100);
    setQty(1);
    setPlate(file.model && file.model.plates.length > 1 ? -1 : 0);
  }

  const model = file.status === "ok" ? file.model : null;
  const k = unitFactor(unit, scale);
  const plates = model?.plates.map((p) => ({ ...p, metrics: scaledMetrics(p.analysis, k) })) ?? [];
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const quote = estimateQuote({
    metrics: plates.length ? plates.map((p) => p.metrics) : SAMPLE_MODEL,
    material,
    flow: quality.flow,
    infill: opts.infill,
    qty: model ? qty : 1,
  });
  const report = model
    ? projectPrintability(plates.map((p) => ({ name: p.plate.name, metrics: p.metrics, openEdges: p.analysis.openEdges })), printer.bed, scale)
    : null;
  const fileOptions = model ? optionsFromFile(model.info) : {};

  return (
    <section id="quote" className="section">
      <SectionHeader
        eyebrow="// COTIZADOR"
        title="Configura tu impresión y mira el resultado"
        lead="Sube tu archivo y míralo en 3D sobre la cama de la impresora, con todas sus camas si es un proyecto. El precio cambia con cada elección: material, calidad de capa, relleno y color."
      />
      <div className="row" style={{ gap: 24, alignItems: "flex-start" }}>
        <PreviewCard
          file={file}
          opts={opts}
          k={k}
          plate={plate}
          onPlate={setPlate}
          fits={report?.plates.map((r) => r.fits) ?? []}
          dims={plates.length ? plates.map((p) => p.metrics) : [SAMPLE_MODEL]}
          quote={quote}
        />
        <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <FileDrop fileName={file.fileName} status={file.status} onFile={file.load} />
          {model && report && (
            <AnalysisPanel
              plates={plates}
              info={model.info}
              quote={quote}
              report={report}
              selected={plate}
              onSelect={setPlate}
              fileOptions={Object.keys(fileOptions).length ? () => set(fileOptions) : undefined}
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
