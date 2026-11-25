"use client";
/* eslint-disable @next/next/no-img-element -- fotos servidas por la API o locales */

import { useEffect, useState } from "react";
import { getFeatured } from "@/lib/api";
import { REAL_WORKS } from "@/lib/content";
import { DEMO, productImage } from "@/lib/shop";
import { Icon, ICONS } from "../Icon";
import { SectionHead } from "../ui/SectionHead";

interface Work {
  src: string;
  title: string;
  caption: string;
}

const MAX = 8;

/** Ilustraciones de muestra, solo cuando el sitio corre sin la API ni fotos propias. */
const DEMO_WORKS: Work[] = [
  { src: "/img/pieza-acabada.svg", title: "Repuesto a medida", caption: "Desde una foto de la pieza rota" },
  { src: "/img/engranaje.svg", title: "Engranaje", caption: "Repuesto funcional" },
  { src: "/img/jarron.svg", title: "Jarrón en espiral", caption: "Decoración" },
];

const PROMISES = [
  { icon: ICONS.shield, title: "Revisamos contigo", text: "Medidas y diseño aprobados antes de imprimir." },
  { icon: ICONS.check, title: "Pieza revisada", text: "Cada pieza se limpia y revisa antes de enviarse." },
  { icon: ICONS.truck, title: "Envíos a toda Colombia", text: "Con transportadora, bien empacado." },
  { icon: ICONS.chat, title: "Atención por WhatsApp", text: "Hablas con una persona, no con un robot." },
];

/** Prueba social: fotos de trabajos reales (o del catálogo) y lo que prometemos. */
export function Works() {
  const [works, setWorks] = useState<Work[]>(REAL_WORKS.length ? REAL_WORKS : DEMO ? DEMO_WORKS : []);

  useEffect(() => {
    if (REAL_WORKS.length || DEMO) return;
    getFeatured(MAX).then(
      (ps) => setWorks(ps.flatMap((p) => {
        const src = productImage(p);
        return src ? [{ src, title: p.name, caption: p.subsection }] : [];
      })),
      () => {},
    );
  }, []);

  return (
    <section id="trabajos" className="section" aria-labelledby="trabajos-title">
      <SectionHead id="trabajos-title" eyebrow="Trabajos realizados" title="Lo que ya hemos impreso"
        lead="Repuestos, regalos, decoración y piezas para negocios. Todo impreso y revisado en nuestro taller." />
      {works.length > 0 && (
        // Hasta 4 columnas en computador; con pocas fotos, una columna por foto.
        <div className="works-grid" style={{ "--cols": Math.min(4, works.length) } as React.CSSProperties}>
          {works.slice(0, MAX).map((w) => (
            <figure key={w.src} className="work">
              <img src={w.src} alt={w.title} loading="lazy" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).hidden = true; }} />
              <figcaption><strong>{w.title}</strong>{w.caption && <span>{w.caption}</span>}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <ul className="promises">
        {PROMISES.map((p) => (
          <li key={p.title}>
            <span className="promise-icon"><Icon d={p.icon} size={22} stroke={2} /></span>
            <span><strong>{p.title}</strong><span>{p.text}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
