import type { ReactNode } from "react";

interface Props {
  id?: string;
  n: number;
  title: string;
  sub?: string;
  done?: boolean;
  children: ReactNode;
}

/** Paso numerado del cotizador. */
export function StepCard({ id, n, title, sub, done, children }: Props) {
  return (
    <section id={id} className="step" aria-labelledby={id ? `${id}-t` : undefined}>
      <div className="step-head">
        <span className="step-n" data-done={done ? "true" : undefined} aria-hidden="true">{done ? "✓" : n}</span>
        <div style={{ minWidth: 0 }}>
          <h3 id={id ? `${id}-t` : undefined} className="step-title">{title}</h3>
          {sub && <p className="step-sub">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
