"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Icon, ICONS } from "./Icon";

export function FinishCompare() {
  const [cmp, setCmp] = useState(50);
  return (
    <div className="row" style={{ gap: 32, alignItems: "center", marginTop: 56, borderRadius: 28, background: "var(--surface)", border: "1px solid var(--line)", padding: 32 }}>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <span className="mono eyebrow">{"// ACABADO"}</span>
        <h3 style={{ fontSize: 28, margin: "12px 0", letterSpacing: -0.5 }}>Cruda vs. posprocesada</h3>
        <p style={{ color: "var(--text-3)", lineHeight: 1.6, margin: "0 0 20px" }}>
          Desliza para ver la diferencia entre una pieza recién salida de la impresora, con líneas de capa visibles, y la misma pieza lijada y con acabado liso.
        </p>
        <input type="range" min={0} max={100} value={cmp} onChange={(e) => setCmp(+e.target.value)} aria-label="Comparar pieza cruda y acabada" />
      </div>
      <div style={{ flex: "1 1 420px", minWidth: 0, position: "relative", height: 340, borderRadius: 20, overflow: "hidden", background: "radial-gradient(circle at 50% 55%,rgba(255,106,26,.16),transparent 60%),var(--surface-3)" }}>
        <img src="/img/pieza-acabada.svg" alt="Pieza con acabado liso" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        <img src="/img/pieza-cruda.svg" alt="Pieza cruda con líneas de capa" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", clipPath: `inset(0 ${100 - cmp}% 0 0)` }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "var(--text)", left: `${cmp}%`, boxShadow: "0 0 16px rgba(255,255,255,.6)" }}>
          <span style={{ position: "absolute", top: "50%", left: -19, width: 40, height: 40, marginTop: -20, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d={ICONS.arrows} size={20} stroke={2.2} />
          </span>
        </div>
        <span className="mono" style={{ position: "absolute", left: 14, bottom: 14, fontSize: 11, letterSpacing: 1, padding: "6px 10px", borderRadius: 8, background: "rgba(11,11,13,.8)" }}>CRUDA</span>
        <span className="mono" style={{ position: "absolute", right: 14, bottom: 14, fontSize: 11, letterSpacing: 1, padding: "6px 10px", borderRadius: 8, background: "rgba(11,11,13,.8)" }}>ACABADA</span>
      </div>
    </div>
  );
}
