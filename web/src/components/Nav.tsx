import { Icon, ICONS } from "./Icon";

const LINKS = [
  ["#quote", "Cotizador"],
  ["#work", "Galería"],
  ["#materiales", "Materiales"],
  ["#how", "Proceso"],
];

export function Nav() {
  return (
    <header className="wrap" style={{ paddingTop: 18 }}>
      <nav
        aria-label="Principal"
        style={{
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px 12px 20px", borderRadius: 20, background: "rgba(20,20,23,.7)",
          backdropFilter: "blur(14px)", border: "1px solid var(--line)",
        }}
      >
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.layers} size={20} stroke={2} />
          </span>
          <span className="display" style={{ fontWeight: 700, fontSize: 20, letterSpacing: -0.5 }}>Capa3D</span>
        </a>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 14 }}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ padding: "10px 14px", textDecoration: "none", color: "var(--text-2)" }}>{label}</a>
          ))}
        </div>
        <a className="btn btn-primary" href="#quote" style={{ padding: "12px 20px", borderRadius: 12, fontSize: 14 }}>Cotizar ahora</a>
      </nav>
    </header>
  );
}
