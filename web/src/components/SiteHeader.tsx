import Link from "next/link";
import { AdminShortcut } from "./AdminShortcut";
import { Logo } from "./brand/Logo";

/** Encabezado de las páginas internas (catálogo, producto, pedidos). */
export function SiteHeader() {
  return (
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <Logo height={22} />
      </Link>
      <nav aria-label="Secciones" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Link className="chip-btn" href="/catalogo" style={{ textDecoration: "none" }}>Catálogo</Link>
        <Link className="chip-btn" href="/#quote" style={{ textDecoration: "none" }}>Cotizar mi archivo</Link>
        <Link className="chip-btn" href="/disenos" style={{ textDecoration: "none" }}>Diseño a medida</Link>
        <Link className="chip-btn" href="/mis-pedidos" style={{ textDecoration: "none" }}>Mis pedidos</Link>
        <AdminShortcut />
      </nav>
    </header>
  );
}
