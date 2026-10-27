import { Icon, ICONS } from "./Icon";
import { SectionHeader } from "./SectionHeader";

const SMALL = [
  [ICONS.check, "Revisión de archivo", "Verificamos que tu modelo se pueda imprimir y te avisamos si hay que ajustar algo."],
  [ICONS.cycle, "Prototipos que iteran", "Corrige el diseño y vuelve a imprimir hasta que la pieza encaje como necesitas."],
  [ICONS.stack, "Cuatro materiales", "PLA, PETG, ABS y TPU: del prototipo rápido a la pieza que aguanta uso real."],
  [ICONS.box, "Empaque cuidado", "Tus piezas llegan protegidas. [TUS COBERTURAS DE ENVÍO]"],
  [ICONS.chat, "Hablas con quien imprime", "Asesoría directa por WhatsApp, antes y después de tu pedido."],
];

const cardBase = { borderRadius: 28, background: "var(--surface-2)", border: "1px solid var(--line)", minWidth: 0 } as const;

export function Features() {
  return (
    <section className="section">
      <SectionHeader eyebrow="// POR QUÉ CAPA3D" title="Del archivo a la pieza, sin complicaciones" lead="Un proceso claro para que sepas qué recibes, cuánto cuesta y cuándo llega." />
      <div className="row" style={{ gap: 20 }}>
        <div className="tilt" style={{ ...cardBase, flex: "2 1 520px", minHeight: 300, position: "relative", overflow: "hidden", padding: 36, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div aria-hidden="true" style={{ position: "absolute", right: -40, top: -30, width: 360, height: 300, background: "repeating-linear-gradient(0deg,var(--ac-line) 0 2px,transparent 2px 9px)", WebkitMaskImage: "radial-gradient(circle at 60% 40%,#000,transparent 70%)", maskImage: "radial-gradient(circle at 60% 40%,#000,transparent 70%)" }} />
          <div style={{ position: "relative", width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.bolt} size={28} />
          </div>
          <h3 style={{ position: "relative", fontSize: 30, margin: "24px 0 10px", letterSpacing: -0.5 }}>Precio al instante</h3>
          <p style={{ position: "relative", margin: 0, color: "var(--text-3)", fontSize: 17, lineHeight: 1.6, maxWidth: 440 }}>
            Sube tu modelo, elige material, calidad y color, y ve el precio y el tiempo antes de pedir. Sin esperar correos.
          </p>
        </div>
        {SMALL.map(([icon, title, text]) => (
          <div key={title} className="tilt" style={{ ...cardBase, flex: "1 1 260px", padding: 30 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--ac-glow)", color: "var(--ac)", background: "var(--ac-soft)" }}>
              <Icon d={icon} />
            </div>
            <h3 style={{ fontSize: 19, margin: "22px 0 8px" }}>{title}</h3>
            <p style={{ margin: 0, color: "var(--text-3)", lineHeight: 1.6 }}>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
