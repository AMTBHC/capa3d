"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminOrderAction, ApiError, downloadOrder, listAdminOrders, watchAdmin, type AdminOrder, type OrderActionName, type OrderStatus } from "@/lib/api";
import { QUALITIES } from "@/lib/catalog";
import { money } from "@/lib/format";
import { Icon } from "../Icon";

/** Respaldo si la conexión en vivo no está disponible. */
const REFRESH_MS = 30_000;

/** Dos tonos cortos para avisar un pedido nuevo. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.3);
    });
  } catch {
    // sin audio
  }
}

const FILTERS: [string, OrderStatus[] | null][] = [
  ["Por revisar", ["received"]],
  ["Por pagar", ["confirmed"]],
  ["Por imprimir", ["paid", "printing"]],
  ["Enviados", ["shipped"]],
  ["Entregados", ["delivered"]],
  ["Cancelados", ["cancelled"]],
  ["Todos", null],
];

const STATUS_COLOR: Record<OrderStatus, string> = {
  received: "var(--warn)",
  confirmed: "var(--ac)",
  paid: "var(--ok)",
  printing: "var(--ok)",
  shipped: "var(--text-2)",
  delivered: "var(--text-3)",
  cancelled: "var(--bad)",
};

/** Número para wa.me: los celulares colombianos de 10 dígitos llevan el 57 adelante. */
function waPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 && d.startsWith("3") ? `57${d}` : d;
}

/** Mensaje para el cliente según el estado del pedido. */
function customerMessage(o: AdminOrder): string {
  const first = o.customer.name.split(" ")[0];
  const total = `$${money(o.total)}`;
  switch (o.status) {
    case "received":
      if (o.price_pending) {
        return `Hola ${first}, soy de Capa3D. Recibimos tu solicitud de cotización ${o.id} (${o.file_name}). Ya estamos revisando tu archivo; ¿me cuentas para qué es la pieza y si tienes fecha límite? Así te doy el mejor precio.`;
      }
      return `Hola ${first}, recibimos tu pedido ${o.id} en Capa3D. Estamos revisando tu archivo y te confirmamos el precio pronto. Puedes seguirlo aquí: ${o.order_url}`;
    case "confirmed":
      return `Hola ${first}, revisamos tu archivo. El total de tu pedido ${o.id} es ${total} (impresión $${money(o.print_price)} + envío $${money(o.shipping)}). ${o.can_pay ? "Puedes pagar aquí" : "Te envío los datos para el pago. Sigue tu pedido aquí"}: ${o.order_url}`;
    case "paid":
      return o.balance > 0
        ? `Hola ${first}, recibimos tu abono de $${money(o.paid_amount)} del pedido ${o.id}. Ya está en la cola de impresión; los $${money(o.balance)} restantes los pagas en efectivo al recibir. ${o.order_url}`
        : `Hola ${first}, recibimos tu pago del pedido ${o.id}. Ya está en la cola de impresión. ${o.order_url}`;
    case "printing":
      return `Hola ${first}, tu pedido ${o.id} se está imprimiendo. ${o.order_url}`;
    case "shipped":
      return `Hola ${first}, tu pedido ${o.id} va en camino con ${o.carrier}, guía ${o.tracking}.${o.balance > 0 ? ` Recuerda tener $${money(o.balance)} en efectivo para pagar al recibir.` : ""} ${o.order_url}`;
    case "delivered":
      return `Hola ${first}, ¡gracias por tu compra en Capa3D! Esperamos que tu pieza te encante.`;
    case "cancelled":
      return `Hola ${first}, tu pedido ${o.id} fue cancelado. Si tienes dudas, escríbenos.`;
  }
}

