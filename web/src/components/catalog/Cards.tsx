/* eslint-disable @next/next/no-img-element -- imágenes servidas por la API */
import Link from "next/link";
import { BADGE_LABEL, imageUrl, type CatalogCollection, type CatalogProduct } from "@/lib/api";
import { money } from "@/lib/format";

/** Fondo cuando la colección o el producto aún no tiene foto. */
function Placeholder({ emoji }: { emoji: string }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, background: "radial-gradient(circle at 50% 40%, var(--ac-soft), transparent 65%), var(--surface-3)" }}>
      {emoji || "🧩"}
    </div>
  );
}

export function CollectionCard({ c }: { c: CatalogCollection }) {
  return (
    <Link href={`/catalogo/${c.id}`} className="tilt" style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--surface-3)" }}>
        {c.cover ? <img src={imageUrl(c.cover)} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Placeholder emoji={c.emoji} />}
        <span style={{ position: "absolute", top: 10, right: 10, padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: "var(--ac)", color: "var(--bg)" }}>Colección</span>
      </div>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.emoji} {c.name}</span>
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", fontSize: 12, color: "var(--text-3)", letterSpacing: 0.5 }}>
          <span>{c.count} {c.count === 1 ? "PRODUCTO" : "PRODUCTOS"}{c.price_from ? ` · DESDE $${money(c.price_from)}` : ""}</span>
          <span style={{ color: "var(--ac)", fontSize: 16 }} aria-hidden="true">›</span>
        </span>
      </div>
    </Link>
  );
}

export function ProductCard({ p, emoji }: { p: CatalogProduct; emoji: string }) {
  return (
    <Link href={`/producto/${p.id}`} className="tilt" style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)", textDecoration: "none", color: "var(--text)" }}>
      <div style={{ position: "relative", aspectRatio: "1 / 1" }}>
        {p.images[0] ? <img src={imageUrl(p.images[0])} alt={p.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Placeholder emoji={p.kind === "name_keychain" ? "🔑" : emoji} />}
        <span style={{ position: "absolute", top: 10, left: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.badges.map((b) => (
            <span key={b} style={{ padding: "4px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "rgba(11,11,13,.8)", border: "1px solid rgba(255,255,255,.15)" }}>{BADGE_LABEL[b]}</span>
          ))}
          {p.personalize && <span style={{ padding: "4px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "var(--ac)", color: "var(--bg)" }}>Con tu nombre</span>}
        </span>
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>{p.price_from ? <>Desde <strong style={{ color: "var(--text)" }}>${money(p.price_from)}</strong></> : "Precio al elegir tamaño"}</span>
      </div>
    </Link>
  );
}

export const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 } as const;
