import { redirect } from "next/navigation";

/** Enlaces viejos a una colección: el catálogo la muestra filtrada. */
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/catalogo?c=${encodeURIComponent(id)}`);
}
