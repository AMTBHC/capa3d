/* eslint-disable @next/next/no-img-element */
import { whatsappUrl } from "@/lib/config";

export function Cta() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 32, padding: 2 }}>
        <div aria-hidden="true" className="rot" style={{ position: "absolute", left: "-50%", top: "-50%", width: "200%", height: "200%", background: "conic-gradient(var(--ac),transparent 20%,transparent 50%,var(--ac) 70%,transparent 90%)" }} />
        <div style={{ position: "relative", borderRadius: 30, background: "var(--surface)", padding: "72px 32px", textAlign: "center", overflow: "hidden" }}>
          <img className="flo" src="/img/engranaje.svg" alt="" style={{ position: "absolute", left: -30, top: 20, width: 220, opacity: 0.85 }} />
          <img className="flo" src="/img/jarron.svg" alt="" style={{ position: "absolute", right: -30, bottom: 10, width: 220, opacity: 0.85, animationDelay: "-2.5s" }} />
          <h2 style={{ position: "relative", fontSize: "clamp(30px,5.4vw,64px)", lineHeight: 1.02, margin: "0 0 18px", letterSpacing: -2 }}>¿Tienes una pieza<br />en mente?</h2>
          <p style={{ position: "relative", fontSize: 18, color: "var(--text-2)", margin: "0 auto 34px", maxWidth: 560, lineHeight: 1.6 }}>
            Sube tu archivo y recibe tu cotización ahora, o escríbenos y la armamos juntos.
          </p>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <a className="btn btn-primary glow" href="#quote" style={{ padding: "18px 30px", borderRadius: 16 }}>Cotizar mi pieza</a>
            <a className="btn btn-ghost" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" style={{ padding: "18px 30px", borderRadius: 16 }}>Escribir por WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  );
}
