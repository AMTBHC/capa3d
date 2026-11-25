import type { Metadata } from "next";
import { PhotoRequestSection } from "@/components/home/PhotoRequestSection";
import { HowItWorks } from "@/components/home/HowItWorks";

export const metadata: Metadata = {
  title: "Pedido a medida con una foto · CR3D",
  description: "Mándanos una foto, un boceto o una descripción de lo que necesitas: lo diseñamos en 3D, lo revisamos contigo y lo imprimimos.",
};

export default function DesignsPage() {
  return (
    <main>
      <PhotoRequestSection />
      <HowItWorks />
    </main>
  );
}
