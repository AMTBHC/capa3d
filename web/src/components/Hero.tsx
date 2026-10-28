"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { vase } from "@/lib/catalog";
import { BedPlate, LayerStack } from "./LayerStack";
import { Icon, ICONS } from "./Icon";

const GCODE = (() => {
  const g: string[] = [];
  for (let i = 0; i < 24; i++) {
    const x = (110 + 48 * Math.sin(i * 0.7)).toFixed(2);
    const y = (110 + 48 * Math.cos(i * 0.53)).toFixed(2);
    g.push(i % 6 === 0 ? `G0 X${x} Y${y} F9000` : `G1 X${x} Y${y} E${(0.021 + i * 0.013).toFixed(4)}`);
    if (i % 8 === 7) g.push(`;CAPA ${i * 10 + 12}`);
  }
  return g.concat(g);
})();

const heroProfile = vase(96, 120, 46);

/** Progreso de la impresión simulada, sincronizado con el ciclo de 9 s de la boquilla. */
function usePrintProgress() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 350);
    return () => clearInterval(id);
  }, []);
  const cyc = ((t * 0.35) % 9) / 9;
  return Math.min(1, Math.max(0, (cyc - 0.04) / 0.68));
}

export function Hero() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const f = usePrintProgress();
  const pct = Math.round(f * 100);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientX - b.left) / b.width - 0.5) * 18, y: -((e.clientY - b.top) / b.height - 0.5) * 12 });
  };

  return (
    <section className="wrap" style={{ padding: "56px 24px 72px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
      <div style={{ flex: "1 1 480px", minWidth: 0 }}>
        <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 99, border: "1px solid var(--line-2)", fontSize: 12, letterSpacing: 1, color: "var(--text-2)" }}>
          <span className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ac)" }} />
          IMPRESIÓN 3D FDM · COLOMBIA
        </span>
        <h1 style={{ fontSize: "clamp(40px,6vw,76px)", lineHeight: 1.02, margin: "26px 0 24px", letterSpacing: "-0.035em", fontWeight: 600 }}>
          Da vida a tus ideas,{" "}
          <span style={{ color: "var(--text-4)" }}>
            capa por capa.
          </span>
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.6, color: "var(--text-3)", maxWidth: 540, margin: "0 0 36px" }}>
          Sube tu modelo 3D, elige material, calidad y color, y conoce tu precio en segundos. Prototipos, repuestos, miniaturas y decoración con acabado profesional.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a className="btn btn-primary glow" href="#quote" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 28px", borderRadius: 16 }}>
            <Icon d={ICONS.upload} size={20} stroke={2} />Subir archivo 3D
          </a>
          <a className="btn btn-ghost" href="#work" style={{ padding: "18px 26px", borderRadius: 16 }}>Ver galería</a>
        </div>
        <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 40, fontSize: 12, letterSpacing: 1, color: "var(--text-3)" }}>
          <span>.STL · .OBJ · .3MF · .STEP</span><span>PLA · PETG · ABS · TPU</span><span>RESPUESTA POR WHATSAPP</span>
        </div>
      </div>

      <div
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        aria-hidden="true"
        style={{
          flex: "1 1 460px", minWidth: 0, position: "relative", height: 540, borderRadius: 32, overflow: "hidden",
          background: "radial-gradient(circle at 50% 62%,var(--ac-soft),transparent 60%),var(--surface)",
          border: "1px solid var(--line)", perspective: 1200,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transition: "transform .25s ease-out", transform: `rotateX(${tilt.y.toFixed(2)}deg) rotateY(${tilt.x.toFixed(2)}deg)` }}>
          <div className="turn" style={{ position: "absolute", left: "50%", top: "60%", width: 340, height: 340, margin: "-170px 0 0 -170px" }}>
            <div style={{ position: "absolute", inset: 0, boxShadow: "0 0 60px rgba(0,0,0,.6)", borderRadius: 24 }}><BedPlate cell={20} radius={24} /></div>
            <LayerStack layers={36} size={340} height={175} profile={heroProfile} color="#FF5A1F" infill={30} alpha="14" animate />
          </div>
          <div className="nozY" style={{ position: "absolute", left: 0, right: 0, top: "calc(60% - 104px)", height: 104 }}>
            <div style={{ position: "absolute", left: "6%", right: "6%", top: 14, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#26262B,#3A3A42,#26262B)", boxShadow: "0 4px 18px rgba(0,0,0,.6)" }} />
            <div style={{ position: "absolute", left: "50%", top: 0, width: 64, marginLeft: -32 }}>
              <div className="nozX">
                <svg width="64" height="104" viewBox="0 0 64 104">
                  <rect x="8" y="2" width="48" height="40" rx="8" fill="#2E2E35" stroke="var(--line-3)" />
                  <rect x="16" y="12" width="32" height="6" rx="3" fill="#0B0B0D" />
                  <rect x="22" y="42" width="20" height="30" rx="3" fill="#3A3A42" />
                  <path d="M24 72h16l-5 22h-6z" fill="#C9C9C3" />
                  <circle cx="32" cy="98" r="5" fill="var(--ac)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 18, top: 18, right: 18, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", pointerEvents: "none" }}>
          <span className="mono tag" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)" }} />SIMULACIÓN EN VIVO
          </span>
          <span className="mono tag">CAPA {Math.round(f * 240)} / 240</span>
        </div>
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, padding: 16, borderRadius: 16, background: "var(--glass)", backdropFilter: "blur(10px)", border: "1px solid var(--line-2)" }}>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 11, letterSpacing: 1, color: "var(--text-3)", marginBottom: 10 }}>
            <span>BOQUILLA 215 °C</span><span>CAMA 60 °C</span><span style={{ color: "var(--ac)" }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--line-2)", overflow: "hidden" }}>
            <div className="bar" style={{ height: 6, borderRadius: 3, background: "var(--ac)", width: `${pct}%`, boxShadow: "0 0 12px var(--ac)" }} />
          </div>
        </div>
        <div style={{ position: "absolute", right: 18, top: 64, width: 190, height: 120, overflow: "hidden", borderRadius: 12, background: "var(--glass)", border: "1px solid var(--line)", WebkitMaskImage: "linear-gradient(transparent,#000 25%,#000 75%,transparent)", maskImage: "linear-gradient(transparent,#000 25%,#000 75%,transparent)" }}>
          <div className="gscroll mono" style={{ padding: "8px 12px", fontSize: 10, lineHeight: 1.7 }}>
            {GCODE.map((l, i) => (
              <div key={i} style={{ color: l.startsWith(";") ? "var(--ac)" : l[1] === "0" ? "var(--text)" : "var(--text-4)" }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
