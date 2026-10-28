"use client";

import { useState } from "react";
import { MATERIALS } from "@/lib/catalog";
import { printer } from "@/lib/config";
import { LayerStack } from "./LayerStack";
import { SectionHeader } from "./SectionHeader";

export function Materials() {
  const [tab, setTab] = useState(0);
  const m = MATERIALS[tab];
  const specs = [
    ["TEMPERATURA DE USO", m.temp],
    ["IDEAL PARA", m.ideal],
    ["ACABADO", m.finish],
    ["FLEXIBILIDAD", m.flexibility],
  ];
  return (
    <section id="materiales" className="section">
      <SectionHeader eyebrow="// MATERIALES" title="Cuatro materiales, cada uno para un trabajo" mb={32} />
      <div className="row" role="tablist" aria-label="Materiales" style={{ gap: 10, marginBottom: 20 }}>
        {MATERIALS.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={i === tab} className="pill" onClick={() => setTab(i)}>{x.id}</button>
        ))}
      </div>
      <div role="tabpanel" className="row" style={{ borderRadius: 28, background: "var(--surface)", border: "1px solid var(--line)", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ flex: "1 1 360px", minWidth: 0, position: "relative", height: 380, perspective: 1000, background: `radial-gradient(circle at 50% 60%,${m.color}33,transparent 60%),var(--bg-2)` }}>
          <div className="turnF" style={{ position: "absolute", left: "50%", top: "62%", width: 240, height: 240, margin: "-120px 0 0 -120px" }}>
            <LayerStack layers={24} size={240} height={140} profile={m.profile} color={m.color} radius={m.radius} infill={25} alpha="26" />
          </div>
          <span className="display" style={{ position: "absolute", left: 24, bottom: 12, fontWeight: 700, fontSize: 96, lineHeight: 1, color: "transparent", WebkitTextStroke: "1px var(--line-3)" }}>{m.id}</span>
        </div>
        <div style={{ flex: "1 1 420px", minWidth: 0, padding: 36 }}>
          <h3 style={{ fontSize: 34, margin: "0 0 12px" }}>{m.id}</h3>
          <p style={{ color: "var(--text-2)", fontSize: 17, lineHeight: 1.6, margin: "0 0 24px" }}>{m.desc}</p>
          {specs.map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, padding: "14px 0", borderTop: "1px solid var(--line)" }}>
              <span className="mono" style={{ fontSize: 12, letterSpacing: 1, color: "var(--text-3)" }}>{k}</span>
              <span style={{ fontWeight: 500, textAlign: "right" }}>{v}</span>
            </div>
          ))}
          <p className="mono" style={{ fontSize: 11, color: "var(--text-4)", margin: "16px 0 0" }}>
            Valores aproximados de referencia. Volumen máximo de impresión: {printer.bed.x} × {printer.bed.y} × {printer.bed.z} mm
          </p>
        </div>
      </div>
    </section>
  );
}
