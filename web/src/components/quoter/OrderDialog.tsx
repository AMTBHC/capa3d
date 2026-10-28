"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { createOrder, shippingFor, type CustomerData, type Shipping } from "@/lib/api";
import { money } from "@/lib/format";
import { orderPath, saveOrder } from "@/lib/myOrders";
import { Icon, ICONS } from "../Icon";

const DEPARTMENTS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare",
  "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
  "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
  "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
];

const SAVED = "capa3d-cliente";

const EMPTY: CustomerData = { name: "", phone: "", email: "", address: "", city: "", department: "", notes: "" };

function loadSaved(): CustomerData {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(SAVED) ?? "{}"), notes: "" };
  } catch {
    return EMPTY;
  }
}

interface Props {
  quoteId: string;
  color: string;
  summary: string;
  printPrice: number;
  shipping: Shipping | null;
  onClose: () => void;
}

/** Formulario de pedido: datos de contacto y dirección. No se paga todavía. */
export function OrderDialog({ quoteId, color, summary, printPrice, shipping, onClose }: Props) {
  const router = useRouter();
  const [c, setC] = useState<CustomerData>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Datos de un pedido anterior en este navegador, para no escribirlos de nuevo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(loadSaved());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const set = (k: keyof CustomerData) => (e: { target: { value: string } }) => setC((x) => ({ ...x, [k]: e.target.value }));
  const ship = shipping && c.city.trim() ? shippingFor(shipping, c.city) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const o = await createOrder(quoteId, color, c);
      try {
        localStorage.setItem(SAVED, JSON.stringify({ ...c, notes: "" }));
      } catch {
        // sin almacenamiento: solo no se recuerdan los datos
      }
      saveOrder({ id: o.id, token: o.token, created_at: o.created_at, file_name: o.file_name, total: o.total, status_label: o.status_label });
      router.push(`${orderPath(o.id, o.token)}&nuevo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  // Fuera de la columna fija del precio: un elemento sticky crea su propio contexto de apilamiento
  // y el resto del cotizador quedaría dibujado encima del formulario.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="order-title" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto", background: "rgba(5,5,7,.8)", backdropFilter: "blur(10px)" }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 560, borderRadius: 24, background: "var(--surface)", border: "1px solid rgba(255,255,255,.12)", padding: 24 }}>
        <button type="button" onClick={onClose} aria-label="Cerrar"
          style={{ position: "absolute", right: 14, top: 14, width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,.2)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={ICONS.close} size={16} stroke={2} />
        </button>
        <h2 id="order-title" className="step-title" style={{ fontSize: 22, marginTop: 0 }}>Hacer pedido</h2>
        <p className="step-sub" style={{ marginBottom: 16 }}>{summary}</p>

        <div className="status status-info" style={{ marginBottom: 18 }}>
          <span aria-hidden="true" style={{ fontSize: 18 }}>💳</span>
          <span><strong>No pagas nada todavía.</strong> Revisamos tu archivo, te confirmamos el precio final y te enviamos el enlace para pagar con PSE, Nequi o tarjeta.</span>
        </div>

        <fieldset style={fieldset}>
          <legend style={legend}>Tus datos</legend>
          <Field label="Nombre completo"><input required minLength={2} maxLength={80} autoComplete="name" value={c.name} onChange={set("name")} style={input} /></Field>
          <div style={twoCols}>
            <Field label="Celular (WhatsApp)"><input required type="tel" inputMode="tel" autoComplete="tel" placeholder="300 123 4567" value={c.phone} onChange={set("phone")} style={input} /></Field>
            <Field label="Correo"><input required type="email" autoComplete="email" value={c.email} onChange={set("email")} style={input} /></Field>
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>Envío a domicilio</legend>
          <div style={twoCols}>
            <Field label="Departamento">
              <select required value={c.department} onChange={set("department")} style={input}>
                <option value="" disabled>Elige…</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Ciudad o municipio"><input required minLength={2} maxLength={60} autoComplete="address-level2" value={c.city} onChange={set("city")} style={input} /></Field>
          </div>
          <Field label="Dirección"><input required minLength={5} maxLength={200} autoComplete="street-address" placeholder="Calle 10 # 20-30, apto 401, barrio" value={c.address} onChange={set("address")} style={input} /></Field>
          <Field label="Notas (opcional)"><textarea maxLength={500} rows={2} placeholder="Indicaciones de entrega o de la pieza" value={c.notes} onChange={set("notes")} style={{ ...input, resize: "vertical" }} /></Field>
        </fieldset>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 4, fontSize: 14 }}>
          <Row k="Impresión" v={`$${money(printPrice)}`} />
          <Row k="Envío" v={ship === null ? "según tu ciudad" : `$${money(ship)}`} />
          <Row k="Total estimado" v={`$${money(printPrice + (ship ?? 0))}`} strong />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-4)" }}>Te confirmamos el total antes de pagar.</p>
        </div>

        {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 14, margin: "12px 0 0" }}>{error}</p>}
        <button className="btn btn-primary glow" disabled={busy} style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 16, fontSize: 16 }}>
          {busy ? "Enviando…" : "Enviar pedido"}
        </button>
      </form>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)", marginBottom: 12, minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: strong ? 700 : 400, fontSize: strong ? 16 : 14 }}>
      <span className={strong ? undefined : "muted"}>{k}</span><span className="mono">{v}</span>
    </div>
  );
}

const input = {
  width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)",
  background: "var(--surface-3)", color: "var(--text)", fontSize: 15, fontFamily: "inherit",
} as const;
const fieldset = { border: 0, padding: 0, margin: "0 0 8px" } as const;
const legend = { fontWeight: 600, fontSize: 15, marginBottom: 10, padding: 0 } as const;
const twoCols = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 12px" } as const;
