"use client";
/* eslint-disable @next/next/no-img-element -- imágenes servidas por la API */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BADGE_LABEL, getCollection, getProduct, getServerFile, imageUrl, personalize, prepareProduct, type CatalogProduct, type QuoteParams, type ServerFile } from "@/lib/api";
import { COLORS, MATERIALS } from "@/lib/catalog";
import { whatsappUrl } from "@/lib/config";
import { money, num1 } from "@/lib/format";
import { loadServerModel, type ServerPlateMesh } from "@/lib/serverModel";
import { addItem, openCart } from "@/lib/cart";
import { FINISHES, sizeName } from "@/lib/content";
import { ProductCard } from "./ProductCard";
import { ColorPicker, FinishPicker, OptionGroup, QtyStepper } from "./Pickers";
import { ColorMode } from "../quoter/Options";
import { Icon, ICONS } from "../Icon";
import { OrderDialog } from "../quoter/OrderDialog";
import { useCatalog, useServerQuote } from "../quoter/useServer";
import { WhatsAppIcon } from "../WhatsAppIcon";

const ModelViewer = dynamic(() => import("../quoter/ModelViewer"), { ssr: false });

/** Texto de muestra del llavero mientras el cliente no escribe el suyo. */
const SAMPLE_NAME = "Ana";
const NAME_DEBOUNCE_MS = 600;
/** Color inicial si el producto no sugiere uno. */
const DEFAULT_COLOR = "Blanco";

export function ProductView({ id }: { id: string }) {
  const [p, setP] = useState<CatalogProduct | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getProduct(id).then((x) => {
      setP(x);
      document.title = `${x.name} · CR3D`;
    }, () => setMissing(true));
  }, [id]);

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <nav aria-label="Ruta" style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 12 }}>
        <Link href="/catalogo" style={{ color: "var(--text-3)" }}>Catálogo</Link>
        {p?.collection && <> › <Link href={`/catalogo?c=${p.collection.id}`} style={{ color: "var(--text-3)" }}>{p.collection.name}</Link></>}
        {p?.collection && p.subsection && <> › <Link href={`/catalogo?c=${p.collection.id}&s=${encodeURIComponent(p.subsection)}`} style={{ color: "var(--text-3)" }}>{p.subsection}</Link></>}
        {" "}› {p?.name ?? "…"}
      </nav>
      {missing && <div className="status status-warn">Este producto no existe o ya no está disponible. <Link href="/catalogo">Ver el catálogo</Link></div>}
      {p && <Product key={p.id} p={p} />}
      {p && <Related p={p} />}
    </main>
  );
}

