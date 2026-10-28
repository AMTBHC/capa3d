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
import { Icon, ICONS } from "../Icon";
import { SiteHeader } from "../SiteHeader";
import { grid, ProductCard } from "./Cards";
import { ColorMode, FilamentPicker } from "../quoter/Options";
import { OrderDialog } from "../quoter/OrderDialog";
import { useCatalog, useServerQuote } from "../quoter/useServer";

const ModelViewer = dynamic(() => import("../quoter/ModelViewer"), { ssr: false });

/** Texto de muestra del llavero mientras el cliente no escribe el suyo. */
const SAMPLE_NAME = "Ana";
const NAME_DEBOUNCE_MS = 600;
/** Color inicial si el producto no sugiere uno. */
const DEFAULT_COLOR = "Naranja";

const box = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 20 } as const;

export function ProductView({ id }: { id: string }) {
  const [p, setP] = useState<CatalogProduct | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getProduct(id).then((x) => {
      setP(x);
      document.title = `${x.name} · Capa3D`;
    }, () => setMissing(true));
  }, [id]);

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <SiteHeader />
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
  const summary = `${label} · ${s.label} · ${MATERIALS[material].id} ${colorName}${qty > 1 ? ` · ${qty} unidades` : ""}`;
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

      <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={box}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {p.badges.map((b) => <span key={b} className="chip">{BADGE_LABEL[b]}</span>)}
          </div>
          <h1 className="h2" style={{ margin: "0 0 6px", fontSize: 30 }}>{p.name}</h1>
          {p.subsection && <div style={{ fontSize: 13, color: "var(--text-3)" }}>{p.subsection}</div>}

          {p.personalize && (
            <div className="field" style={{ marginTop: 18 }}>
              <label className="field-label" htmlFor="name-text">Nombre del llavero <span className="muted">máx. {p.personalize.max_length} letras</span></label>
              <input id="name-text" className="input" value={name} maxLength={p.personalize.max_length} placeholder={`Ej: ${SAMPLE_NAME}`}
                onChange={(e) => setName(e.target.value)} autoComplete="off" />
              {nameError && <div className="status status-warn" style={{ marginTop: 8 }}>{nameError}</div>}
              {generating && !nameError && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>Generando tu llavero…</div>}
            </div>
          )}

          <div className="field" style={{ marginTop: 18 }}>
            <div className="field-label">Tamaño</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {p.sizes.map((x, i) => (
                <button key={x.label} className="chip-btn" aria-pressed={i === size} onClick={() => setSize(i)}>
                  {x.label}
                  {first && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>{num1(first.dx * x.scale / 100)}×{num1(first.dy * x.scale / 100)}×{num1(first.dz * x.scale / 100)} mm</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={box}>
          {fileColors > 1 && (
            <ColorMode colors={fileColors} filaments={fileInfo?.info.filaments ?? []} multicolor={multicolor} onChange={setMulticolor} />
          )}
          <FilamentPicker material={material} color={color} onMaterial={setMaterial} onColor={setColor} showColors={colors === 1} />
          <div className="field">
            <div className="field-label">Cantidad</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="chip-btn" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <strong style={{ minWidth: 28, textAlign: "center", fontSize: 18 }}>{qty}</strong>
              <button className="chip-btn" aria-label="Más" onClick={() => setQty((q) => Math.min(50, q + 1))}>+</button>
            </div>
          </div>
        </div>

        <div style={box}>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Precio de impresión</div>
          <div className="display" style={{ fontSize: 34, fontWeight: 700, margin: "4px 0 2px" }} aria-live="polite">
            {quote ? `$${money(quote.total)}` : server.status === "failed" || prepareError ? "—" : <span className="indeterminate" style={{ display: "inline-block", width: 140, height: 8, borderRadius: 99 }} />}
          </div>
          {quote && qty > 1 && <div style={{ fontSize: 13, color: "var(--text-3)" }}>${money(quote.unit_price)} c/u</div>}
          {!!quote?.color_changes && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              Incluye {quote.color_changes} cambios de color ({num1(quote.purge_grams ?? 0)} g de purga). En un solo color sale más económico.
            </div>
          )}
          {prepareError
            ? <div className="status status-warn" style={{ marginTop: 8 }}>{prepareError}</div>
            : review
              ? <div className="status status-warn" role="alert" style={{ marginTop: 8 }}><span><strong>Esta pieza la cotizamos por WhatsApp.</strong> Es muy grande para darte el precio en línea: {review}.</span></div>
              : server.status === "failed" && <div className="status status-warn" style={{ marginTop: 8 }}>No pudimos calcular el precio. Escríbenos por WhatsApp.</div>}
          {!fileId && !prepareError && !p.personalize && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>Preparando el modelo para cotizarlo…</div>}
          <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 6 }}>El envío se calcula con tu ciudad. Confirmamos antes de que pagues.</div>
          {!review && (
            <button className="btn btn-primary glow" style={{ width: "100%", marginTop: 14, padding: 15, borderRadius: 16, fontSize: 16 }} disabled={!canOrder} onClick={() => setOrdering(true)}>
              {needsName ? "Escribe el nombre para pedirlo" : "Pedirlo"}
            </button>
          )}
          <a className={`btn ${review ? "btn-primary" : "btn-ghost"}`} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, padding: 12, borderRadius: 14, fontSize: 14 }}
            href={whatsappUrl(`Hola, quiero ${summary}${quote ? ` ($${money(quote.total)})` : ""}`)}>
            <Icon d={ICONS.chat} size={18} stroke={2} />
            {review ? "Cotizar por WhatsApp" : "Preguntar por WhatsApp"}
          </a>
        </div>
      </aside>

      {ordering && server.status === "done" && quote && (
        <OrderDialog quoteId={server.quote.id} color={colorName} summary={summary} printPrice={quote.total} shipping={catalog.shipping} onClose={closeOrder} />
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
      <div style={grid}>{items.map((x) => <ProductCard key={x.id} p={x} emoji={p.collection?.emoji ?? ""} />)}</div>
    </section>
  );
}
