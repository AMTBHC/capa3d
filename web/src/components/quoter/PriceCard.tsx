"use client";

import { COLORS, MATERIALS, QUALITIES } from "@/lib/catalog";
import { API_URL, printer, whatsappUrl } from "@/lib/config";
import { markRequested, type Shipping } from "@/lib/api";
import { useCallback, useState } from "react";
import { OrderDialog } from "./OrderDialog";
import { duration, money, num1 } from "@/lib/format";
import type { ModelMetrics, Quote } from "@/lib/pricing";
import { Icon, ICONS } from "../Icon";
import type { QuoteOptions } from "./Quoter";
import type { LoadedModel, UploadStatus } from "./useModelFile";
import type { ServerQuoteState } from "./useServer";

export type PriceStage = "example" | "estimate" | "uploading" | "slicing" | "exact" | "failed" | "nofit" | "review";

/** En qué punto está el precio que ve el cliente. */
export function priceStage(model: LoadedModel | null, upload: UploadStatus, server: ServerQuoteState, fits: boolean, review: string | null): PriceStage {
  if (!model) return "example";
  if (review) return "review";
  if (!API_URL) return "estimate";
  if (!fits) return "nofit";
  if (upload === "uploading") return "uploading";
  if (upload === "error") return "failed";
  if (server.status === "pending") return "slicing";
  if (server.status === "failed") return "failed";
  if (server.status === "done") return server.quote.method === "estimate" ? "estimate" : "exact";
  return "slicing";
}

interface Props {
  fileName: string;
  model: LoadedModel | null;
  opts: QuoteOptions;
  supports: boolean;
  dims: ModelMetrics[];
  quote: Quote;
  server: ServerQuoteState;
  stage: PriceStage;
  qty: number;
  onQty: (q: number) => void;
  shipping: Shipping | null;
  /** Colores con que se imprime (más de 1 = como el archivo, con cambios de filamento). */
  colors: number;
  fileFilaments: { color: string }[];
  /** Muy grande para dar precio en línea: el motivo. */
  review: string | null;
}

