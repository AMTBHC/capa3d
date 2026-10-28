import type { Metadata } from "next";
import { MyOrders } from "@/components/order/MyOrders";

export const metadata: Metadata = {
  title: "Mis pedidos · Capa3D",
  robots: { index: false, follow: false },
};

export default function MyOrdersPage() {
  return <MyOrders />;
}
