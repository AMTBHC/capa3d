import { ACCENT, INK, TAGLINE, VIEWBOX } from "./logoPaths";

/** Logo de CR3D: las letras toman el color del texto y el 3 el violeta de la marca. */
export function Logo({ height = 22, tagline = false }: { height?: number; tagline?: boolean }) {
  const group = (g: { transform: string; paths: string[] }, fill: string) => (
    <g transform={g.transform} fill={fill}>
      {g.paths.map((d, i) => <path key={i} d={d} />)}
    </g>
  );
  return (
    <svg viewBox={tagline ? VIEWBOX.full : VIEWBOX.word} height={height} role="img" aria-label="CR3D" style={{ display: "block", width: "auto", flex: "none" }}>
      {group(INK, "currentColor")}
      {group(ACCENT, "var(--brand)")}
      {tagline && group(TAGLINE, "currentColor")}
    </svg>
  );
}
