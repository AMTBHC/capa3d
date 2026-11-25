/* eslint-disable @next/next/no-img-element -- ilustraciones SVG locales */
import Link from "next/link";
import { HERO } from "@/lib/content";
import { Icon, ICONS } from "../Icon";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-in">
        <div className="hero-copy">
          <span className="eyebrow-pill"><span className="dot" aria-hidden="true" />{HERO.eyebrow}</span>
          <h1 id="hero-title" className="hero-title">
            {HERO.titleLead} <span>{HERO.titleHighlight}</span>
          </h1>
          <p className="hero-lead">{HERO.lead}</p>
          <div className="hero-ctas">
            <Link href="/#catalogo" className="btn btn-primary btn-xl">
              <Icon d={ICONS.grid} size={20} stroke={2} />{HERO.primary}
            </Link>
            <Link href="/#a-medida" className="btn btn-outline btn-xl">
              <Icon d={ICONS.camera} size={20} stroke={2} />{HERO.secondary}
            </Link>
          </div>
          <ul className="hero-trust">
            {HERO.trust.map((t) => (
              <li key={t}><span className="tick"><Icon d={ICONS.check} size={14} stroke={3} /></span>{t}</li>
            ))}
          </ul>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hv-card hv-photo">
            <span className="hv-label"><Icon d={ICONS.camera} size={14} stroke={2.2} />Tu foto</span>
            <img src="/img/pieza-cruda.svg" alt="" />
            <span className="hv-ruler" />
          </div>
          <span className="hv-arrow"><Icon d={ICONS.arrow} size={22} stroke={2.4} /></span>
          <div className="hv-card hv-final">
            <span className="hv-label hv-label-ac"><Icon d={ICONS.check} size={14} stroke={3} />Tu pieza impresa</span>
            <img src="/img/pieza-acabada.svg" alt="" />
          </div>
          <div className="hv-chips">
            <span className="hv-chip"><Icon d={ICONS.ruler} size={16} stroke={2} />Medidas revisadas contigo</span>
            <span className="hv-chip"><Icon d={ICONS.truck} size={16} stroke={2} />Enviado a tu casa</span>
          </div>
        </div>
      </div>
    </section>
  );
}