export function OrdersTab({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [filter, setFilter] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState("");
  const [canNotify, setCanNotify] = useState<NotificationPermission | "unsupported">("unsupported");
  const received = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listAdminOrders(token, []);
      setOrders(list);
      setError("");
      return list;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [token, onUnauthorized]);

  // En vivo: la API avisa cuando llega un pedido o cambia alguno.
  useEffect(() => {
    return watchAdmin(token, async (data) => {
      const n = data.by_status.received ?? 0;
      const list = await load();
      if (received.current !== null && n > received.current && list) {
        const newest = list.find((o) => o.status === "received");
        const text = newest ? `Nuevo pedido ${newest.id} de ${newest.customer.name} · $${money(newest.total)}` : "Nuevo pedido";
        setToast(text);
        chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Capa3D", { body: text });
      }
      received.current = n;
    }, setLive);
  }, [token, load]);

  useEffect(() => {
    if (live) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [live, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof Notification !== "undefined") setCanNotify(Notification.permission);
  }, []);

  // Pedidos por revisar en el título de la pestaña: se ven aunque estés en otra.
  const pending = orders?.filter((o) => o.status === "received").length ?? 0;
  useEffect(() => {
    document.title = pending ? `(${pending}) Panel · Capa3D` : "Panel · Capa3D";
  }, [pending]);

  const replace = (o: AdminOrder) => setOrders((list) => list?.map((x) => (x.id === o.id ? o : x)) ?? null);
  const statuses = FILTERS[filter][1];
  // El pedido abierto sigue visible aunque cambie de estado, para avisar al cliente enseguida.
  const shown = orders?.filter((o) => !statuses || statuses.includes(o.status) || o.id === open) ?? [];

  return (
    <>
      {toast && (
        <div className="status status-ok pop" role="alert" style={{ marginBottom: 14, alignItems: "center" }}>
          <span aria-hidden="true">🔔</span>
          <span style={{ flex: 1 }}><strong>{toast}</strong></span>
          <button className="chip-btn" onClick={() => { setToast(""); setFilter(0); }}>Ver</button>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 13, color: "var(--text-3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: live ? "var(--ok)" : "var(--text-3)" }}>
          <span className={live ? "pulse" : undefined} style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--ok)" : "var(--text-4)" }} />
          {live ? "En vivo: los pedidos nuevos y los pagos aparecen solos" : "Reconectando…"}
        </span>
        {canNotify === "default" && (
          <button className="chip-btn" onClick={async () => setCanNotify(await Notification.requestPermission())}>Activar avisos en el computador</button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {FILTERS.map(([label, st], i) => {
          const n = orders?.filter((o) => !st || st.includes(o.status)).length ?? 0;
          return (
            <button key={label} className="chip-btn" aria-pressed={filter === i} onClick={() => setFilter(i)}>
              {label}{n > 0 && ` · ${n}`}
            </button>
          );
        })}
        <button className="chip-btn" onClick={load} style={{ marginLeft: "auto" }}>Actualizar</button>
      </div>
      {error && <div className="status status-warn" style={{ marginBottom: 12 }}>No se pudo cargar: {error}</div>}
      {orders && shown.length === 0 && <div className="status status-info">No hay pedidos en “{FILTERS[filter][0]}”.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((o) => (
          <OrderCard key={o.id} o={o} token={token} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} onChange={replace} />
        ))}
      </div>
    </>
  );
}

function OrderCard({ o, token, open, onToggle, onChange }: {
  o: AdminOrder;
  token: string;
  open: boolean;
  onToggle: () => void;
  onChange: (o: AdminOrder) => void;
}) {
  const color = STATUS_COLOR[o.status];
  return (
    <article style={{ borderRadius: 18, background: "var(--surface)", border: `1px solid ${open ? "var(--ac-line)" : "var(--line)"}`, overflow: "hidden" }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "none", border: 0, color: "var(--text)", cursor: "pointer", textAlign: "left" }}>
        <span className="mono" style={{ color: "var(--ac)", fontWeight: 600 }}>{o.id}</span>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{o.status_label}</span>
        {o.price_pending && <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 14%, transparent)" }}>Solicitud de cotización · pon el precio</span>}
        <span style={{ flex: "1 1 200px", minWidth: 0 }}>
          <strong style={{ fontWeight: 600 }}>{o.customer.name}</strong>
          <span style={{ color: "var(--text-3)", fontSize: 13 }}> · {o.customer.city} · {o.file_name}</span>
        </span>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>{new Date(o.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
        <span className="display" style={{ fontWeight: 700 }}>{o.price_pending ? "Por cotizar" : `$${money(o.total)}`}</span>
      </button>
      {open && <OrderDetail o={o} token={token} onChange={onChange} />}
    </article>
  );
}

function OrderDetail({ o, token, onChange }: { o: AdminOrder; token: string; onChange: (o: AdminOrder) => void }) {
  const [printPrice, setPrintPrice] = useState(String(o.print_price));
  const [shipping, setShipping] = useState(String(o.shipping));
  const [carrier, setCarrier] = useState(o.carrier ?? "");
  const [tracking, setTracking] = useState(o.tracking ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const c = o.customer;
  const quality = QUALITIES.find((q) => q.id === o.params.quality)?.name ?? o.params.quality;
  const notify = `https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(customerMessage(o))}`;

  const run = async (action: OrderActionName, extra = {}, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    setError("");
    try {
      onChange(await adminOrderAction(token, o.id, action, extra));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const { blob, name } = await downloadOrder(token, o.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(o.order_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace del pedido:", o.order_url);
    }
  };

  return (
    <div style={{ padding: "0 16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <Box title="Cliente">
        <Line>{c.name}</Line>
        <Line><a href={`https://wa.me/${waPhone(c.phone)}`} target="_blank" rel="noopener noreferrer">{c.phone}</a> · <a href={`mailto:${c.email}`}>{c.email}</a></Line>
        <Line>{c.address}, {c.city} ({c.department})</Line>
        {c.notes && <Line muted>“{c.notes}”</Line>}
      </Box>

      <Box title="Pieza">
        <Line>{o.file_name}{o.plates > 1 ? ` · ${o.plates} camas` : ""}</Line>
        <Line>{o.params.material} {o.color} · {quality} · relleno {o.params.infill}% · {o.params.supports ? "con" : "sin"} soportes</Line>
        <Line muted>Cantidad {o.params.qty}{o.params.scale !== 100 ? ` · escala ${o.params.scale}%` : ""} · cotización {o.quote_id}</Line>
        <button className="chip-btn" onClick={download} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon d="M12 4v12 M7 11l5 5 5-5 M4 20h16" size={16} stroke={2} /> Descargar archivo y G-code
        </button>
      </Box>

      <Box title="Siguiente paso">
        {(o.status === "received" || o.status === "confirmed") && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Money label="Impresión" value={printPrice} onChange={setPrintPrice} />
              <Money label="Envío" value={shipping} onChange={setShipping} />
            </div>
            <Line muted>Total: ${money((+printPrice || 0) + (+shipping || 0))}</Line>
            <button className="btn btn-primary" disabled={busy} style={actionBtn}
              onClick={() => run("confirm", { print_price: Math.round(+printPrice || 0), shipping: Math.round(+shipping || 0) })}>
              {o.status === "received" ? "Confirmar precio" : "Actualizar precio"}
            </button>
          </>
        )}
        {o.status === "confirmed" && o.payments.at(-1)?.status === "PENDING" && (
          <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--warn)" }}>
            El cliente abrió el pago en Wompi (ref. {o.payments.at(-1)!.reference}). Si en comercios.wompi.co aparece aprobado y aquí no ha cambiado, márcalo como pagado.
          </p>
        )}
        {o.status === "confirmed" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button className="chip-btn" disabled={busy}
              onClick={() => run("mark_paid", { plan: "full", note: "registrado a mano" }, `¿Confirmas que recibiste $${money(o.total)} por el pedido ${o.id}?`)}>
              Recibí el total (${money(o.total)})
            </button>
            {o.deposit_amount > 0 && o.deposit_amount < o.total && (
              <button className="chip-btn" disabled={busy}
                onClick={() => run("mark_paid", { plan: "deposit", note: "registrado a mano" }, `¿Confirmas que recibiste el abono de $${money(o.deposit_amount)} por el pedido ${o.id}?`)}>
                Recibí el abono (${money(o.deposit_amount)})
              </button>
            )}
          </div>
        )}
        {o.paid_amount > 0 && (
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            Pagado <strong>${money(o.paid_amount)}</strong>
            {o.balance > 0 && <> · <strong style={{ color: "var(--warn)" }}>por cobrar al entregar ${money(o.balance)}</strong> (efectivo)</>}
          </p>
        )}
        {o.status === "paid" && <button className="btn btn-primary" disabled={busy} style={actionBtn} onClick={() => run("start_printing")}>Empezar impresión</button>}
        {(o.status === "paid" || o.status === "printing") && (
          <div style={{ marginTop: o.status === "paid" ? 12 : 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Text label="Transportadora" value={carrier} onChange={setCarrier} placeholder="Servientrega" />
              <Text label="Número de guía" value={tracking} onChange={setTracking} />
            </div>
            <button className={o.status === "printing" ? "btn btn-primary" : "chip-btn"} disabled={busy || !carrier || !tracking} style={actionBtn}
              onClick={() => run("ship", { carrier, tracking })}>
              Marcar como enviado
            </button>
          </div>
        )}
        {o.status === "shipped" && (
          <button className="btn btn-primary" disabled={busy} style={actionBtn}
            onClick={() => run("deliver", {}, o.balance > 0 ? `¿Entregado y cobraste $${money(o.balance)} en efectivo?` : undefined)}>
            {o.balance > 0 ? `Entregado · cobré $${money(o.balance)}` : "Marcar como entregado"}
          </button>
        )}
        {(o.status === "delivered" || o.status === "cancelled") && <Line muted>Pedido cerrado.</Line>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <a className="btn" href={notify} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "#25D366", color: "#06210F" }}>
            Avisar al cliente por WhatsApp
          </a>
          <button className="chip-btn" onClick={copy}>{copied ? "¡Copiado!" : "Copiar enlace del pedido"}</button>
          {["received", "confirmed", "paid", "printing"].includes(o.status) && (
            <button className="chip-btn" disabled={busy} style={{ color: "var(--bad)" }}
              onClick={() => run("cancel", {}, `¿Cancelar el pedido ${o.id}?`)}>Cancelar</button>
          )}
        </div>
        {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
      </Box>

      <Box title="Historial">
        {o.events.map((e, i) => (
          <Line key={i} muted>{new Date(e.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })} · {e.label}{e.note ? ` — ${e.note}` : ""}</Line>
        ))}
        {o.payments.map((p) => (
          <Line key={p.reference} muted>Pago {p.reference}: ${money(p.amount)} · {p.status}{p.transaction_id ? ` · Wompi ${p.transaction_id}` : ""}</Line>
        ))}
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 14, borderRadius: 14, background: "var(--surface-3)", minWidth: 0 }}>
      <h3 style={{ fontSize: 13, color: "var(--text-3)", fontFamily: "inherit", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>{title}</h3>
      {children}
    </section>
  );
}

function Line({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <p style={{ margin: "3px 0", fontSize: 14, lineHeight: 1.5, color: muted ? "var(--text-3)" : "var(--text)", overflowWrap: "anywhere" }}>{children}</p>;
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <input type="number" min={0} step={100} value={value} onChange={(e) => onChange(e.target.value)} style={field} />
    </label>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
      {label}
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={field} />
    </label>
  );
}

const field = { width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--line-3)", background: "var(--surface)", color: "var(--text)", fontSize: 14 } as const;
const actionBtn = { width: "100%", marginTop: 10, padding: 12, borderRadius: 12, fontSize: 14 } as const;