export function PriceCard({ fileName, model, opts, supports, dims, quote, server, stage, qty, onQty, shipping, colors, fileFilaments, review }: Props) {
  const [ordering, setOrdering] = useState(false);
  const closeOrder = useCallback(() => setOrdering(false), []);
  const material = MATERIALS[opts.material];
  const quality = QUALITIES[opts.quality];
  const color = COLORS[opts.color];
  const plates = model?.plates ?? [];
  const multi = plates.length > 1;
  const pieces = plates.reduce((s, p) => s + p.plate.objects.length, 0);
  const exact = stage === "exact";
  const busy = stage === "uploading" || stage === "slicing";
  const quoteId = server.status === "done" ? server.quote.id : null;
  const multicolor = colors > 1;
  const colorName = multicolor ? `Multicolor (${colors} colores, como el archivo)` : color.name;
  const swatches = multicolor ? fileFilaments.map((f) => f.color).filter((c) => /^#[0-9a-f]{6}/i.test(c)).slice(0, colors) : [color.render];

  const msg = [
    "Hola Capa3D, quiero cotizar esta impresión:",
    quoteId
      ? `• Ya subí el archivo en la web: ${fileName} (cotización ${quoteId})`
      : `• Archivo: ${fileName || "(lo envío por aquí)"}`,
    `• Filamento: ${material.id} ${colorName}`,
    `• Calidad: ${quality.name} (${quality.layerMm} mm), relleno ${opts.infill}%${supports ? ", con soportes" : ""}`,
    ...(model
      ? [multi ? `• Proyecto: ${plates.length} camas, ${pieces} piezas` : `• Tamaño: ${num1(dims[0].dx)} × ${num1(dims[0].dy)} × ${num1(dims[0].dz)} mm`, `• Cantidad: ${quote.qty}`]
      : []),
    quoteId ? `• Cotización ${quoteId}: $${money(quote.total)} COP` : `• Estimado en la web: $${money(quote.total)} COP`,
  ].join("\n");

  if (stage === "review" && review) {
    const text = [
      "Hola Capa3D, quiero cotizar un archivo grande:",
      `• Archivo: ${fileName}${quoteId ? ` (cotización ${quoteId})` : ""}`,
      `• En la web dice que ${review}`,
      `• Filamento: ${material.id} ${colorName} · ${quality.name} · relleno ${opts.infill}%`,
      `• Cantidad: ${qty}`,
    ].join("\n");
    return (
      <div id="precio" className="quote-price" style={{ borderRadius: 24, background: "var(--surface)", border: "1px solid var(--line)", padding: 20, scrollMarginTop: 16 }}>
        <div className="status status-warn" role="alert">
          <span style={{ ...badge, background: "var(--warn)" }}>!</span>
          <span>
            <strong>Este archivo lo cotizamos por WhatsApp.</strong> Es muy grande para darte el precio en línea: {review}.
            <span style={{ display: "block", color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>
              Ya recibimos tu archivo. Escríbenos y te enviamos el precio revisado por una persona.
            </span>
          </span>
        </div>
        <a className="btn btn-primary" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer"
          onClick={() => quoteId && markRequested(quoteId, colorName)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, padding: 15, borderRadius: 16, fontSize: 16 }}>
          <Icon d={ICONS.chat} size={20} stroke={2} />
          Cotizar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div id="precio" className="quote-price" style={{ borderRadius: 24, background: "var(--surface)", border: "1px solid var(--line)", padding: 20, scrollMarginTop: 16 }}>
      <StageBanner stage={stage} server={server} />

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>
          {!model ? "Precio de ejemplo" : exact ? "Precio total" : "Precio estimado"}
          {quote.qty > 1 && ` · ${quote.qty} ${multi ? "copias" : "unidades"}`}
        </div>
        <div aria-live="polite" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginTop: 2 }}>
          <span key={`${exact}-${quote.total}`} className={`display ${exact ? "pop" : ""}`}
            style={{ fontSize: "clamp(36px,4.6vw,50px)", fontWeight: 700, letterSpacing: -1.5, opacity: busy ? 0.5 : 1, transition: "opacity .3s" }}>
            {exact ? "" : "≈ "}${money(quote.total)}
          </span>
          <span className="mono muted">COP</span>
        </div>
        <div style={{ color: "var(--text-3)", fontSize: 14, marginTop: 4 }}>
          {exact ? "" : "≈ "}{duration(quote.hours)} de impresión · {num1(quote.grams)} g de filamento
          {quote.qty > 1 && <> · ${money(quote.unitPrice)} c/u</>}
        </div>
      </div>

      {model && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, padding: "6px 6px 6px 14px", borderRadius: 14, background: "var(--surface-3)" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{multi ? "Copias del proyecto" : "Cantidad"}</span>
          <div style={{ display: "flex", alignItems: "center", borderRadius: 12, border: "1px solid var(--line-2)", overflow: "hidden" }}>
            <button onClick={() => onQty(qty - 1)} disabled={qty <= 1} aria-label="Quitar una unidad" style={qtyBtn}>−</button>
            <span className="mono" style={{ minWidth: 42, textAlign: "center", fontSize: 16 }}>{qty}</span>
            <button onClick={() => onQty(qty + 1)} disabled={qty >= printer.maxQty} aria-label="Agregar una unidad" style={qtyBtn}>+</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
        <a href="#paso-filamento" className="chip" style={chipLink}>
          <span style={{ display: "flex" }}>
            {swatches.map((c, i) => <span key={i} style={{ width: 12, height: 12, marginLeft: i ? -4 : 0, borderRadius: "50%", background: c, border: "1px solid var(--line-3)" }} />)}
          </span>
          {material.id} {multicolor ? `${colors} colores` : color.name}
        </a>
        <a href="#paso-ajustes" className="chip" style={chipLink}>{quality.name}</a>
        <a href="#paso-ajustes" className="chip" style={chipLink}>Relleno {opts.infill}%</a>
        {API_URL && <a href="#paso-ajustes" className="chip" style={chipLink}>{supports ? "Con soportes" : "Sin soportes"}</a>}
      </div>

      <details className="more" style={{ marginTop: 12 }}>
        <summary>Ver cómo se calcula</summary>
        <div style={{ marginTop: 10, borderTop: "1px solid var(--line)" }}>
          {[
            [`Filamento: ${num1(quote.grams)} g × $${money(quote.pricePerGram)}/g`, quote.materialCost],
            [`Tiempo de máquina: ${duration(quote.hours)}${multi ? ` en ${plates.length} camas` : ""}`, quote.machineCost],
            ["Preparación y revisión", quote.baseFee],
            [`Precio por unidad${quote.qty > 1 ? ` × ${quote.qty}` : ""}`, quote.unitPrice],
          ].map(([k, v]) => (
            <div key={k as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span className="muted">{k}</span><span className="mono">${money(v as number)}</span>
            </div>
          ))}
          {!!quote.colorChanges && (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Incluye {quote.colorChanges} cambios de color: {num1(quote.purgeGrams ?? 0)} g de filamento que se purga en cada cambio y el tiempo de la impresora para hacerlos.
            </p>
          )}
        </div>
      </details>

      {quoteId ? (
        <>
          <button className="btn btn-primary glow" onClick={() => setOrdering(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", marginTop: 16, padding: 15, borderRadius: 16, fontSize: 16 }}>
            <Icon d={ICONS.box} size={20} stroke={2} />
            Hacer pedido
          </button>
          <p style={{ fontSize: 12, color: "var(--text-4)", margin: "8px 0 0", textAlign: "center" }}>
            No pagas nada todavía: primero revisamos tu archivo.
          </p>
          <a className="btn btn-ghost" href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer"
            onClick={() => markRequested(quoteId, colorName)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, padding: 12, borderRadius: 14, fontSize: 14 }}>
            <Icon d={ICONS.chat} size={18} stroke={2} />
            Preguntar por WhatsApp
          </a>
        </>
      ) : (
        <>
          <a className="btn btn-primary glow" href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16, padding: 15, borderRadius: 16, fontSize: 16 }}>
            <Icon d={ICONS.chat} size={20} stroke={2} />
            {model ? "Pedir por WhatsApp" : "Cotizar por WhatsApp"}
          </a>
          <p style={{ fontSize: 12, color: "var(--text-4)", margin: "8px 0 0", textAlign: "center" }}>
            {busy ? "En unos segundos podrás hacer el pedido aquí mismo." : "Confirmamos el pedido y el pago por WhatsApp."}
          </p>
        </>
      )}
      {ordering && quoteId && (
        <OrderDialog
          quoteId={quoteId}
          color={colorName}
          summary={`${fileName} · ${material.id} ${colorName} · ${quality.name} · relleno ${opts.infill}%${quote.qty > 1 ? ` · ${quote.qty} unidades` : ""}`}
          printPrice={quote.total}
          shipping={shipping}
          onClose={closeOrder}
        />
      )}
    </div>
  );
}

function StageBanner({ stage, server }: { stage: PriceStage; server: ServerQuoteState }) {
  if (stage === "uploading" || stage === "slicing") {
    const steps = [
      [stage === "uploading" ? "Subiendo archivo" : "Archivo recibido", stage === "slicing" ? "done" : "active"],
      ["Laminando", stage === "slicing" ? "active" : "todo"],
      ["Precio exacto", "todo"],
    ] as const;
    return (
      <div className="status status-busy" role="status">
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <span className="spin" aria-hidden="true" />
          Calculando tu precio exacto…
          <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 12, color: "var(--text-3)" }}>unos segundos</span>
        </div>
        <div className="indeterminate" aria-hidden="true" />
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13 }}>
          {steps.map(([text, st]) => (
            <li key={text} style={{ display: "flex", gap: 6, alignItems: "center", color: st === "done" ? "var(--ok)" : st === "active" ? "var(--text)" : "var(--text-4)" }}>
              <span aria-hidden="true">{st === "done" ? "✓" : st === "active" ? "●" : "○"}</span>
              {text}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (stage === "exact" && server.status === "done") {
    const until = new Date(server.quote.valid_until).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
    return (
      <div className="status status-ok pop" role="status">
        <span style={{ ...badge, background: "var(--ok)" }}>✓</span>
        <span>
          <strong>Precio exacto</strong>, calculado laminando tu archivo.
          <span style={{ display: "block", color: "var(--text-3)", fontSize: 13 }}>Cotización {server.quote.id} · válida hasta el {until}</span>
        </span>
      </div>
    );
  }
  const info: Record<string, [string, string, string]> = {
    example: ["status-info", "i", "Este es un precio de ejemplo. Sube tu archivo para ver el de tu pieza."],
    estimate: ["status-info", "≈", "Precio estimado según el volumen de tu modelo. Lo confirmamos al revisar el archivo."],
    nofit: ["status-warn", "!", "Tu modelo no cabe en la impresora. Ajusta la escala en el paso 1 o escríbenos y lo dividimos."],
    failed: ["status-warn", "!", `No pudimos calcular el precio exacto${server.status === "failed" ? ` (${server.error})` : ""}. Te mostramos un estimado.`],
  };
  const [cls, sym, text] = info[stage] ?? info.estimate;
  return (
    <div className={`status ${cls}`} role="status">
      <span style={{ ...badge, background: cls === "status-warn" ? "var(--warn)" : "var(--text-3)" }}>{sym}</span>
      <span>{text}</span>
    </div>
  );
}

const badge = {
  flex: "none", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--bg)", fontSize: 13, fontWeight: 700,
} as const;

const chipLink = { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--text-2)", fontSize: 12 } as const;

const qtyBtn = { width: 40, height: 40, border: 0, background: "var(--surface)", color: "var(--text)", fontSize: 20, cursor: "pointer" } as const;
