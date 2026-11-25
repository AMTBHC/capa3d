import { REASSURANCE, REQUEST_TYPES } from "@/lib/content";
import { PhotoRequestForm } from "../design/PhotoRequestForm";
import { Icon, ICONS } from "../Icon";
import { SectionHead } from "../ui/SectionHead";

/** "Mándanos tu foto o idea": el camino para quien no encuentra su pieza en el catálogo. */
export function PhotoRequestSection() {
  return (
    <section id="a-medida" className="section section-tint" aria-labelledby="a-medida-title">
      <div className="request-grid">
        <div className="request-copy">
          <SectionHead id="a-medida-title" eyebrow="Pedido a medida" title="¿No está en el catálogo? Mándanos una foto o tu idea."
            lead="Una pieza rota, un repuesto que ya no venden, una figura, una maqueta o algo que imaginaste. Con una foto, un dibujo o unas líneas nos basta." />
          <div className="reassure reassure-lg">
            <Icon d={ICONS.shield} size={26} stroke={2} />
            <p>{REASSURANCE}</p>
          </div>
          <ul className="examples">
            {REQUEST_TYPES.slice(0, 4).map((t) => (
              <li key={t.use}>
                <span className="examples-emoji" aria-hidden="true">{t.emoji}</span>
                <span><strong>{t.label}</strong><span className="muted"> · {t.hint}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <PhotoRequestForm />
      </div>
    </section>
  );
}
