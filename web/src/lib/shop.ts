"use client";

import { useEffect, useState } from "react";
import { imageUrl, listCollections, listProducts, type CatalogCollection, type CatalogProduct } from "./api";
import { API_URL } from "./config";

/** El catálogo es de muestra cuando el sitio corre sin la API (solo para probar el diseño). */
export const DEMO = !API_URL;

const DEMO_COLLECTIONS: CatalogCollection[] = [
  { id: "hogar", name: "Hogar y decoración", emoji: "🪴", description: "", cover: null, count: 3, price_from: 25000 },
  { id: "regalos", name: "Regalos y llaveros", emoji: "🎁", description: "", cover: null, count: 2, price_from: 8000 },
  { id: "oficina", name: "Oficina", emoji: "🗂️", description: "", cover: null, count: 2, price_from: 18000 },
  { id: "repuestos", name: "Repuestos", emoji: "🔧", description: "", cover: null, count: 1, price_from: 12000 },
];

const SIZES = [{ label: "S", scale: 75 }, { label: "M", scale: 100 }, { label: "L", scale: 150 }];

const demo = (p: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "collection_id" | "name" | "subsection" | "price_from">): CatalogProduct => ({
  kind: "model", description: "", badges: [], images: [], sizes: SIZES, default_color: "", file_id: null, personalize: null, ...p,
});

/** Productos de muestra con precios de ejemplo: con la API se reemplazan por tu catálogo real. */
const DEMO_PRODUCTS: CatalogProduct[] = [
  demo({ id: "demo-matera", collection_id: "hogar", name: "Matera geométrica", subsection: "Decoración", price_from: 25000, badges: ["mas_pedido"] }),
  demo({ id: "demo-llavero", collection_id: "regalos", name: "Llavero con tu nombre", subsection: "Llaveros", price_from: 8000, kind: "name_keychain", personalize: { max_length: 14 }, sizes: [{ label: "Normal", scale: 100 }] }),
  demo({ id: "demo-jarron", collection_id: "hogar", name: "Jarrón en espiral", subsection: "Decoración", price_from: 40000, images: ["/img/jarron.svg"], badges: ["nuevo"] }),
  demo({ id: "demo-organizador", collection_id: "oficina", name: "Organizador de escritorio", subsection: "Escritorio", price_from: 30000 }),
  demo({ id: "demo-engranaje", collection_id: "repuestos", name: "Engranaje de repuesto", subsection: "Repuestos", price_from: 12000, images: ["/img/engranaje.svg"] }),
  demo({ id: "demo-dragon", collection_id: "regalos", name: "Dragón articulado", subsection: "Juguetes", price_from: 35000, badges: ["viral"] }),
  demo({ id: "demo-soporte", collection_id: "oficina", name: "Soporte para celular", subsection: "Escritorio", price_from: 18000 }),
  demo({ id: "demo-lampara", collection_id: "hogar", name: "Lámpara luna", subsection: "Lámparas", price_from: 45000 }),
];

const DEMO_EMOJI: Record<string, string> = {
  "demo-matera": "🪴", "demo-llavero": "🔑", "demo-organizador": "🗂️", "demo-dragon": "🐉", "demo-soporte": "📱", "demo-lampara": "🌙",
};

export interface Shop {
  collections: CatalogCollection[];
  products: CatalogProduct[];
  status: "loading" | "ready" | "failed";
}

/** Colecciones y productos visibles: de la API, o de muestra si el sitio corre sin ella. */
export function useShop(): Shop {
  const [shop, setShop] = useState<Shop>(() =>
    DEMO ? { collections: DEMO_COLLECTIONS, products: DEMO_PRODUCTS, status: "ready" } : { collections: [], products: [], status: "loading" },
  );
  useEffect(() => {
    if (DEMO) return;
    Promise.all([listCollections(), listProducts()]).then(
      ([collections, products]) => setShop({ collections, products, status: "ready" }),
      () => setShop((s) => ({ ...s, status: "failed" })),
    );
  }, []);
  return shop;
}

/** Foto principal del producto (las de muestra viven en /public). */
export function productImage(p: CatalogProduct): string | null {
  const img = p.images[0];
  if (!img) return null;
  return img.startsWith("/") ? img : imageUrl(img);
}

export function productEmoji(p: CatalogProduct, collections: CatalogCollection[]): string {
  if (p.kind === "name_keychain") return "🔑";
  return DEMO_EMOJI[p.id] ?? collections.find((c) => c.id === p.collection_id)?.emoji ?? "🧩";
}
