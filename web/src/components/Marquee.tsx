const WORDS = ["PLA", "PETG", "ABS", "TPU", "PROTOTIPOS", "REPUESTOS", "MINIATURAS", "DECORACIÓN"];

export function Marquee() {
  const items = [...WORDS, ...WORDS];
  return (
    <div aria-hidden="true" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "18px 0", overflow: "hidden", background: "var(--bg-2)" }}>
      <div className="marq display" style={{ display: "flex", width: "max-content", fontWeight: 600, fontSize: "clamp(20px,2.6vw,30px)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
        {items.map((w, i) => (
          <span key={i} style={{ display: "contents" }}>
            <span style={{ padding: "0 28px", color: i % 2 === 0 ? "var(--text)" : "var(--text-4)" }}>{w}</span>
            <span style={{ padding: "0 4px", color: "var(--line-3)" }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
