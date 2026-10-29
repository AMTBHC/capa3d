"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL, whatsappUrl } from "@/lib/config";
import { designImageUrl, getDesign, type Design, type DesignStatus } from "@/lib/api";
import { money } from "@/lib/format";
import { orderPath, saveDesign } from "@/lib/myOrders";
import { SiteHeader } from "../SiteHeader";
import { WhatsAppIcon } from "../WhatsAppIcon";

const POLL_MS = 20_000;

const FLOW: [DesignStatus, string][] = [
  ["received", "Recibida"],
  ["designing", "En diseño"],
  ["proposal", "Propuesta"],
  ["ordered", "Lista para pagar"],
];

const USE_LABEL: Record<string, string> = {
  figura: "Figura o personaje", regalo: "Regalo", decoracion: "Decoración", repuesto: "Repuesto o pieza", funcional: "Algo funcional", otro: "Otro",
};

/** Página del cliente para seguir su solicitud de diseño a medida. */
export function DesignView({ id, token, isNew }: { id: string; token: string; isNew: boolean }) {
  const [d, setD] = useState<Design | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const got = await getDesign(id, token);
      setD(got);
      setError("");
      saveDesign({ id: got.id, token, created_at: got.created_at, description: got.brief.description, status_label: got.status_label });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, token]);

  useEffect(() => {
    if (!API_URL) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const step = d ? FLOW.findIndex(([s]) => s === d.status) : -1;
  const b = d?.brief;
  const details = b
    ? ([
        USE_LABEL[b.use],
        b.size_cm ? `~${b.size_cm} cm` : null,
        `${b.qty} ${b.qty === 1 ? "unidad" : "unidades"}`,
        b.material || null,
        b.color || null,
        b.deadline ? `para el ${new Date(`${b.deadline}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}` : null,
        b.budget ? `presupuesto ~$${money(b.budget)}` : null,
      ].filter(Boolean) as string[])
    : [];

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>
      <SiteHeader />
      {error && !d && <div className="status status-warn">{error}</div>}
      {d && (
        <>
          {isNew && (
            <div className="status status-ok" style={{ marginBottom: 16 }}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>✅</span>
              <span><strong>¡Recibimos tu solicitud!</strong> Guarda esta página: aquí ves cómo va tu diseño. También la encuentras en <Link href="/mis-pedidos">Mis pedidos</Link> desde este dispositivo.</span>
            </div>
          )}
          <section className="step">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h1 className="step-title" style={{ fontSize: 24, margin: 0 }}>Diseño a medida <span className="mono" style={{ color: "var(--ac)" }}>{d.id}</span></h1>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>{new Date(d.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}</span>
            </div>
            {d.status === "cancelled" ? (
              <div className="status status-warn" style={{ marginTop: 16 }}>{d.status_text}</div>
            ) : (
              <>
                <ol aria-label="Avance" style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gridTemplateColumns: `repeat(${FLOW.length}, 1fr)`, gap: 6 }}>
                  {FLOW.map(([s, label], i) => (
                    <li key={s} aria-current={i === step ? "step" : undefined} style={{ fontSize: 12, color: i <= step ? "var(--text)" : "var(--text-4)", fontWeight: i === step ? 700 : 400 }}>
                      <span style={{ display: "block", height: 4, borderRadius: 2, marginBottom: 8, background: i <= step ? "var(--ac)" : "var(--line-2)" }} />
                      {label}
                    </li>
                  ))}
                </ol>
                <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.55 }}>{d.status_text}</p>
              </>
            )}
            {d.order && (
              <Link className="btn btn-primary" href={orderPath(d.order.id, d.order.token)}
                style={{ display: "block", textAlign: "center", marginTop: 16, padding: 16, borderRadius: 16, fontSize: 16 }}>
                Ver mi pedido {d.order.id} y pagar
              </Link>
            )}
            <a className="btn btn-ghost" href={whatsappUrl(`Hola, quiero hablar de mi diseño a medida ${d.id}.`)} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 16px", borderRadius: 12, fontSize: 14 }}>
              <WhatsAppIcon size={16} /> Escribir por WhatsApp
            </a>
          </section>

          <section className="step" style={{ marginTop: 16 }}>
            <h2 className="step-title" style={{ marginTop: 0 }}>Lo que nos pediste</h2>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.55, margin: "10px 0 12px" }}>{d.brief.description}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {details.map((x) => <span key={x} className="chip">{x}</span>)}
            </div>
            <div className="ref-grid">
              {d.images.map((name, i) => (
                <a key={name} className="ref-tile" href={designImageUrl(d.id, token, name)} target="_blank" rel="noreferrer">
                  {!name.endsWith(".pdf") && (
                    // HEIC solo se ve en Safari; en otros navegadores queda la etiqueta.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={designImageUrl(d.id, token, name)} alt={`Referencia ${i + 1}`} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  )}
                  <span className="mono" style={{ position: "relative", padding: "6px 8px", fontSize: 11, background: "var(--glass)", width: "100%" }}>
                    {name.endsWith(".pdf") ? "PDF" : name.endsWith(".heic") ? "Foto HEIC" : `Foto ${i + 1}`}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
