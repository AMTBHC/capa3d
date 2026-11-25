import { Hero } from "@/components/home/Hero";
import { FeaturedCatalog } from "@/components/home/FeaturedCatalog";
import { PhotoRequestSection } from "@/components/home/PhotoRequestSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Works } from "@/components/home/Works";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

/**
 * Portada: dos caminos claros, sin archivos 3D ni términos técnicos.
 *   1. Elegir del catálogo → "Mi pedido" → WhatsApp.
 *   2. Mandar una foto o idea → lo diseñamos y lo revisamos contigo.
 * El cotizador de archivos queda en /cotizar, para quien ya tiene su modelo.
 */
export default function Home() {
  return (
    <main>
      <Hero />
      <FeaturedCatalog />
      <PhotoRequestSection />
      <HowItWorks />
      <Works />
      <Faq />
      <FinalCta />
    </main>
  );
}
