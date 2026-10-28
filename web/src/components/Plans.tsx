import { Icon, ICONS } from "./Icon";
import { SectionHeader } from "./SectionHeader";

interface Plan {
  label: string;
  name: string;
  sub: string;
  price: string;
  items: string[];
  featured?: boolean;
}

const PLANS: Plan[] = [
  { label: "PLAN", name: "Prueba", sub: "Una pieza para validar tu idea", price: "[TU PRECIO]", items: ["1 pieza en PLA o PETG", "Revisión de archivo", "Color a elección"] },
  { label: "EL MÁS PEDIDO POR EMPRENDEDORES", name: "Prototipo", sub: "Iteraciones hasta acertar", price: "[TU PRECIO]", items: ["Varias versiones de tu diseño", "Los cuatro materiales", "Asesoría por WhatsApp"], featured: true },
  { label: "PLAN", name: "Lotes", sub: "Producción por cantidad", price: "[TU PRECIO]", items: ["Precio por unidad que baja con el volumen", "Acabado consistente", "Entrega programada"] },
];

export function Plans() {
  return (
    <section id="planes" className="section">
      <SectionHeader eyebrow="// OPCIONES" title="Elige cómo quieres imprimir" lead="Desde una sola pieza de prueba hasta producción por lotes." />
      <div className="row" style={{ gap: 24, alignItems: "stretch" }}>
        {PLANS.map((p) => (
          <div key={p.name} className="pcard"
            style={p.featured
              ? { flex: "1 1 300px", minWidth: 0, borderRadius: 28, padding: 2, background: "var(--text)", boxShadow: "var(--shadow-lg)" }
              : { flex: "1 1 300px", minWidth: 0, borderRadius: 28, padding: 1, background: "var(--line-2)" }}>
            <div style={{ position: "relative", height: "100%", borderRadius: 26, background: "var(--surface)", padding: 34, display: "flex", flexDirection: "column" }}>
              <span className="mono" style={p.featured
                ? { alignSelf: "flex-start", padding: "5px 12px", borderRadius: 99, background: "var(--ac)", color: "var(--bg)", fontSize: 11, fontWeight: 500, letterSpacing: 1, marginBottom: 14 }
                : { fontSize: 11, letterSpacing: 1, color: "var(--text-3)", marginBottom: 14 }}>{p.label}</span>
              <h3 style={{ margin: 0, fontSize: 28 }}>{p.name}</h3>
              <p style={{ margin: "8px 0 24px", color: "var(--text-3)" }}>{p.sub}</p>
              <div className="display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 24 }}>{p.price}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, marginBottom: 30 }}>
                {p.items.map((it) => (
                  <span key={it} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--text-2)" }}>
                    <span style={{ color: "var(--ac)", flex: "none" }}><Icon d={ICONS.check} size={20} /></span>{it}
                  </span>
                ))}
              </div>
              <a className={`btn ${p.featured ? "btn-primary" : "btn-ghost"}`} href="#quote" style={{ textAlign: "center", padding: 16, borderRadius: 14, fontWeight: 600 }}>Cotizar</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
