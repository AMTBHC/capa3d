interface Props {
  eyebrow: string;
  title: string;
  lead?: string;
  mb?: number;
}

export function SectionHeader({ eyebrow, title, lead, mb = 40 }: Props) {
  return (
    <div style={{ maxWidth: 720, marginBottom: mb }}>
      <span className="mono eyebrow">{eyebrow}</span>
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
