const WORDS = ["PLA", "PETG", "ABS", "TPU", "PROTOTIPOS", "REPUESTOS", "MINIATURAS", "DECORACIÓN"];

export function Marquee() {
  const items = [...WORDS, ...WORDS];
  return (
    <div aria-hidden="true" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "22px 0", overflow: "hidden", background: "var(--bg-2)" }}>
      <div className="marq display" style={{ display: "flex", width: "max-content", fontWeight: 700, fontSize: "clamp(26px,4vw,44px)", whiteSpace: "nowrap" }}>
        {items.map((w, i) => (
          <span key={i} style={{ display: "contents" }}>
            <span style={{ padding: "0 24px", ...(i % 2 === 0 ? { color: "var(--ac)" } : { color: "transparent", WebkitTextStroke: "1px rgba(242,242,238,.45)" }) }}>{w}</span>
            <span style={{ padding: "0 24px", color: "#3A3A42" }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
