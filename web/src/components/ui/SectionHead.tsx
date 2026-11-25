import type { ReactNode } from "react";

/** Encabezado de sección: etiqueta, título y bajada. */
export function SectionHead({ eyebrow, title, lead, center = false, id }: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
  /** id del título, para aria-labelledby de la sección. */
  id?: string;
}) {
  return (
    <div className="sec-head" data-center={center || undefined}>
      <span className="eyebrow-pill">{eyebrow}</span>
      <h2 id={id} className="sec-title">{title}</h2>
      {lead && <p className="sec-lead">{lead}</p>}
    </div>
  );
}
