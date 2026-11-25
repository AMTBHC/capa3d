import { whatsappUrl } from "@/lib/config";
import { FAQS } from "@/lib/content";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { SectionHead } from "../ui/SectionHead";

export function Faq() {
  return (
    <section id="preguntas" className="section section-narrow" aria-labelledby="preguntas-title">
      <SectionHead id="preguntas-title" eyebrow="Preguntas frecuentes" title="Resolvemos tus dudas" center />
      <div className="faq">
        {FAQS.map(([q, a], i) => (
          <details key={q} className="faq-item" open={i === 0}>
            <summary>
              <span>{q}</span>
              <span className="faq-plus" aria-hidden="true" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <div className="faq-more">
        <span>¿Tienes otra pregunta?</span>
        <a className="btn btn-wa" href={whatsappUrl("Hola, tengo una pregunta sobre impresión 3D.")} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon size={18} />Pregúntanos por WhatsApp
        </a>
      </div>
    </section>
  );
}
