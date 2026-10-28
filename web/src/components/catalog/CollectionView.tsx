"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCollection, type CatalogCollection, type CatalogProduct } from "@/lib/api";
import { SiteHeader } from "../SiteHeader";
import { grid, ProductCard } from "./Cards";

export function CollectionView({ id }: { id: string }) {
  const [data, setData] = useState<(CatalogCollection & { products: CatalogProduct[] }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [sub, setSub] = useState("");

  useEffect(() => {
    getCollection(id).then((c) => {
      setData(c);
      document.title = `${c.name} · Capa3D`;
    }, () => setMissing(true));
  }, [id]);

  const subsections = [...new Set(data?.products.map((p) => p.subsection).filter(Boolean))];
  const shown = data?.products.filter((p) => !sub || p.subsection === sub) ?? [];

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <SiteHeader />
      <nav aria-label="Ruta" style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 12 }}>
        <Link href="/catalogo" style={{ color: "var(--text-3)" }}>Catálogo</Link> › {data?.name ?? "…"}
      </nav>
      {missing && <div className="status status-warn">Esta colección no existe o ya no está disponible. <Link href="/catalogo">Ver el catálogo</Link></div>}
      {data && (
        <>
          <h1 className="h2" style={{ margin: "0 0 8px" }}>{data.emoji} {data.name}</h1>
          {data.description && <p className="lead" style={{ margin: "0 0 22px" }}>{data.description}</p>}
          {subsections.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <button className="chip-btn" aria-pressed={!sub} onClick={() => setSub("")}>Todo</button>
              {subsections.map((s) => <button key={s} className="chip-btn" aria-pressed={sub === s} onClick={() => setSub(s)}>{s}</button>)}
            </div>
          )}
          <div style={grid}>{shown.map((p) => <ProductCard key={p.id} p={p} emoji={data.emoji} />)}</div>
        </>
      )}
    </main>
  );
}
