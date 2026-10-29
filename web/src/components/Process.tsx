"use client";

import { useEffect, useState } from "react";
import { STEPS } from "@/lib/catalog";
import { Icon } from "./Icon";
import { SectionHeader } from "./SectionHeader";

/** Recorre los pasos solo hasta que el usuario elige uno. */
export function Process() {
  const [t, setT] = useState(0);
  const [locked, setLocked] = useState<number | null>(null);
  useEffect(() => {
    if (locked !== null) return;
    const id = setInterval(() => setT((x) => x + 1), 350);
    return () => clearInterval(id);
  }, [locked]);

  const cur = locked ?? Math.floor(t / 8) % STEPS.length;
  const sub = locked !== null ? 100 : Math.min(100, Math.round(((t % 8) / 7) * 100));

  return (
    <section id="how" className="section">
      <SectionHeader eyebrow="// PROCESO" title="Del archivo a tu puerta en 4 pasos" />
      <div className="row" style={{ gap: 16 }}>
        {STEPS.map((s, i) => {
          const on = i === cur, done = i < cur;
          return (
            <button key={s.n} onClick={() => setLocked(i)} aria-current={on ? "step" : undefined}
              style={{
                flex: "1 1 230px", minWidth: 0, textAlign: "left", cursor: "pointer", color: "var(--text)", display: "flex", flexDirection: "column",
                alignItems: "flex-start", padding: 24, borderRadius: 24, transition: "all .3s", background: "var(--surface)",
                border: `1px solid ${on ? "#8C53FD99" : "var(--line)"}`, transform: on ? "translateY(-6px)" : "none",
              }}>
              <span style={{ display: "block", height: 4, borderRadius: 2, background: "var(--line-2)", overflow: "hidden", width: "100%" }}>
                <span className="bar" style={{ display: "block", height: 4, borderRadius: 2, background: "var(--ac)", boxShadow: "0 0 10px var(--ac)", width: `${done ? 100 : on ? sub : 0}%` }} />
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 24 }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: on || done ? "var(--bg)" : "var(--text-3)", background: on || done ? "var(--ac)" : "var(--surface-3)", boxShadow: "none" }}>
                  <Icon d={s.icon} />
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>{s.n}</span>
              </span>
              <span className="display" style={{ fontWeight: 600, fontSize: 19, marginTop: 22 }}>{s.title}</span>
              <span style={{ fontSize: 15, color: "var(--text-3)", marginTop: 8, lineHeight: 1.5 }}>{s.text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
