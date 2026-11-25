import Link from "next/link";
import { HOW_STEPS } from "@/lib/content";
import { Icon, ICONS } from "../Icon";
import { SectionHead } from "../ui/SectionHead";

export function HowItWorks() {
  return (
    <section id="como-funciona" className="section" aria-labelledby="como-title">
      <SectionHead id="como-title" eyebrow="Cómo funciona" title="Tu pieza en 3 pasos" center
        lead="Sin archivos, sin términos técnicos. Hablas con una persona que te acompaña de principio a fin." />
      <ol className="how-grid">
        {HOW_STEPS.map((s, i) => (
          <li key={s.title} className="how-card">
            <span className="how-top">
              <span className="how-icon"><Icon d={s.icon} size={26} stroke={1.9} /></span>
              <span className="how-n">Paso {i + 1}</span>
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="how-ctas">
        <Link href="/#catalogo" className="btn btn-primary btn-lg"><Icon d={ICONS.grid} size={18} stroke={2} />Ver catálogo</Link>
        <Link href="/#a-medida" className="btn btn-outline btn-lg"><Icon d={ICONS.camera} size={18} stroke={2} />Pedir algo con una foto</Link>
      </div>
    </section>
  );
}
