import Link from "next/link";
import { Icon, ICONS } from "../Icon";

export function FinalCta() {
  return (
    <section className="section" aria-labelledby="cta-title" style={{ paddingTop: 0 }}>
      <div className="final-cta">
        <h2 id="cta-title">¿Tienes algo en mente?<br />Cuéntanos y lo imprimimos.</h2>
        <p>Una foto basta para empezar. Te respondemos por WhatsApp con el precio, sin compromiso.</p>
        <div className="final-ctas">
          <Link href="/#a-medida" className="btn btn-light btn-xl"><Icon d={ICONS.camera} size={20} stroke={2} />Pedir algo con una foto</Link>
          <Link href="/catalogo" className="btn btn-outline-light btn-xl"><Icon d={ICONS.grid} size={20} stroke={2} />Ver catálogo</Link>
        </div>
      </div>
    </section>
  );
}
