"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/api";
import { whatsappUrl } from "@/lib/config";
import { productEmoji, useShop } from "@/lib/shop";
import { ProductCard } from "../catalog/ProductCard";
import { Icon, ICONS } from "../Icon";
import { SectionHead } from "../ui/SectionHead";

const SHOWN = 8;

/** Primero lo más pedido y lo que tiene foto: es lo que mejor se entiende de un vistazo. */
const score = (p: CatalogProduct) => (p.images.length ? 4 : 0) + (p.badges.includes("mas_pedido") ? 2 : 0) + (p.badges.includes("viral") ? 1 : 0);

export function FeaturedCatalog() {
  const { collections, products, status } = useShop();
  const [filter, setFilter] = useState("");

  const list = useMemo(
    () => products.filter((p) => !filter || p.collection_id === filter).map((p, i) => ({ p, i }))
      .sort((a, b) => score(b.p) - score(a.p) || a.i - b.i).slice(0, SHOWN).map(({ p }) => p),
    [products, filter],
  );
  const groups = collections.filter((c) => products.some((p) => p.collection_id === c.id));

  return (
    <section id="catalogo" className="section" aria-labelledby="catalogo-title">
      <SectionHead id="catalogo-title" eyebrow="Catálogo" title="Elige una pieza lista para pedir"
        lead="Escoge el tamaño, el color y el acabado, agrégala a tu pedido y nos lo envías por WhatsApp. Así de fácil." />

      {groups.length > 1 && (
        <div className="chip-scroll" role="group" aria-label="Filtrar por categoría">
          <button type="button" className="filter-chip" aria-pressed={!filter} onClick={() => setFilter("")}>Todo</button>
          {groups.map((c) => (
            <button key={c.id} type="button" className="filter-chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      )}

      {status === "failed" && (
        <div className="status status-warn" style={{ marginBottom: 16 }}>
          <span>No pudimos cargar el catálogo en este momento. <a href={whatsappUrl("Hola, quiero ver el catálogo de piezas.")} target="_blank" rel="noopener noreferrer">Pídelo por WhatsApp</a> y te lo enviamos.</span>
        </div>
      )}

      <div className="product-grid">
        {status === "loading"
          ? Array.from({ length: 4 }, (_, i) => <div key={i} className="pcard-skeleton" aria-hidden="true" />)
          : list.map((p) => <ProductCard key={p.id} p={p} emoji={productEmoji(p, collections)} />)}
      </div>
      {status === "loading" && <p className="sr-only" role="status">Cargando productos…</p>}

      <div className="catalog-foot">
        {products.length > 0 && (
          <Link href="/catalogo" className="btn btn-outline btn-lg">
            Ver todo el catálogo{products.length > SHOWN ? ` (${products.length})` : ""}<Icon d={ICONS.arrow} size={18} stroke={2.2} />
          </Link>
        )}
        <div className="bridge">
          <span className="bridge-icon"><Icon d={ICONS.camera} size={22} stroke={2} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>¿No encuentras lo que buscas?</strong> Mándanos una foto o tu idea y la hacemos a tu medida.
          </span>
          <Link href="/#a-medida" className="btn btn-primary">Pedir con una foto</Link>
        </div>
      </div>
    </section>
  );
}
