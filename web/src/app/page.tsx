import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Features } from "@/components/Features";
import { Quoter } from "@/components/quoter/Quoter";
import { Gallery } from "@/components/Gallery";
import { Materials } from "@/components/Materials";
import { Process } from "@/components/Process";
import { Plans } from "@/components/Plans";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { CatalogSection } from "@/components/catalog/CatalogSection";

export default function Home() {
  return (
    <div className="page">
      <div
        aria-hidden="true"
        style={{
          position: "absolute", zIndex: -1, inset: "0 0 auto 0", height: 900,
          backgroundImage:
            "linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 30%,#000 20%,transparent 70%)",
          maskImage: "radial-gradient(ellipse at 70% 30%,#000 20%,transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", zIndex: -1, right: -200, top: -200, width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle,var(--ac-soft),transparent 65%)",
        }}
      />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <CatalogSection />
        <Features />
        <Quoter />
        <Gallery />
        <Materials />
        <Process />
        <Plans />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
}
