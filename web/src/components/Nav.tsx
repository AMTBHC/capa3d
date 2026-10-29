import Link from "next/link";
import { AdminShortcut } from "./AdminShortcut";
import { Logo } from "./brand/Logo";

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
          padding: "12px 14px 12px 20px", borderRadius: 20, background: "var(--glass)",
          backdropFilter: "blur(14px)", border: "1px solid var(--line)",
        }}
      >
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo height={22} />
        </a>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 14 }}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ padding: "10px 14px", textDecoration: "none", color: "var(--text-2)" }}>{label}</a>
          ))}
          <Link href="/catalogo" style={{ padding: "10px 14px", textDecoration: "none", color: "var(--text-2)" }}>Catálogo</Link>
          <Link href="/mis-pedidos" style={{ padding: "10px 14px", textDecoration: "none", color: "var(--text-2)" }}>Mis pedidos</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AdminShortcut />
          <a className="btn btn-primary" href="#quote" style={{ padding: "12px 20px", borderRadius: 12, fontSize: 14 }}>Cotizar ahora</a>
        </div>
      </nav>
    </header>
  );
}
