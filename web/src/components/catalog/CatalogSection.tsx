"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { listCollections, type CatalogCollection } from "@/lib/api";
import { SectionHeader } from "../SectionHeader";
import { CollectionCard, grid } from "./Cards";

/** Sección del catálogo en la página principal; no se muestra si aún no hay productos publicados. */
export function CatalogSection() {
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  useEffect(() => {
    if (!API_URL) return;
    listCollections().then(setCollections, () => {});
  }, []);
  if (!collections.length) return null;
  return (
    <section id="catalogo" className="section">
      <SectionHeader
        eyebrow="// CATÁLOGO"
        title="Elige algo listo para imprimir"
        lead="Piezas probadas que imprimimos en el color y el tamaño que quieras. ¿Ya tienes tu archivo? Más abajo lo cotizas."
      />
      <div style={grid}>
        {collections.slice(0, 8).map((c) => <CollectionCard key={c.id} c={c} />)}
      </div>
      {collections.length > 8 && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn btn-ghost" href="/catalogo" style={{ padding: "14px 24px", borderRadius: 14 }}>Ver todo el catálogo</Link>
        </div>
      )}
    </section>
  );
}