function Product({ p }: { p: CatalogProduct }) {
  const catalog = useCatalog();
  const [size, setSize] = useState(() => Math.max(0, p.sizes.findIndex((x) => x.scale === 100)));
  const [material, setMaterial] = useState(0);
  const [color, setColor] = useState(() => {
    const i = COLORS.findIndex((c) => c.name === (p.default_color || DEFAULT_COLOR));
    return Math.max(0, i);
  });
  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState(FINISHES[0] ?? "");
  const [name, setName] = useState("");
  const [nameFile, setNameFile] = useState<{ text: string; id: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const [ordering, setOrdering] = useState(false);

  // Llaveros con nombre: se genera el modelo con el texto (o el de muestra).
  const text = (name.trim() || SAMPLE_NAME).slice(0, p.personalize?.max_length ?? 14);
  useEffect(() => {
    if (!p.personalize) return;
    let alive = true;
    const timer = setTimeout(() => {
      personalize(p.id, text).then(
        (fid) => {
          if (!alive) return;
          setNameFile({ text, id: fid });
          setNameError("");
        },
        (e) => alive && setNameError(e instanceof Error ? e.message : String(e)),
      );
    }, nameFile ? NAME_DEBOUNCE_MS : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // nameFile solo decide si esperar; no debe relanzar la generación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, p.personalize, text]);

  // Productos importados: el modelo se baja la primera vez que alguien abre el producto.
  const [prepared, setPrepared] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState("");
  useEffect(() => {
    if (p.personalize || p.file_id) return;
    let alive = true;
    prepareProduct(p.id).then(
      (fid) => alive && setPrepared(fid),
      (e) => alive && setPrepareError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [p.id, p.personalize, p.file_id]);

  const fileId = p.personalize ? nameFile?.id : p.file_id ?? prepared ?? undefined;
  const generating = !!p.personalize && nameFile?.text !== text;

  // Vista 3D solo en los llaveros con nombre (para ver el texto); los demás productos se muestran con fotos.
  const [plates, setPlates] = useState<{ fileId: string; plates: ServerPlateMesh[] } | null>(null);
  useEffect(() => {
    if (!fileId || !p.personalize) return;
    let alive = true;
    loadServerModel(fileId).then((x) => alive && setPlates({ fileId, plates: x }), (e) => console.warn("No se pudo cargar el modelo", e));
    return () => {
      alive = false;
    };
  }, [fileId, p.personalize]);

  // Medidas de los tamaños y colores del modelo: del resumen del archivo, sin descargar la malla.
  const [fileInfo, setFileInfo] = useState<ServerFile | null>(null);
  const [multicolor, setMulticolor] = useState(true);
  useEffect(() => {
    if (!fileId || p.personalize) return;
    let alive = true;
    getServerFile(fileId).then((f) => alive && setFileInfo(f), () => {});
    return () => {
      alive = false;
    };
  }, [fileId, p.personalize]);

  const s = p.sizes[size];
  const fileDims = fileInfo?.plates[0] ?? null;
  const fileColors = Math.max(1, ...(fileInfo?.plates.map((x) => x.colors ?? 1) ?? []));
  const colors = fileColors > 1 && multicolor ? fileColors : 1;
  const colorName = colors > 1 ? `Multicolor (${colors} colores, como la foto)` : COLORS[color].name;
  const params: QuoteParams = { material: MATERIALS[material].id, quality: "estandar", infill: 20, qty, unit: "mm", scale: s.scale, supports: true, multicolor };
  const server = useServerQuote(fileId, params);
  const quote = server.status === "done" ? server.quote.price : null;
  const k = s.scale / 100;
  const first = p.personalize ? plates?.plates[0]?.analysis : fileDims;
  const viewerPlates = useMemo(() => plates?.plates.map((x) => ({ positions: x.positions, analysis: x.analysis, fits: true })) ?? [], [plates]);

  const needsName = !!p.personalize && !name.trim();
  const canOrder = !!quote && server.status === "done" && !needsName && !generating;
  // Pieza muy grande para dar precio en línea: se cotiza por WhatsApp.
  const review = server.status === "failed" ? (server.quote?.review ?? null) : null;
  const label = p.personalize ? `${p.name} "${text}"` : p.name;
  const summary = `${label} · ${sizeName(s.label)} · ${MATERIALS[material].id} ${colorName}${finish ? ` ${finish.toLowerCase()}` : ""}${qty > 1 ? ` · ${qty} unidades` : ""}`;
  const colorForOrder = finish ? `${colorName} · ${finish}` : colorName;

  const addToOrder = () => {
    if (needsName) return;
    addItem({
      productId: p.id, name: p.name, image: p.images[0] ? imageUrl(p.images[0]) : null, emoji: p.personalize ? "🔑" : p.collection?.emoji ?? "🧩",
      size: p.sizes.length > 1 ? sizeName(s.label) : "", color: colors > 1 ? "Multicolor, como la foto" : COLORS[color].name,
      finish, text: p.personalize ? name.trim() : "", qty,
      priceFrom: quote ? quote.unit_price : p.price_from,
    });
  };
  const closeOrder = useCallback(() => setOrdering(false), []);

  return (
    <div className="quote-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <Gallery p={p} viewer={
          viewerPlates.length > 0 ? (
            <ModelViewer plates={viewerPlates} selected={0} k={k} color={COLORS[color].render} wire={false} autoRotate layerMm={0.2} bed={catalog.bed} />
          ) : null
        } />
        {p.description && <p className="lead" style={{ margin: 0, whiteSpace: "pre-line" }}>{p.description}</p>}
      </div>

      <aside className="buy-col">
        <div className="buy-box">
          {p.badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {p.badges.map((b) => <span key={b} className="badge">{BADGE_LABEL[b]}</span>)}
            </div>
          )}
          {p.subsection && <div className="pc-cat">{p.subsection}</div>}
          <h1 className="buy-title">{p.name}</h1>
          <div className="buy-price" aria-live="polite">
            {quote ? <><strong>${money(quote.total)}</strong>{qty > 1 && <span> · ${money(quote.unit_price)} c/u</span>}</>
              : server.status === "failed" || prepareError ? (p.price_from ? <>Desde <strong>${money(p.price_from)}</strong></> : "Te cotizamos el precio")
              : <span className="indeterminate" style={{ display: "inline-block", width: 140, height: 8, borderRadius: 99 }} />}
          </div>
          {!fileId && !prepareError && !p.personalize && <div className="field-hint">Calculando el precio exacto…</div>}

          {p.personalize && (
            <OptionGroup label="Nombre del llavero" value={<span className="muted">máx. {p.personalize.max_length} letras</span>}>
              <input id="name-text" className="input" value={name} maxLength={p.personalize.max_length} placeholder={`Ej.: ${SAMPLE_NAME}`}
                onChange={(e) => setName(e.target.value)} autoComplete="off" aria-label="Nombre del llavero" />
              {nameError && <div className="status status-warn" style={{ marginTop: 8 }}>{nameError}</div>}
              {generating && !nameError && <div className="field-hint">Generando tu llavero…</div>}
            </OptionGroup>
          )}

          {p.sizes.length > 1 && (
            <OptionGroup label="Tamaño">
              <div className="opt-row">
                {p.sizes.map((x, i) => (
                  <button key={x.label} type="button" className="opt-chip opt-chip-col" aria-pressed={i === size} onClick={() => setSize(i)}>
                    {sizeName(x.label)}
                    {first && <span className="opt-chip-hint">{num1(first.dx * x.scale / 1000)} × {num1(first.dy * x.scale / 1000)} × {num1(first.dz * x.scale / 1000)} cm</span>}
                  </button>
                ))}
              </div>
            </OptionGroup>
          )}

          {fileColors > 1 && (
            <ColorMode colors={fileColors} filaments={fileInfo?.info.filaments ?? []} multicolor={multicolor} onChange={setMulticolor} />
          )}
          {colors === 1 && (
            <ColorPicker value={COLORS[color].name} onChange={(n) => setColor(Math.max(0, COLORS.findIndex((c) => c.name === n)))} />
          )}
          <FinishPicker value={finish} onChange={setFinish} />
          <QtyStepper value={qty} onChange={setQty} />

          <details className="more-box">
            <summary>Opciones avanzadas <span className="muted">(material)</span></summary>
            <OptionGroup label="Material" value={MATERIALS[material].id}>
              <div className="opt-row">
                {MATERIALS.map((m, i) => (
                  <button key={m.id} type="button" className="opt-chip opt-chip-col" aria-pressed={i === material} onClick={() => setMaterial(i)}>
                    {m.id}<span className="opt-chip-hint">{m.tag}</span>
                  </button>
                ))}
              </div>
            </OptionGroup>
            <p className="field-hint">Si no estás seguro, déjalo en PLA: sirve para casi todo.</p>
          </details>

          {prepareError
            ? <div className="status status-warn" style={{ marginTop: 12 }}>{prepareError}</div>
            : review
              ? <div className="status status-info" role="status" style={{ marginTop: 12 }}><span><strong>Esta pieza la cotizamos personalmente.</strong> Es muy grande para darte el precio en línea: {review}.</span></div>
              : server.status === "failed" && <div className="status status-warn" style={{ marginTop: 12 }}>No pudimos calcular el precio exacto. Agrégalo a tu pedido y te lo confirmamos por WhatsApp.</div>}

          <div className="buy-ctas" data-hide-fab="">
            <button type="button" className="btn btn-primary btn-lg btn-block" disabled={needsName || generating} onClick={addToOrder}>
              <Icon d={ICONS.bag} size={20} stroke={2} />
              {needsName ? "Escribe el nombre para pedirlo" : "Agregar a mi pedido"}
            </button>
            {(canOrder || review) && (
              <button type="button" className="btn btn-outline btn-lg btn-block" onClick={() => setOrdering(true)}>
                {review ? "Solicitar cotización en línea" : "Comprar ahora y pagar en línea"}
              </button>
            )}
            <a className="btn btn-ghost btn-block" target="_blank" rel="noopener noreferrer"
              href={whatsappUrl(`Hola, quiero ${summary}${quote ? ` ($${money(quote.total)})` : ""}`)}>
              <WhatsAppIcon size={18} />Preguntar por WhatsApp
            </a>
          </div>
          <p className="field-hint" style={{ textAlign: "center" }}>
            El envío depende de tu ciudad. Te lo confirmamos antes de que pagues. <button type="button" className="link-btn" onClick={openCart}>Ver mi pedido</button>
          </p>
        </div>
      </aside>

      {ordering && server.status === "done" && quote && (
        <OrderDialog quoteId={server.quote.id} color={colorForOrder} summary={summary} printPrice={quote.total} shipping={catalog.shipping} onClose={closeOrder} />
      )}
      {ordering && review && server.status === "failed" && server.quote && (
        <OrderDialog request quoteId={server.quote.id} color={colorForOrder} summary={summary} printPrice={0} shipping={catalog.shipping} onClose={closeOrder} />
      )}
    </div>
  );
}

/** Fotos del producto y la vista 3D en la misma galería. */
function Gallery({ p, viewer }: { p: CatalogProduct; viewer: React.ReactNode }) {
  const views = [...p.images.map((img) => ({ key: img, img })), ...(viewer ? [{ key: "3d", img: null }] : [])];
  const [pick, setPick] = useState<string | null>(null);
  const current = views.find((v) => v.key === pick) ?? (p.personalize && viewer ? views[views.length - 1] : views[0]);

  return (
    <div>
      <div style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 20, overflow: "hidden", background: "var(--surface-3)", border: "1px solid var(--line)" }}>
        {current?.img ? <img src={imageUrl(current.img)} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : current ? viewer
          : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>{p.personalize ? "Generando tu llavero…" : "Foto próximamente"}</div>}
        {current?.key === "3d" && <span className="chip" style={{ position: "absolute", left: 12, bottom: 12 }}>Arrastra para girarlo</span>}
      </div>
      {views.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto" }}>
          {views.map((v) => (
            <button key={v.key} onClick={() => setPick(v.key)} aria-pressed={v.key === current?.key} aria-label={v.img ? "Ver foto" : "Ver en 3D"}
              style={{ flex: "0 0 64px", height: 64, borderRadius: 12, overflow: "hidden", border: v.key === current?.key ? "2px solid var(--ac)" : "1px solid var(--line)", background: "var(--surface-3)", padding: 0, cursor: "pointer", color: "var(--text)", fontWeight: 700 }}>
              {v.img ? <img src={imageUrl(v.img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "3D"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const RELATED = 8;

/** Más productos de la misma categoría (o de la colección, si la categoría tiene pocos). */
function Related({ p }: { p: CatalogProduct }) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  useEffect(() => {
    getCollection(p.collection_id).then((c) => {
      const others = c.products.filter((x) => x.id !== p.id);
      const same = others.filter((x) => x.subsection === p.subsection);
      setItems([...same, ...others.filter((x) => x.subsection !== p.subsection)].slice(0, RELATED));
    }, () => setItems([]));
  }, [p.id, p.collection_id, p.subsection]);
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 56 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>También te puede gustar</h2>
        <Link href={`/catalogo?c=${p.collection_id}`} style={{ fontSize: 14 }}>Ver todo {p.collection?.name ?? "la colección"} →</Link>
      </div>
      <div className="product-grid">{items.map((x) => <ProductCard key={x.id} p={x} emoji={p.collection?.emoji ?? "🧩"} />)}</div>
    </section>
  );
}
