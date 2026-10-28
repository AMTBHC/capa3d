import type { Metadata } from "next";
import { CollectionView } from "@/components/catalog/CollectionView";

export const metadata: Metadata = { title: "Catálogo · Capa3D" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionView id={id} />;
}
