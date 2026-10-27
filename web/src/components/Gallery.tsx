"use client";

import { useEffect, useState } from "react";
import { GALLERY_CATEGORIES, WORKS } from "@/lib/catalog";
import { Icon, ICONS } from "./Icon";
import { SectionHeader } from "./SectionHeader";
import { WorkVisual } from "./WorkVisual";
import { FinishCompare } from "./FinishCompare";

const FILTERS = ["Todos", ...GALLERY_CATEGORIES] as const;

export function Gallery() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todos");
  const [sel, setSel] = useState(-1);
  const works = WORKS.map((w, i) => ({ w, i })).filter(({ w }) => filter === "Todos" || w.category === filter);

  return (
    <section id="work" className="section">
      <SectionHeader eyebrow="// GALERÍA" title="Lo que podemos imprimir para ti" lead="Toca cualquier pieza para verla de cerca." mb={32} />
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
      <FinishCompare />
      {sel >= 0 && <WorkModal index={sel} onClose={() => setSel(-1)} />}
    </section>
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
