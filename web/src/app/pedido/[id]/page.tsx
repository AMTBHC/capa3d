import type { Metadata } from "next";
import { OrderView } from "@/components/order/OrderView";

export const metadata: Metadata = {
  title: "Tu pedido · Capa3D",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  // Wompi agrega ?id=<transacción> al volver del pago.
  return <OrderView id={id} token={one(sp.t)} transactionId={one(sp.id)} />;
}
