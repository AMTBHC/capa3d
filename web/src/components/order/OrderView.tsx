"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, whatsappUrl } from "@/lib/config";
import { checkoutOrder, confirmPayment, getOrder, type Order } from "@/lib/api";
import { QUALITIES } from "@/lib/catalog";
import { money } from "@/lib/format";
import { Icon, ICONS } from "../Icon";

const POLL_MS = 15_000;

/** Página del cliente: estado del pedido, pago con Wompi y seguimiento. */
export function OrderView({ id, token, transactionId }: { id: string; token: string; transactionId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const checkedTx = useRef(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id, token));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, token]);

  useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    (async () => {
      if (transactionId && !checkedTx.current) {
        // Volvió de Wompi: se confirma el pago y se limpia la URL.
        checkedTx.current = true;
        try {
          const o = await confirmPayment(id, token, transactionId);
          if (!alive) return;
          setOrder(o);
          setJustPaid(o.status === "paid");
        } catch {
          await load();
        }
        router.replace(`/pedido/${id}?t=${encodeURIComponent(token)}`);
        return;
      }
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [id, token, transactionId, load, router]);

  // Mientras espera revisión o pago, se actualiza solo.
  const waiting = order?.status === "received" || order?.status === "confirmed";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, load]);

  const pay = async () => {
    setPaying(true);
    try {
      window.location.href = await checkoutOrder(id, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPaying(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.layers} size={20} stroke={2} />
          </span>
          <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Capa3D</span>
        </Link>
        {order && (
          <a className="chip-btn" href={whatsappUrl(`Hola Capa3D, tengo una pregunta sobre mi pedido ${order.id}.`)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            ¿Dudas? WhatsApp
          </a>
        )}
      </header>

      {error && !order && <div className="status status-warn">No encontramos este pedido. Revisa que el enlace esté completo o escríbenos por WhatsApp.</div>}
      {!order && !error && <div className="status status-info"><span className="spin" /> Cargando tu pedido…</div>}

      {order && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {justPaid && (
            <div className="status status-ok pop" role="status">
              <span style={{ fontSize: 18 }} aria-hidden="true">🎉</span>
              <span><strong>¡Pago recibido!</strong> Empezamos a preparar tu impresión.</span>
            </div>
          )}

          <section className="step">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <h1 className="step-title" style={{ fontSize: 24, margin: 0 }}>Pedido {order.id}</h1>
              <StatusBadge order={order} />
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: "12px 0 20px", color: "var(--text-2)" }}>{order.status_text}</p>
            {order.status !== "cancelled" && <Timeline order={order} />}

            {order.status === "confirmed" && (
              <div style={{ marginTop: 22, padding: 18, borderRadius: 18, background: "var(--ac-tint)", border: "1px solid var(--ac-line)" }}>
                {(order.payment_status === "DECLINED" || order.payment_status === "ERROR" || order.payment_status === "VOIDED") && (
                  <p style={{ margin: "0 0 12px", color: "var(--warn)", fontSize: 14 }}>Tu último intento de pago no fue aprobado. Puedes intentarlo de nuevo.</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-3)" }}>Total a pagar</div>
                    <div className="display" style={{ fontSize: 32, fontWeight: 700 }}>${money(order.total)} <span className="mono muted" style={{ fontSize: 13 }}>{order.currency}</span></div>
                  </div>
                  {order.can_pay ? (
                    <button className="btn btn-primary glow" onClick={pay} disabled={paying} style={{ padding: "15px 24px", borderRadius: 14, fontSize: 16 }}>
                      {paying ? "Abriendo Wompi…" : "Pagar ahora"}
                    </button>
                  ) : (
                    <a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={whatsappUrl(`Hola Capa3D, quiero pagar mi pedido ${order.id} por $${money(order.total)}.`)} style={{ padding: "15px 24px", borderRadius: 14 }}>
                      Pagar por WhatsApp
                    </a>
                  )}
                </div>
                {order.can_pay && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-3)" }}>Pago seguro con Wompi (Bancolombia): PSE, Nequi, tarjeta o botón Bancolombia.</p>}
              </div>
            )}

            {order.tracking && (
              <div className="status status-info" style={{ marginTop: 18 }}>
                <span aria-hidden="true">🚚</span>
                <span>Enviado con <strong>{order.carrier}</strong> · guía <strong className="mono">{order.tracking}</strong></span>
              </div>
            )}
          </section>

          <section className="step">
            <h2 className="step-title" style={{ marginTop: 0, marginBottom: 14 }}>Tu pieza</h2>
            <Detail k="Archivo" v={`${order.file_name}${order.plates > 1 ? ` · ${order.plates} camas` : ""}`} />
            <Detail k="Filamento" v={`${order.params.material}${order.color ? ` ${order.color}` : ""}`} />
            <Detail k="Calidad" v={QUALITIES.find((q) => q.id === order.params.quality)?.name ?? order.params.quality} />
            <Detail k="Relleno" v={`${order.params.infill}%${order.params.supports ? " · con soportes" : ""}`} />
            <Detail k="Cantidad" v={String(order.params.qty)} />
            <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0", paddingTop: 12 }}>
              <Detail k="Impresión" v={`$${money(order.print_price)}`} />
              <Detail k="Envío" v={`$${money(order.shipping)}`} />
              <Detail k={order.status === "received" ? "Total estimado" : "Total"} v={`$${money(order.total)}`} strong />
            </div>
            <Detail k="Enviamos a" v={`${order.customer.name} · ${order.customer.address}, ${order.customer.city} (${order.customer.department})`} />
          </section>

          <section className="step">
            <h2 className="step-title" style={{ marginTop: 0, marginBottom: 12 }}>Historial</h2>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {[...order.events].reverse().map((e, i) => (
                <li key={i} style={{ display: "flex", gap: 12, fontSize: 14 }}>
                  <span className="mono" style={{ color: "var(--text-3)", minWidth: 140 }}>
                    {new Date(e.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span>{e.label}</span>
                </li>
              ))}
            </ol>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--text-3)" }}>Guarda este enlace para seguir tu pedido.</p>
          </section>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ order }: { order: Order }) {
  const color = order.status === "cancelled" ? "var(--bad)" : order.status === "confirmed" ? "var(--ac)" : order.status === "delivered" ? "var(--ok)" : "var(--text-2)";
  return (
    <span style={{ padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      {order.status_label}
    </span>
  );
}

function Timeline({ order }: { order: Order }) {
  const current = order.flow.findIndex((s) => s.status === order.status);
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${order.flow.length}, 1fr)`, gap: 4 }}>
      {order.flow.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          // El último estado se alinea a la derecha para que su nombre no se salga de la pantalla.
          <li key={s.status} style={{ display: "flex", flexDirection: "column", alignItems: i === order.flow.length - 1 ? "flex-end" : "flex-start", gap: 8, minWidth: 0 }}>
            <span style={{ width: "100%", height: 6, borderRadius: 3, background: done || now ? "var(--ac)" : "rgba(255,255,255,.1)", boxShadow: now ? "0 0 12px var(--ac)" : "none" }} />
            <span className="tl-label" data-now={now || undefined} title={s.label}
              style={{ fontSize: 12, color: now ? "var(--text)" : done ? "var(--text-2)" : "var(--text-4)", fontWeight: now ? 600 : 400, whiteSpace: "nowrap" }}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Detail({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0", fontSize: strong ? 16 : 14, fontWeight: strong ? 700 : 400 }}>
      <span className="muted" style={{ flex: "none" }}>{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}
