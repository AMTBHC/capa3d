import type { CSSProperties } from "react";
import type { Profile } from "@/lib/catalog";

/** Trama diagonal que representa el porcentaje de relleno. */
export function infillPattern(color: string, infill: number): string {
  if (infill <= 0) return "transparent";
  if (infill >= 100) return color;
  const gap = Math.round(4 + ((100 - infill) / 100) * 16);
  return `repeating-linear-gradient(45deg,${color} 0 1.5px,transparent 1.5px ${gap}px),repeating-linear-gradient(-45deg,${color} 0 1.5px,transparent 1.5px ${gap}px)`;
}

interface Props {
  layers: number;
  /** Lado del contenedor en px. */
  size: number;
  /** Altura total de la pila en px. */
  height: number;
  profile: Profile;
  color: string;
  radius?: string;
  border?: number;
  infill?: number;
  wire?: boolean;
  /** Opacidad del relleno de cada capa, en hex de dos dígitos. */
  alpha?: string;
  /** Las capas aparecen una a una (animación del hero). */
  animate?: boolean;
}

/** Pieza dibujada como capas apiladas en 3D con CSS. Se usa dentro de un contenedor `.turn`/`.turnF`. */
export function LayerStack({
  layers, size, height, profile, color, radius = "50%", border = 2, infill = 25, wire = false, alpha = "26", animate = false,
}: Props) {
  const c = size / 2;
  return (
    <>
      {Array.from({ length: layers }, (_, i) => {
        const u = layers > 1 ? i / (layers - 1) : 0;
        const w = Math.round(profile(u));
        const top = i === layers - 1;
        const outer: CSSProperties = {
          position: "absolute", left: 0, top: 0, width: size, height: size,
          transformStyle: "preserve-3d", transform: `translateZ(${(u * height).toFixed(1)}px)`,
        };
        const ring: CSSProperties = {
          position: "absolute", left: c - w / 2, top: c - w / 2, width: w, height: w,
          borderRadius: radius, border: `${border}px solid ${color}`,
          background: top ? infillPattern(color, infill) : wire ? "transparent" : color + alpha,
          boxShadow: wire ? "none" : `0 0 12px ${color}40`,
        };
        return (
          <div key={i} style={outer}>
            <div className={animate ? `k${Math.round(u * 47)}` : undefined} style={ring} />
          </div>
        );
      })}
    </>
  );
}

/** Cama de impresión cuadriculada bajo la pila. */
export function BedPlate({ cell = 16, radius = 20 }: { cell?: number; radius?: number }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: radius, border: "1px solid rgba(255,255,255,.16)",
        backgroundColor: "var(--surface-3)",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)",
        backgroundSize: `${cell}px ${cell}px`,
      }}
    />
  );
}
