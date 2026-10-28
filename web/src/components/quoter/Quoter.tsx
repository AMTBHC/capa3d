"use client";

import { useState } from "react";
import { MATERIALS, QUALITIES } from "@/lib/catalog";
import { printer } from "@/lib/config";
import { projectPrintability } from "@/lib/checks";
import { estimateQuote, SAMPLE_MODEL, type Quote } from "@/lib/pricing";
import type { QuoteParams, ServerQuote } from "@/lib/api";
import type { ProjectInfo } from "@/lib/mesh/project";
import { scaledMetrics, unitFactor, type FileUnit } from "@/lib/units";
import { SectionHeader } from "../SectionHeader";
import { useModelFile } from "./useModelFile";
import { FileDrop } from "./FileDrop";
import { AnalysisPanel } from "./AnalysisPanel";
import { ColorMode, FilamentPicker, PrintSettings } from "./Options";
import { ViewerCard } from "./ViewerCard";
import { PriceCard, priceStage } from "./PriceCard";
import { MobilePriceBar } from "./MobilePriceBar";
import { StepCard } from "./StepCard";
import { useCatalog, useServerQuote } from "./useServer";

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

/** El precio laminado del servidor con la misma forma que el estimado local. */
function fromServer(q: ServerQuote, plateIds: number[]): Quote | null {
  const p = q.price;
  if (!p) return null;
  return {
    plates: plateIds.map((id, i) => q.plates.find((x) => x.id === id) ?? q.plates[i] ?? { grams: 0, hours: 0 }),
    grams: p.grams,
    hours: p.hours,
    pricePerGram: p.price_per_gram,
    materialCost: p.material_cost,
    machineCost: p.machine_cost,
    baseFee: p.base_fee,
    unitPrice: p.unit_price,
    qty: p.qty,
    total: p.total,
    colorChanges: p.color_changes ?? 0,
    purgeGrams: p.purge_grams ?? 0,
  };
}

export function Quoter() {
  const catalog = useCatalog();
  const file = useModelFile(catalog.bed);
  const [opts, setOpts] = useState<QuoteOptions>({ material: 0, quality: 1, infill: 20, color: 3 });
  const [unit, setUnit] = useState<FileUnit>("mm");
  const [scale, setScale] = useState(100);
  const [qty, setQty] = useState(1);
  /** Cama que muestra el visor; -1 = todas. */
  const [plate, setPlate] = useState(-1);
  const [supports, setSupports] = useState(true);
  const [multicolor, setMulticolor] = useState(true);
  const set = (patch: Partial<QuoteOptions>) => setOpts((o) => ({ ...o, ...patch }));

  // Al cambiar de modelo se reinician unidades, escala, cantidad y cama.
  const [lastModel, setLastModel] = useState(file.model);
  if (lastModel !== file.model) {
    setLastModel(file.model);
    setUnit("mm");
    setScale(100);
    setQty(1);
    setPlate(file.model && file.model.plates.length > 1 ? -1 : 0);
    setMulticolor(true);
  }

  const model = file.status === "ok" ? file.model : null;
  const k = unitFactor(unit, scale);
  const plates = model?.plates.map((p) => ({ ...p, metrics: scaledMetrics(p.analysis, k) })) ?? [];
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const estimate = estimateQuote({
    metrics: plates.length ? plates.map((p) => p.metrics) : SAMPLE_MODEL,
    material,
    flow: quality.flow,
    infill: opts.infill,
    qty: model ? qty : 1,
    rates: catalog.rates,
  });
  const report = model
    ? projectPrintability(plates.map((p) => ({ name: p.plate.name, metrics: p.metrics, openEdges: p.analysis.openEdges })), catalog.bed, scale)
    : null;

  // Colores del archivo, según el servidor (Bambu/Orca/Prusa guardan el filamento de cada parte).
  const fileColors = Math.max(1, ...(file.upload.file?.plates.map((p) => p.colors ?? 1) ?? []));
  const colors = fileColors > 1 && multicolor ? fileColors : 1;

  // Precio laminado en el servidor, cuando hay API y el modelo cabe.
  const params: QuoteParams | null =
    model && report?.fits
      ? { material: material.id, quality: quality.id, infill: opts.infill, qty, unit, scale, supports, multicolor }
      : null;
  const server = useServerQuote(file.upload.file?.id, params);
  const quote = (server.status === "done" && fromServer(server.quote, plates.map((p) => p.plate.id))) || estimate;
  const fileOptions = model ? optionsFromFile(model.info) : {};

  const stage = priceStage(model, file.upload.status, server, report?.fits ?? true);
  const dims = plates.length ? plates.map((p) => p.metrics) : [SAMPLE_MODEL];
  const onQty = (q: number) => setQty(Math.min(printer.maxQty, Math.max(1, q)));

  return (
    <section id="quote" className="section">
      <SectionHeader
        eyebrow="// COTIZADOR"
        title="Cotiza tu impresión en 3 pasos"
        lead="Sube tu archivo, elige el filamento y ajusta la impresión. Ves tu pieza en 3D y el precio exacto en segundos."
      />
      <div className="quote-grid">
        <aside className="quote-aside">
          <ViewerCard
            status={file.status}
            model={model}
            opts={opts}
            k={k}
            plate={plate}
            onPlate={setPlate}
            fits={report?.plates.map((r) => r.fits) ?? []}
            dims={dims}
            bed={catalog.bed}
          />
          <PriceCard
            fileName={file.fileName}
            model={model}
            opts={opts}
            supports={supports}
            dims={dims}
            quote={quote}
            server={server}
            stage={stage}
            qty={qty}
            onQty={onQty}
            shipping={catalog.shipping}
            colors={colors}
            fileFilaments={model?.info.filaments ?? []}
          />
        </aside>

        <div className="quote-steps">
          <StepCard id="paso-archivo" n={1} title="Sube tu modelo" sub="Lo revisamos al instante y lo ves en 3D." done={!!model}>
            <FileDrop fileName={file.fileName} status={file.status} upload={file.upload} onFile={file.load} />
            {model && report && (
              <AnalysisPanel
                plates={plates}
                info={model.info}
                quote={quote}
                sliced={stage === "exact"}
                report={report}
                selected={plate}
                onSelect={setPlate}
                fileOptions={Object.keys(fileOptions).length ? () => set(fileOptions) : undefined}
                unit={unit}
                onUnit={setUnit}
                scale={scale}
                onScale={setScale}
              />
            )}
          </StepCard>

          <StepCard id="paso-filamento" n={2} title="Elige el filamento" sub="El material define la resistencia; el color lo ves en el visor.">
            {fileColors > 1 && (
              <ColorMode colors={fileColors} filaments={model?.info.filaments ?? []} multicolor={multicolor} onChange={setMulticolor} />
            )}
            <FilamentPicker
              material={opts.material}
              color={opts.color}
              onMaterial={(material) => set({ material })}
              onColor={(color) => set({ color })}
              showColors={colors === 1}
            />
          </StepCard>

          <StepCard id="paso-ajustes" n={3} title="Ajusta la impresión" sub="Si no sabes qué elegir, deja los valores recomendados.">
            <PrintSettings
              quality={opts.quality}
              infill={opts.infill}
              supports={supports}
              showSupports={catalog.slicing}
              onQuality={(quality) => set({ quality })}
              onInfill={(infill) => set({ infill })}
              onSupports={setSupports}
            />
          </StepCard>
        </div>
      </div>
      <MobilePriceBar total={quote.total} stage={stage} />
    </section>
  );
}
