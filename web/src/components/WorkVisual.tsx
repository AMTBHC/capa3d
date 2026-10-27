/* eslint-disable @next/next/no-img-element -- SVGs locales; next/image no aporta optimización aquí */
import type { Work } from "@/lib/catalog";
import { LayerStack } from "./LayerStack";

/** Foto del trabajo o, si aún no hay foto, la pieza dibujada por capas. */
export function WorkVisual({ work, size, className }: { work: Work; size: number; className?: string }) {
  if (work.img) {
    return <img className={className} src={work.img} alt={work.name} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />;
  }
  const k = size / 260;
  return (
    <div role="img" aria-label={work.name} className={className} style={{ position: "relative", width: "100%", height: "100%", perspective: 900 }}>
      <div className="turnF" style={{ position: "absolute", left: "50%", top: "62%", width: size, height: size, margin: `${-size / 2}px 0 0 ${-size / 2}px` }}>
        <LayerStack layers={20} size={size} height={110 * k} profile={(u) => work.profile(u) * k} color={work.color} radius={work.radius} infill={25} alpha="2e" />
      </div>
    </div>
  );
}
