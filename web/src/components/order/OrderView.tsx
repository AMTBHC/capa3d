"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, whatsappUrl } from "@/lib/config";
import { checkoutOrder, confirmPayment, getOrder, orderStreamUrl, type Order } from "@/lib/api";
import { QUALITIES } from "@/lib/catalog";
import { money } from "@/lib/format";
import { orderPath, saveOrder } from "@/lib/myOrders";
import { Icon, ICONS } from "../Icon";

/** Respaldo si la conexión en vivo no está disponible. */
const POLL_MS = 20_000;

/** Sitio servido desde el propio computador: Wompi no puede devolver al cliente aquí. */
function isLocalHost(host: string): boolean {
  return host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === "[::1]";
}

/** Página del cliente: estado en vivo, pago con Wompi (total o abono) y seguimiento. */
export function OrderView({ id, token, transactionId, isNew }: { id: string; token: string; transactionId: string; isNew: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [inOtherTab, setInOtherTab] = useState(false);
  const [showWelcome, setShowWelcome] = useState(isNew);
  const checkedTx = useRef(false);
  const prevStatus = useRef<string | null>(null);

  const receive = useCallback((o: Order) => {
    // Pasó a pagado mientras el cliente miraba la página (pago en otra pestaña o evento de Wompi).
    if (prevStatus.current === "confirmed" && o.status === "paid") setJustPaid(true);
    prevStatus.current = o.status;
    setOrder(o);
    setError("");
    saveOrder({ id: o.id, token, created_at: o.created_at, file_name: o.file_name, total: o.total, status_label: o.status_label });
  }, [token]);

  const load = useCallback(async () => {
    try {
      receive(await getOrder(id, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, token, receive]);

  // Carga inicial; al volver de Wompi se confirma el pago y se limpia la URL.
  useEffect(() => {
    if (!API_URL) return;
    (async () => {
      if (transactionId && !checkedTx.current) {
        checkedTx.current = true;
        try {
          const o = await confirmPayment(id, token, transactionId);
          prevStatus.current = "confirmed";
          receive(o);
        } catch {
          await load();
        }
        router.replace(orderPath(id, token));
        return;
      }
      await load();
    })();
  }, [id, token, transactionId, load, receive, router]);

  // En vivo: cada cambio que haga el taller o el pago llega en uno o dos segundos.
  useEffect(() => {
    if (!API_URL || typeof EventSource === "undefined") return;
    const es = new EventSource(orderStreamUrl(id, token));
    es.addEventListener("order", (e) => receive(JSON.parse((e as MessageEvent).data)));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [id, token, receive]);

  useEffect(() => {
    if (live || !API_URL) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  const pay = async (plan: "full" | "deposit") => {
    setPaying(true);
    // En el computador del taller Wompi no puede volver a esta página: se abre en otra pestaña
    // (abierta ya, dentro del clic, para que el navegador no la bloquee).
    const tab = isLocalHost(window.location.hostname) ? window.open("", "_blank") : null;
    try {
      const { url, returns } = await checkoutOrder(id, token, plan);
      if (tab && !returns) {
        tab.location.href = url;
        setInOtherTab(true);
        setPaying(false);
      } else {
        tab?.close();
        window.location.href = url;
      }
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : String(e));
      setPaying(false);
    }
  };

  const link = typeof window !== "undefined" ? window.location.origin + orderPath(id, token) : "";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.layers} size={20} stroke={2} />
          </span>
          <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Capa3D</span>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="chip-btn" href="/mis-pedidos" style={{ textDecoration: "none" }}>Mis pedidos</Link>
          {order && (
            <a className="chip-btn" href={whatsappUrl(`Hola Capa3D, tengo una pregunta sobre mi pedido ${order.id}: ${link}`)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {error && !order && <div className="status status-warn">No encontramos este pedido. Revisa que el enlace esté completo o búscalo en <Link href="/mis-pedidos">Mis pedidos</Link>.</div>}
      {!order && !error && <div className="status status-info"><span className="spin" /> Cargando tu pedido…</div>}

      {order && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {showWelcome && <Welcome order={order} link={link} onClose={() => setShowWelcome(false)} />}
          {justPaid && (
            <div className="status status-ok pop" role="status">
              <span style={{ fontSize: 18 }} aria-hidden="true">🎉</span>
              <span><strong>¡Pago recibido!</strong> Empezamos a preparar tu impresión.</span>
            </div>
          )}

          <section className="step">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
              <h1 className="step-title" style={{ fontSize: 24, margin: 0 }}>Pedido {order.id}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {live && (
                  <span title="Esta página se actualiza sola" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ok)" }}>
                    <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)" }} />En vivo
                  </span>
                )}
                <StatusBadge order={order} />
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: "12px 0 20px", color: "var(--text-2)" }}>{order.status_text}</p>
            {order.status !== "cancelled" && <Timeline order={order} />}

            {order.status === "confirmed" && (
              <PayBox order={order} paying={paying} inOtherTab={inOtherTab} onPay={pay} error={error} />
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
              {order.paid_amount > 0 && <Detail k="Pagado" v={`$${money(order.paid_amount)}`} />}
              {order.paid_amount > 0 && order.balance > 0 && <Detail k="Pagas al recibir (efectivo)" v={`$${money(order.balance)}`} strong />}
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
          </section>
        </div>
      )}
    </main>
  );
}

/** Al hacer el pedido: número bien visible y formas de guardar el enlace. */
function Welcome({ order, link, onClose }: { order: Order; link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt("Copia el enlace de tu pedido:", link);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: `Pedido ${order.id} · Capa3D`, url: link });
    } catch {
      // el cliente cerró el menú de compartir
    }
  };
  return (
    <section className="status status-ok pop" style={{ flexDirection: "column", gap: 12, padding: 20 }} aria-labelledby="welcome-t">
      <div>
        <h2 id="welcome-t" style={{ margin: 0, fontSize: 20 }}>¡Recibimos tu pedido!</h2>
        <p style={{ margin: "6px 0 0", color: "var(--text-2)" }}>
          Tu número de pedido es <strong className="mono" style={{ fontSize: 18, color: "var(--text)" }}>{order.id}</strong>.
          Te escribimos por WhatsApp cuando confirmemos el precio. Guarda esta página para seguir tu pedido:
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a className="btn" href={whatsappUrl(`Hola Capa3D, acabo de hacer el pedido ${order.id}. Lo sigo aquí: ${link}`)} target="_blank" rel="noopener noreferrer"
          style={{ padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, background: "#25D366", color: "#06210F" }}>
          Enviar el pedido a Capa3D por WhatsApp
        </a>
        <button className="chip-btn" onClick={copy}>{copied ? "¡Enlace copiado!" : "Copiar enlace"}</button>
        {typeof navigator !== "undefined" && "share" in navigator && <button className="chip-btn" onClick={share}>Compartir</button>}
        <button className="chip-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Listo</button>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
        Si lo pierdes, entra a <Link href="/mis-pedidos">Mis pedidos</Link>: aparece en este navegador o lo buscas con tu correo y celular.
      </p>
    </section>
  );
}

function PayBox({ order, paying, inOtherTab, onPay, error }: {
  order: Order;
  paying: boolean;
  inOtherTab: boolean;
  onPay: (plan: "full" | "deposit") => void;
  error: string;
}) {
  const canDeposit = order.deposit_amount > 0 && order.deposit_amount < order.total;
  const [plan, setPlan] = useState<"full" | "deposit">("full");
  const amount = plan === "deposit" ? order.deposit_amount : order.total;
  const declined = ["DECLINED", "ERROR", "VOIDED"].includes(order.payment_status ?? "");

  return (
    <div style={{ marginTop: 22, padding: 18, borderRadius: 18, background: "var(--ac-tint)", border: "1px solid var(--ac-line)" }}>
      {declined && <p style={{ margin: "0 0 12px", color: "var(--warn)", fontSize: 14 }}>Tu último intento de pago no fue aprobado. Puedes intentarlo de nuevo.</p>}
      <div style={{ fontWeight: 600, marginBottom: 10 }}>¿Cómo quieres pagar?</div>
      <div style={{ display: "grid", gridTemplateColumns: canDeposit ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr", gap: 10 }}>
        <button className="choice" aria-pressed={plan === "full"} onClick={() => setPlan("full")}>
          <span style={{ fontWeight: 600 }}>Pagar todo</span>
          <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>${money(order.total)}</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Y no pagas nada más al recibir</span>
        </button>
        {canDeposit && (
          <button className="choice" aria-pressed={plan === "deposit"} onClick={() => setPlan("deposit")}>
            <span style={{ fontWeight: 600 }}>Abonar el {order.deposit_percent}%</span>
            <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>${money(order.deposit_amount)}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>y ${money(order.total - order.deposit_amount)} en efectivo al recibir</span>
          </button>
        )}
      </div>
      {order.can_pay ? (
        <button className="btn btn-primary glow" onClick={() => onPay(plan)} disabled={paying}
          style={{ width: "100%", marginTop: 14, padding: 15, borderRadius: 14, fontSize: 16 }}>
          {paying ? "Abriendo Wompi…" : `Pagar $${money(amount)}`}
        </button>
      ) : (
        <a className="btn btn-primary" target="_blank" rel="noopener noreferrer"
          href={whatsappUrl(`Hola Capa3D, quiero pagar ${plan === "deposit" ? `el abono de $${money(amount)}` : `$${money(amount)}`} de mi pedido ${order.id}.`)}
          style={{ display: "block", textAlign: "center", marginTop: 14, padding: 15, borderRadius: 14 }}>
          Pagar ${money(amount)} por WhatsApp
        </a>
      )}
      {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
      {inOtherTab ? (
        <div className="status status-busy" role="status" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
            <span className="spin" aria-hidden="true" /> Esperando tu pago en la pestaña de Wompi…
          </div>
          <div className="indeterminate" aria-hidden="true" />
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Cuando termines, vuelve a esta pestaña: se actualiza sola.</span>
        </div>
      ) : (
        order.can_pay && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-3)" }}>Pago seguro con Wompi (Bancolombia): PSE, Nequi, tarjeta o botón Bancolombia.</p>
      )}
    </div>
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
