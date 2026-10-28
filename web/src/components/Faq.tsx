"use client";

import { useState } from "react";
import { FAQS } from "@/lib/catalog";

export function Faq() {
  const [open, setOpen] = useState(-1);
  return (
    <section id="faq" className="section" style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 32 }}>
        <span className="mono eyebrow">{"// PREGUNTAS"}</span>
        <h2 className="h2">Resolvemos tus dudas</h2>
      </div>
      {FAQS.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} style={{ borderBottom: "1px solid var(--line-2)" }}>
            <button onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} aria-controls={`faq-${i}`}
              style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: 0, color: "var(--text)", padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: 18, fontWeight: 500 }}>
              <span>{q}</span>
              <span aria-hidden="true" style={{ flex: "none", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, transition: "transform .3s", color: on ? "var(--bg)" : "var(--ac)", background: on ? "var(--ac)" : "transparent", border: "1px solid var(--ac)", transform: on ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            <div id={`faq-${i}`} hidden={!on} style={{ padding: "0 0 24px", color: "var(--text-3)", lineHeight: 1.7, maxWidth: 720 }}>{a}</div>
          </div>
        );
      })}
    </section>
  );
}
