/* eslint-disable @next/next/no-img-element */
import { whatsappUrl } from "@/lib/config";
import { WhatsAppIcon } from "./WhatsAppIcon";

export function Cta() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div style={{ position: "relative", borderRadius: 32, border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}>
        <div style={{ position: "relative", borderRadius: 32, background: "var(--surface)", padding: "72px 32px", textAlign: "center", overflow: "hidden" }}>
          <img className="flo" src="/img/engranaje.svg" alt="" style={{ position: "absolute", left: -30, top: 20, width: 220, opacity: 0.85 }} />
          <img className="flo" src="/img/jarron.svg" alt="" style={{ position: "absolute", right: -30, bottom: 10, width: 220, opacity: 0.85, animationDelay: "-2.5s" }} />
          <h2 style={{ position: "relative", fontSize: "clamp(30px,5.4vw,64px)", lineHeight: 1.02, margin: "0 0 18px", letterSpacing: "-0.035em" }}>¿Tienes una pieza<br />en mente?</h2>
          <p style={{ position: "relative", fontSize: 18, color: "var(--text-2)", margin: "0 auto 34px", maxWidth: 560, lineHeight: 1.6 }}>
            Sube tu archivo y recibe tu cotización ahora, o escríbenos y la armamos juntos.
          </p>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <a className="btn btn-primary glow" href="#quote" style={{ padding: "18px 30px", borderRadius: 16 }}>Cotizar mi pieza</a>
            <a className="btn btn-ghost" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 30px", borderRadius: 16 }}>
              <WhatsAppIcon size={20} />Escribir por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
