import type { Metadata } from "next";
import { DesignView } from "@/components/design/DesignView";

export const metadata: Metadata = {
  title: "Tu diseño · CR3D",
  robots: { index: false, follow: false },
};

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <DesignView id={id} token={one(sp.t)} isNew={one(sp.nuevo) === "1"} />;
}
