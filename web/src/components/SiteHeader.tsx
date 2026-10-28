import Link from "next/link";
import { AdminShortcut } from "./AdminShortcut";
import { Icon, ICONS } from "./Icon";

/** Encabezado de las páginas internas (catálogo, producto, pedidos). */
export function SiteHeader() {
  return (
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
          <Icon d={ICONS.layers} size={20} stroke={2} />
        </span>
        <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Capa3D</span>
      </Link>
      <nav aria-label="Secciones" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Link className="chip-btn" href="/catalogo" style={{ textDecoration: "none" }}>Catálogo</Link>
        <Link className="chip-btn" href="/#quote" style={{ textDecoration: "none" }}>Cotizar mi archivo</Link>
        <Link className="chip-btn" href="/mis-pedidos" style={{ textDecoration: "none" }}>Mis pedidos</Link>
        <AdminShortcut />
      </nav>
    </header>
  );
}
