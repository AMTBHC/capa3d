import type { Metadata } from "next";
import { ProductView } from "@/components/catalog/ProductView";

export const metadata: Metadata = { title: "Producto · Capa3D" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductView id={id} />;
}
