import type { Metadata } from "next";
import { DesignForm } from "@/components/design/DesignForm";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatsAppFab } from "@/components/WhatsAppFab";

export const metadata: Metadata = {
  title: "Diseño a medida · CR3D",
  description: "Envíanos fotos o bocetos de lo que imaginas: lo diseñamos en 3D y lo imprimimos para ti.",
};

const STEPS = [
  ["01", "Nos mandas tus referencias", "Fotos, bocetos o capturas, con una descripción y la medida que quieres."],
  ["02", "Te contactamos", "Afinamos detalles por WhatsApp o correo y te damos el precio del diseño y la impresión."],
  ["03", "Diseñamos tu modelo", "Te mostramos la propuesta; la ajustamos hasta que te guste."],
  ["04", "Pagas e imprimimos", "Te llega el enlace del pedido para pagar y lo enviamos a tu casa."],
];

export default function DesignsPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px 80px" }}>
      <SiteHeader />
      <span className="mono eyebrow">{"// DISEÑO A MEDIDA"}</span>
      <h1 className="h2" style={{ marginTop: 8 }}>Lo imaginas, lo diseñamos y lo imprimimos.</h1>
      <p className="lead" style={{ maxWidth: 680 }}>
        ¿No tienes el archivo 3D? Mándanos una foto o un boceto de la pieza que quieres —una figura, un repuesto, un regalo
        personalizado— y nuestro equipo la modela para imprimirla.
      </p>
      <div className="design-steps" style={{ margin: "24px 0 28px" }}>
        {STEPS.map(([n, title, text]) => (
          <div key={n}>
            <span className="mono" style={{ fontSize: 12, color: "var(--ac)" }}>{n}</span>
            <div className="display" style={{ fontWeight: 600, fontSize: 16, marginTop: 8 }}>{title}</div>
            <div style={{ fontSize: 14, color: "var(--text-3)", marginTop: 6, lineHeight: 1.5 }}>{text}</div>
          </div>
        ))}
      </div>
      <DesignForm />
      <WhatsAppFab />
    </main>
  );
}
