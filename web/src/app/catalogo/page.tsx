import type { Metadata } from "next";
import { CatalogIndex } from "@/components/catalog/CatalogIndex";

export const metadata: Metadata = {
  title: "Catálogo · Capa3D",
  description: "Piezas listas para imprimir en 3D: llaveros, flexibles, decoración, organizadores y regalos personalizados.",
};

export default function CatalogPage() {
  return <CatalogIndex />;
}
