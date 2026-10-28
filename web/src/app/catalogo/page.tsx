import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";

export const metadata: Metadata = {
  title: "Catálogo · Capa3D",
  description: "Piezas listas para imprimir en 3D: llaveros, flexibles, decoración, organizadores y regalos personalizados.",
};

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogBrowser />
    </Suspense>
  );
}
