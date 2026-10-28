"use client";
/* eslint-disable @next/next/no-img-element -- fotos servidas por la API */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getFeatured, imageUrl, type CatalogProduct } from "@/lib/api";
import { GALLERY_CATEGORIES, WORKS } from "@/lib/catalog";
import { API_URL } from "@/lib/config";
import { money } from "@/lib/format";
import { Icon, ICONS } from "./Icon";
import { SectionHeader } from "./SectionHeader";
import { WorkVisual } from "./WorkVisual";
import { FinishCompare } from "./FinishCompare";

/** Filtros: las subsecciones con más piezas en la galería. */
const MAX_FILTERS = 6;

export function Gallery() {
  const [items, setItems] = useState<CatalogProduct[] | null>(null);

  useEffect(() => {
    if (!API_URL) return;
    getFeatured(24).then(setItems, () => setItems([]));
  }, []);

  return (
    <section id="work" className="section">
      <SectionHeader eyebrow="// GALERÍA" title="Lo que podemos imprimir para ti" lead="Toca cualquier pieza para verla de cerca y pedirla en tu color." mb={32} />
      {items?.length ? <PhotoGallery items={items} /> : <SampleGallery />}
      <FinishCompare />
    </section>
  );
}

function PhotoGallery({ items }: { items: CatalogProduct[] }) {
  const counts = new Map<string, number>();
  for (const p of items) if (p.subsection) counts.set(p.subsection, (counts.get(p.subsection) ?? 0) + 1);
  const filters = ["Todos", ...[...counts].sort((a, b) => b[1] - a[1]).slice(0, MAX_FILTERS).map(([s]) => s)];
  const [filter, setFilter] = useState("Todos");
  const [sel, setSel] = useState(-1);
  // Fotos que no cargaron (por ejemplo, una vista previa de Drive caída): se ocultan.
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const shown = items.filter((p) => !broken.has(p.id) && (filter === "Todos" || p.subsection === filter));
  const close = useCallback(() => setSel(-1), []);

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 28 }}>
        {filters.map((f) => (
          <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="photo-grid">
        {shown.map((p, i) => (
          <button key={p.id} className="photo-tile" data-big={filter === "Todos" && i % 7 === 0 ? "" : undefined} onClick={() => setSel(i)}
            aria-label={`Ver ${p.name}`}>
            <img src={imageUrl(p.images[0])} alt="" loading="lazy" className="pic" onError={() => setBroken((b) => new Set(b).add(p.id))} />
            <span className="photo-info">
              <span>
                <span className="mono" style={{ display: "block", fontSize: 11, letterSpacing: 1, color: "var(--ac)" }}>{p.subsection.toUpperCase()}</span>
                <span style={{ display: "block", fontWeight: 600, fontSize: 17, marginTop: 4 }}>{p.name}</span>
                {p.price_from && <span style={{ display: "block", fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Desde ${money(p.price_from)}</span>}
              </span>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,.3)", background: "rgba(11,11,13,.5)" }}>
                <Icon d={ICONS.expand} size={16} stroke={2} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
        <Link href="/catalogo" className="btn btn-ghost" style={{ padding: "14px 22px", borderRadius: 14 }}>Ver todo el catálogo →</Link>
      </div>
      {sel >= 0 && <PhotoModal items={shown} index={sel} onIndex={setSel} onClose={close} />}
    </>
  );
}

function PhotoModal({ items, index, onIndex, onClose }: { items: CatalogProduct[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const p = items[index];
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  const arrow = (d: number, label: string, path: string) => (
    <button onClick={() => go(d)} aria-label={label}
      style={{ position: "absolute", top: "50%", [d < 0 ? "left" : "right"]: 12, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)", background: "rgba(11,11,13,.6)", color: "#fff", cursor: "pointer", fontSize: 20 }}>
      {path}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={p.name} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(5,5,7,.82)", backdropFilter: "blur(12px)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 1100, maxHeight: "92vh", overflow: "auto", display: "flex", flexWrap: "wrap", borderRadius: 28, background: "var(--surface)", border: "1px solid rgba(255,255,255,.12)" }}>
        <button onClick={onClose} aria-label="Cerrar" autoFocus
          style={{ position: "absolute", right: 14, top: 14, zIndex: 2, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.2)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={ICONS.close} size={18} stroke={2} />
        </button>
        <div style={{ position: "relative", flex: "1 1 460px", minWidth: 0, aspectRatio: "1 / 1", maxHeight: "92vh", background: "var(--surface-3)" }}>
          <img key={p.id} src={imageUrl(p.images[0])} alt={p.name} className="pop" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          {items.length > 1 && <>{arrow(-1, "Anterior", "‹")}{arrow(1, "Siguiente", "›")}</>}
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0, padding: "40px 32px", display: "flex", flexDirection: "column" }}>
          <span className="mono eyebrow">{p.subsection.toUpperCase()}</span>
          <h3 style={{ fontSize: 30, margin: "12px 0" }}>{p.name}</h3>
          {p.description && <p style={{ color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 16px" }}>{p.description}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--line)" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>TAMAÑOS</span><span>{p.sizes.map((s) => s.label).join(" · ")}</span>
          </div>
          {p.price_from && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--line)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>PRECIO</span><span>Desde <strong>${money(p.price_from)}</strong></span>
            </div>
          )}
          <Link className="btn btn-primary glow" href={`/producto/${p.id}`} style={{ display: "block", textAlign: "center", marginTop: "auto", padding: 16, borderRadius: 14 }}>Elegir color y pedirlo</Link>
          <a className="btn btn-ghost" href="#quote" onClick={onClose} style={{ display: "block", textAlign: "center", marginTop: 10, padding: 14, borderRadius: 14 }}>Cotizar mi propio archivo</a>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ["Todos", ...GALLERY_CATEGORIES] as const;

/** Sin catálogo (sitio sin API): piezas de muestra dibujadas. */
function SampleGallery() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");
  const [sel, setSel] = useState(-1);
  const works = WORKS.map((w, i) => ({ w, i })).filter(({ w }) => filter === "Todos" || w.category === filter);

  return (
    <>
      <div className="row" style={{ gap: 10, marginBottom: 28 }}>
        {FILTERS.map((f) => (
          <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 20 }}>
        {works.map(({ w, i }) => (
          <button
            key={w.name}
            className="tile tilt"
            onClick={() => setSel(i)}
            style={{
              flex: "1 1 260px", minWidth: 0, height: 320, position: "relative", overflow: "hidden", cursor: "pointer", textAlign: "left",
              color: "var(--text)", padding: 0, borderRadius: 24, border: "1px solid var(--line)",
              background: "radial-gradient(circle at 50% 45%,rgba(255,255,255,.07),transparent 60%),var(--surface-2)",
            }}
          >
            <span aria-hidden="true" style={{ position: "absolute", left: "-20%", right: "-20%", bottom: -40, height: 160, backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "28px 28px", transform: "perspective(400px) rotateX(62deg)", WebkitMaskImage: "linear-gradient(transparent,#000)", maskImage: "linear-gradient(transparent,#000)" }} />
            <span className="flo" style={{ position: "absolute", left: "12%", right: "12%", top: 24, bottom: 84, display: "block", animationDelay: `-${(i * 0.8).toFixed(1)}s` }}>
              <WorkVisual work={w} size={170} className="pic" />
            </span>
            <span style={{ position: "absolute", left: 18, right: 18, bottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
              <span>
                <span className="mono" style={{ display: "block", fontSize: 11, letterSpacing: 1, color: "var(--ac)" }}>{w.category.toUpperCase()}</span>
                <span style={{ display: "block", fontWeight: 600, fontSize: 17, marginTop: 4 }}>{w.name}</span>
              </span>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,.2)" }}>
                <Icon d={ICONS.expand} size={16} stroke={2} />
              </span>
            </span>
          </button>
        ))}
      </div>
      {sel >= 0 && <WorkModal index={sel} onClose={() => setSel(-1)} />}
    </>
  );
}

function WorkModal({ index, onClose }: { index: number; onClose: () => void }) {
  const w = WORKS[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={w.name} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(5,5,7,.78)", backdropFilter: "blur(12px)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 920, maxHeight: "90vh", overflow: "auto", display: "flex", flexWrap: "wrap", borderRadius: 28, background: "var(--surface)", border: "1px solid rgba(255,255,255,.12)" }}>
        <button onClick={onClose} aria-label="Cerrar" autoFocus
          style={{ position: "absolute", right: 14, top: 14, zIndex: 2, width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.2)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={ICONS.close} size={18} stroke={2} />
        </button>
        <div style={{ flex: "1 1 380px", minWidth: 0, height: 420, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 50%,rgba(255,255,255,.08),transparent 60%),var(--surface-3)" }}>
          <div className={w.img ? "wob" : undefined} style={{ width: "88%", height: "88%" }}><WorkVisual work={w} size={260} /></div>
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0, padding: "40px 32px" }}>
          <span className="mono eyebrow">{w.category.toUpperCase()}</span>
          <h3 style={{ fontSize: 30, margin: "12px 0" }}>{w.name}</h3>
          <p style={{ color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 24px" }}>{w.desc}</p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--line)" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>MATERIAL SUGERIDO</span><span>{w.material}</span>
          </div>
          <a className="btn btn-primary" href="#quote" onClick={onClose} style={{ display: "block", textAlign: "center", marginTop: 20, padding: 16, borderRadius: 14 }}>Cotizar algo así</a>
        </div>
      </div>
    </div>
  );
}
