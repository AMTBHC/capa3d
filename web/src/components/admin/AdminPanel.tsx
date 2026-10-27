"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { ApiError, downloadQuote, listAdminQuotes, type AdminQuote } from "@/lib/api";
import { QUALITIES } from "@/lib/catalog";
import { duration, money, num1 } from "@/lib/format";
import { Icon, ICONS } from "../Icon";
import { OrdersTab } from "./OrdersTab";

const TOKEN_KEY = "capa3d-admin";
const REFRESH_MS = 30_000;

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // almacenamiento bloqueado: la clave dura solo esta visita
  }
}

/** Panel privado: cotizaciones recibidas y descarga de archivos y G-code. */
export function AdminPanel() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // La clave guardada solo existe en el navegador; se lee después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readToken());
    setReady(true);
  }, []);

  const logout = () => {
    saveToken("");
    setToken("");
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
            <Icon d={ICONS.layers} size={20} stroke={2} />
          </span>
          <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Capa3D</span>
          <span style={{ color: "var(--text-3)", fontSize: 14 }}>· Panel</span>
        </Link>
        {token && <button className="chip-btn" onClick={logout}>Salir</button>}
      </header>
      {!API_URL ? (
        <Notice>Para usar el panel, configura <code>NEXT_PUBLIC_API_URL</code> en <code>web/.env.local</code>.</Notice>
      ) : !ready ? null : token ? (
        <Tabs token={token} onUnauthorized={logout} />
      ) : (
        <Login onLogin={(t) => { saveToken(t); setToken(t); }} />
      )}
    </main>
  );
}

function Tabs({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<"orders" | "quotes">("orders");
  return (
    <>
      <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--line)" }}>
        {([["orders", "Pedidos"], ["quotes", "Cotizaciones"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            style={{ padding: "12px 16px", background: "none", border: 0, borderBottom: `2px solid ${tab === id ? "var(--ac)" : "transparent"}`, color: tab === id ? "var(--text)" : "var(--text-3)", fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "orders" ? <OrdersTab token={token} onUnauthorized={onUnauthorized} /> : <QuoteList token={token} onUnauthorized={onUnauthorized} />}
    </>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await listAdminQuotes(value.trim(), true);
      onLogin(value.trim());
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Clave incorrecta." : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="step" style={{ maxWidth: 420, margin: "60px auto 0" }}>
      <h1 className="step-title" style={{ fontSize: 24 }}>Panel de Capa3D</h1>
      <p className="step-sub" style={{ marginBottom: 18 }}>Escribe la clave del panel. Está en <code>api/.env</code> como <code>CAPA3D_ADMIN_TOKEN</code>.</p>
      <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Clave" autoFocus required
        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.2)", background: "var(--surface-3)", color: "var(--text)", fontSize: 16 }} />
      {error && <p style={{ color: "var(--bad)", fontSize: 14, margin: "10px 0 0" }}>{error}</p>}
      <button className="btn btn-primary" disabled={busy || !value.trim()} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 12, fontSize: 15 }}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function QuoteList({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [requestedOnly, setRequestedOnly] = useState(true);
  const [quotes, setQuotes] = useState<AdminQuote[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuotes(await listAdminQuotes(token, requestedOnly));
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [token, requestedOnly, onUnauthorized]);

  useEffect(() => {
    // Carga inicial y actualización periódica desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="chip-btn" aria-pressed={requestedOnly} onClick={() => setRequestedOnly(true)}>Pedidas o consultadas</button>
          <button className="chip-btn" aria-pressed={!requestedOnly} onClick={() => setRequestedOnly(false)}>Todas</button>
        </div>
        <button className="chip-btn" onClick={load} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button>
      </div>
      {error && <Notice>No se pudo cargar: {error}</Notice>}
      {quotes && quotes.length === 0 && (
        <Notice>
          {requestedOnly
            ? "Todavía nadie ha pedido ni consultado. Mira “Todas”."
            : "Todavía no hay cotizaciones."}
        </Notice>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {quotes?.map((q) => <QuoteRow key={q.id} q={q} token={token} />)}
      </div>
    </>
  );
}

function QuoteRow({ q, token }: { q: AdminQuote; token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quality = QUALITIES.find((x) => x.id === q.params.quality)?.name ?? q.params.quality;
  const when = new Date(q.requested_at ?? q.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  const details = [
    `${q.params.material}${q.color ? ` ${q.color}` : ""}`,
    quality,
    `relleno ${q.params.infill}%`,
    q.params.supports ? "con soportes" : "sin soportes",
    q.params.scale !== 100 || q.params.unit !== "mm" ? `escala ${q.params.scale}% (${q.params.unit})` : null,
  ].filter(Boolean) as string[];

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, name } = await downloadQuote(token, q.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: 18, borderRadius: 18, background: "var(--surface)", border: `1px solid ${q.requested_at ? "color-mix(in srgb, var(--ok) 40%, transparent)" : "var(--line)"}` }}>
      <div style={{ flex: "1 1 360px", minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ color: "var(--ac)", fontWeight: 600 }}>{q.id}</span>
          {q.requested_at
            ? <span style={badge("var(--ok)")}>Pidió o consultó</span>
            : <span style={badge("var(--text-3)")}>Solo cotizó</span>}
          {q.status === "failed" && <span style={badge("var(--bad)")}>Falló</span>}
          {q.status === "pending" && <span style={badge("var(--warn)")}>Laminando</span>}
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>{when}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 16, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.file_name}</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
          {q.plates > 1 ? `${q.plates} camas · ` : ""}{q.pieces} {q.pieces === 1 ? "pieza" : "piezas"} · {q.file_format.toUpperCase()} · cantidad {q.params.qty}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {details.map((d) => <span key={d} className="chip" style={{ fontSize: 12 }}>{d}</span>)}
        </div>
        {q.error && <p style={{ color: "var(--bad)", fontSize: 13, margin: "8px 0 0" }}>{q.error}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
        {q.total !== null && (
          <div style={{ textAlign: "right" }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 22 }}>${money(q.total)}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              {q.grams !== null && `${num1(q.grams)} g`}{q.hours !== null && ` · ${duration(q.hours)}`}
              {q.method && ` · ${q.method === "slicer" ? "laminado" : "estimado"}`}
            </div>
          </div>
        )}
        <button className="btn btn-primary" onClick={download} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 12, fontSize: 14 }}>
          <Icon d="M12 4v12 M7 11l5 5 5-5 M4 20h16" size={18} stroke={2} />
          {busy ? "Preparando…" : "Descargar"}
        </button>
      </div>
      {error && <p style={{ flexBasis: "100%", color: "var(--bad)", fontSize: 13, margin: 0 }}>No se pudo descargar: {error}</p>}
    </article>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="status status-info" style={{ marginBottom: 16 }}>{children}</div>;
}

const badge = (color: string) => ({
  fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, color,
  background: `color-mix(in srgb, ${color} 14%, transparent)`,
}) as const;
