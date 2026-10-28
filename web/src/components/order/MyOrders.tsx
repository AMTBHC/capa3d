"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/config";
import { lookupOrders, type FoundOrder } from "@/lib/api";
import { money } from "@/lib/format";
import { orderPath, savedOrders, type SavedOrder } from "@/lib/myOrders";
import { Icon, ICONS } from "../Icon";

/** Mis pedidos: los de este navegador y búsqueda por correo y celular. */
export function MyOrders() {
  const [saved, setSaved] = useState<SavedOrder[] | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<FoundOrder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Lo guardado solo existe en el navegador; se lee después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(savedOrders());
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setFound(await lookupOrders(email, phone));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.layers} size={20} stroke={2} />
          </span>
          <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Capa3D</span>
        </Link>
        <Link className="chip-btn" href="/#quote" style={{ textDecoration: "none" }}>Cotizar otra pieza</Link>
      </header>
      <h1 className="h2" style={{ marginBottom: 20 }}>Mis pedidos</h1>

      {saved && saved.length > 0 && (
        <section className="step" style={{ marginBottom: 16 }}>
          <h2 className="step-title" style={{ marginTop: 0 }}>En este dispositivo</h2>
          <List items={saved.map((o) => ({ ...o, label: o.status_label }))} />
        </section>
      )}

      <section className="step">
        <h2 className="step-title" style={{ marginTop: 0 }}>Buscar mi pedido</h2>
        <p className="step-sub" style={{ marginBottom: 16 }}>Escribe el correo y el celular que usaste al hacer el pedido.</p>
        {!API_URL ? (
          <div className="status status-info">Escríbenos por WhatsApp y te ayudamos a encontrarlo.</div>
        ) : (
          <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "end" }}>
            <label style={label}>Correo<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={input} /></label>
            <label style={label}>Celular<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="300 123 4567" style={input} /></label>
            <button className="btn btn-primary" disabled={busy} style={{ padding: 13, borderRadius: 12, fontSize: 15 }}>{busy ? "Buscando…" : "Buscar"}</button>
          </form>
        )}
        {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 14 }}>{error}</p>}
        {found && found.length === 0 && (
          <div className="status status-info" style={{ marginTop: 16 }}>No encontramos pedidos con esos datos. Revisa el correo y el celular, o escríbenos por WhatsApp.</div>
        )}
        {found && found.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <List items={found.map((o) => ({ ...o, label: o.status_label }))} />
          </div>
        )}
      </section>
    </main>
  );
}

function List({ items }: { items: { id: string; token: string; created_at: string; file_name: string; total: number; label: string }[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((o) => (
        <li key={o.id}>
          <Link href={orderPath(o.id, o.token)}
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, background: "var(--surface-3)", textDecoration: "none", color: "var(--text)" }}>
            <span className="mono" style={{ color: "var(--ac)", fontWeight: 600 }}>{o.id}</span>
            <span style={{ flex: "1 1 160px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.file_name}</span>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>{new Date(o.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</span>
            <span className="display" style={{ fontWeight: 700 }}>${money(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)" } as const;
const input = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line-3)", background: "var(--surface-3)", color: "var(--text)", fontSize: 15 } as const;
