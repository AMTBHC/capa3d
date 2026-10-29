/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Icon } from "./Icon";
import { SectionHeader } from "./SectionHeader";

const POINTS = [
  "Figuras de mascotas, personajes o personas a partir de fotos",
  "Repuestos y piezas que ya no se consiguen",
  "Regalos, trofeos, letreros y llaveros con tu idea",
];

/** Diseño a medida en la página principal: para quien no tiene el archivo 3D. */
export function DesignSection() {
  return (
    <section id="diseno" className="section">
      <div className="row" style={{ gap: 32, alignItems: "center" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <SectionHeader
            eyebrow="// DISEÑO A MEDIDA"
            title="¿No tienes el archivo? Mándanos una foto."
            lead="Nos envías fotos o un boceto de lo que imaginas, lo modelamos en 3D y te lo imprimimos. Te mostramos la propuesta antes de pagar."
            mb={20}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", display: "flex", flexDirection: "column", gap: 10 }}>
            {POINTS.map((p) => (
              <li key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, color: "var(--text-2)" }}>
                <span style={{ color: "var(--ac)", marginTop: 1 }}><Icon d="M4 12l5 5L20 6" size={18} stroke={2.2} /></span>
                {p}
              </li>
            ))}
          </ul>
          <Link className="btn btn-primary" href="/disenos" style={{ padding: "16px 26px", borderRadius: 14 }}>Pedir mi diseño</Link>
        </div>
        <div aria-hidden="true" style={{ flex: "1 1 380px", minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...tile, border: "1.5px dashed var(--line-3)", background: "var(--surface-3)" }}>
            <img src="/img/pieza-cruda.svg" alt="" style={{ width: "70%", opacity: 0.55, filter: "grayscale(1)" }} />
            <span style={caption}>Tu foto o boceto</span>
          </div>
          <span style={{ color: "var(--ac)", flex: "none" }}><Icon d="M5 12h14 M13 6l6 6-6 6" size={28} stroke={2} /></span>
          <div style={{ ...tile, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            <img src="/img/pieza-acabada.svg" alt="" style={{ width: "70%" }} />
            <span style={caption}>Tu pieza impresa</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const tile = {
  flex: 1, aspectRatio: "1", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: 10, minWidth: 0,
} as const;
const caption = { fontSize: 13, fontWeight: 600, color: "var(--text-2)" } as const;
