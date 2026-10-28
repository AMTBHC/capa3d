"use client";

import { useEffect, useState } from "react";
import { listCollections, type CatalogCollection } from "@/lib/api";
import { SiteHeader } from "../SiteHeader";
import { CollectionCard, grid } from "./Cards";

export function CatalogIndex() {
  const [collections, setCollections] = useState<CatalogCollection[] | null>(null);
  useEffect(() => {
    listCollections().then(setCollections, () => setCollections([]));
  }, []);
  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <SiteHeader />
      <h1 className="h2" style={{ margin: "0 0 8px" }}>Catálogo</h1>
      <p className="lead" style={{ margin: "0 0 28px" }}>Piezas listas para imprimir en el color y tamaño que elijas.</p>
      {collections === null && <div className="status status-info"><span className="spin" /> Cargando…</div>}
      {collections?.length === 0 && <div className="status status-info">Estamos preparando el catálogo. Mientras tanto, cotiza tu propio archivo.</div>}
      <div style={grid}>{collections?.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
    </main>
  );
}
