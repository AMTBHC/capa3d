"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import type { PriceStage } from "./PriceCard";

const LABEL: Record<PriceStage, string> = {
  example: "Precio de ejemplo",
  estimate: "Precio estimado",
  uploading: "Calculando precio exacto…",
  slicing: "Calculando precio exacto…",
  exact: "Precio exacto",
  failed: "Precio estimado",
  nofit: "No cabe en la impresora",
};

/** En celular, el precio queda visible abajo mientras se eligen las opciones del cotizador. */
export function MobilePriceBar({ total, stage }: { total: number; stage: PriceStage }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const steps = document.querySelector(".quote-steps");
    const price = document.getElementById("precio");
    if (!steps || !price) return;
    let inSteps = false;
    let priceShown = false;
    const update = () => setVisible(inSteps && !priceShown);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === steps) inSteps = e.isIntersecting;
        if (e.target === price) priceShown = e.intersectionRatio > 0.25;
      }
      update();
    }, { threshold: [0, 0.25] });
    io.observe(steps);
    io.observe(price);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("quote-bar", visible);
    return () => document.body.classList.remove("quote-bar");
  }, [visible]);

  if (!visible) return null;
  const busy = stage === "uploading" || stage === "slicing";
  return (
    <div className="mobile-bar" role="region" aria-label="Precio">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: stage === "exact" ? "var(--ok)" : "var(--text-3)" }}>
          {busy && <span className="spin" aria-hidden="true" />}
          {LABEL[stage]}
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
          {stage === "exact" ? "" : "≈ "}${money(total)} <span className="mono muted" style={{ fontSize: 12, fontWeight: 400 }}>COP</span>
        </div>
      </div>
      <a href="#precio" className="btn btn-primary" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14 }}>Ver y pedir</a>
    </div>
  );
}
