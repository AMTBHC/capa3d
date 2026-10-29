"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminDesignAction, adminDesignImage, adminDesignOrder, ApiError, listAdminDesigns, watchAdmin,
  type AdminDesign, type DesignActionName, type DesignStatus,
} from "@/lib/api";
import { COLORS, MATERIALS, QUALITIES } from "@/lib/catalog";
import { money } from "@/lib/format";
import { orderPath } from "@/lib/myOrders";
import { useModelAccept } from "@/lib/useModelAccept";
import { actionBtn, Box, field, Line, Money, Text, waPhone } from "./OrdersTab";

const REFRESH_MS = 30_000;

const FILTERS: [string, DesignStatus[] | null][] = [
  ["Nuevas", ["received"]],
  ["En curso", ["designing", "proposal"]],
  ["Con pedido", ["ordered"]],
  ["Canceladas", ["cancelled"]],
  ["Todas", null],
];

const STATUS_COLOR: Record<DesignStatus, string> = {
  received: "var(--warn)",
  designing: "var(--ac)",
  proposal: "var(--ac)",
  ordered: "var(--ok)",
  cancelled: "var(--bad)",
};

const USE_LABEL: Record<string, string> = {
  figura: "Figura o personaje", regalo: "Regalo", decoracion: "Decoración", repuesto: "Repuesto o pieza", funcional: "Funcional", otro: "Otro",
};

function message(d: AdminDesign): string {
  const first = d.contact.name.split(" ")[0];
  switch (d.status) {
    case "received":
      return `Hola ${first}, soy de CR3D. Recibí tu solicitud de diseño ${d.id} ("${d.brief.description.slice(0, 80)}"). Te hago unas preguntas para darte el precio y empezar.`;
    case "designing":
      return `Hola ${first}, ya estamos diseñando tu modelo ${d.id}. Te aviso cuando tenga la propuesta. Puedes seguirlo aquí: ${d.design_url}`;
    case "proposal":
      return `Hola ${first}, te comparto la propuesta de tu diseño ${d.id}. ¿Qué te parece? Si la apruebas, te envío el pedido para pagar.`;
    case "ordered":
      return `Hola ${first}, tu diseño ${d.id} está listo. Aquí puedes ver el pedido con el precio final y pagarlo: ${d.design_url}`;
    case "cancelled":
      return `Hola ${first}, cerramos tu solicitud de diseño ${d.id}. Si quieres retomarla, escríbeme.`;
  }
}

export function DesignsTab({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [designs, setDesigns] = useState<AdminDesign[] | null>(null);
  const [filter, setFilter] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      setDesigns(await listAdminDesigns(token, []));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, onUnauthorized]);

  useEffect(() => watchAdmin(token, () => { load(); }, setLive), [token, load]);

  useEffect(() => {
    if (live) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const replace = (d: AdminDesign) => setDesigns((list) => list?.map((x) => (x.id === d.id ? d : x)) ?? null);
  const statuses = FILTERS[filter][1];
  const shown = designs?.filter((d) => !statuses || statuses.includes(d.status) || d.id === open) ?? [];

  return (
    <>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-3)" }}>
        Solicitudes de <Link href="/disenos" target="_blank">diseño a medida</Link>: el cliente manda fotos o bocetos. Cuando tengas el modelo listo, súbelo con el precio y se crea el pedido para que pague.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {FILTERS.map(([label, st], i) => {
          const n = designs?.filter((d) => !st || st.includes(d.status)).length ?? 0;
          return (
            <button key={label} className="chip-btn" aria-pressed={filter === i} onClick={() => setFilter(i)}>
              {label}{n > 0 && ` · ${n}`}
            </button>
          );
        })}
        <button className="chip-btn" onClick={load} style={{ marginLeft: "auto" }}>Actualizar</button>
      </div>
      {error && <div className="status status-warn" style={{ marginBottom: 12 }}>No se pudo cargar: {error}</div>}
      {designs && shown.length === 0 && <div className="status status-info">No hay solicitudes en “{FILTERS[filter][0]}”.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((d) => {
          const color = STATUS_COLOR[d.status];
          const isOpen = open === d.id;
          return (
            <article key={d.id} style={{ borderRadius: 18, background: "var(--surface)", border: `1px solid ${isOpen ? "var(--ac-line)" : "var(--line)"}`, overflow: "hidden" }}>
              <button onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "none", border: 0, color: "var(--text)", cursor: "pointer", textAlign: "left" }}>
                <span className="mono" style={{ color: "var(--ac)", fontWeight: 600 }}>{d.id}</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{d.status_label}</span>
                <span style={{ flex: "1 1 220px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong style={{ fontWeight: 600 }}>{d.contact.name}</strong>
                  <span style={{ color: "var(--text-3)", fontSize: 13 }}> · {d.contact.city} · {d.brief.description}</span>
                </span>
                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{d.images.length} {d.images.length === 1 ? "imagen" : "imágenes"}</span>
                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{new Date(d.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
              </button>
              {isOpen && <DesignDetail d={d} token={token} onChange={replace} />}
            </article>
          );
        })}
      </div>
    </>
  );
}

function DesignDetail({ d, token, onChange }: { d: AdminDesign; token: string; onChange: (d: AdminDesign) => void }) {
  const [note, setNote] = useState(d.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const c = d.contact, b = d.brief;

  const run = async (action: DesignActionName, text?: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    setError("");
    try {
      onChange(await adminDesignAction(token, d.id, action, text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.design_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace de la solicitud:", d.design_url);
    }
  };

  const notify = `https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(message(d))}`;
  const open = d.status !== "ordered" && d.status !== "cancelled";

  return (
    <div style={{ padding: "0 16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <Box title="Referencias">
        <Images d={d} token={token} />
      </Box>

      <Box title="Lo que pide">
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5, margin: "0 0 8px", overflowWrap: "anywhere" }}>{b.description}</p>
        <Line muted>
          {[USE_LABEL[b.use], b.size_cm ? `~${b.size_cm} cm` : null, `cantidad ${b.qty}`, b.material || null, b.color || null].filter(Boolean).join(" · ")}
        </Line>
        {b.deadline && <Line muted>Para: {new Date(`${b.deadline}T12:00:00`).toLocaleDateString("es-CO", { dateStyle: "long" })}</Line>}
        {b.budget ? <Line muted>Presupuesto: ${money(b.budget)}</Line> : null}
      </Box>

      <Box title="Cliente">
        <Line>{c.name}</Line>
        <Line><a href={`https://wa.me/${waPhone(c.phone)}`} target="_blank" rel="noopener noreferrer">{c.phone}</a> · <a href={`mailto:${c.email}`}>{c.email}</a></Line>
        <Line>{c.address ? `${c.address}, ` : ""}{c.city} ({c.department})</Line>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <a className="btn" href={notify} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "#25D366", color: "#06210F" }}>
            Escribir al cliente por WhatsApp
          </a>
          <button className="chip-btn" onClick={copy}>{copied ? "¡Copiado!" : "Copiar enlace"}</button>
        </div>
      </Box>

      <Box title="Estado">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(d.status === "received" || d.status === "proposal") && (
            <button className="chip-btn" disabled={busy} onClick={() => run("designing")}>{d.status === "proposal" ? "Volver a diseño (cambios)" : "Empezar diseño"}</button>
          )}
          {(d.status === "received" || d.status === "designing") && (
            <button className="chip-btn" disabled={busy} onClick={() => run("proposal")}>Envié la propuesta</button>
          )}
          {open && (
            <button className="chip-btn" disabled={busy} style={{ color: "var(--bad)" }} onClick={() => run("cancel", undefined, `¿Cerrar la solicitud ${d.id}?`)}>Cancelar</button>
          )}
          {d.status === "cancelled" && <button className="chip-btn" disabled={busy} onClick={() => run("reopen")}>Reabrir</button>}
        </div>
        {d.order && (
          <Link className="btn btn-primary" href={orderPath(d.order.id, d.order.token)} target="_blank" style={{ ...actionBtn, display: "block", textAlign: "center" }}>
            Ver página del pedido {d.order.id}
          </Link>
        )}
        <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
          Notas internas (el cliente no las ve)
          <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...field, resize: "vertical", fontFamily: "inherit" }} />
        </label>
        <button className="chip-btn" disabled={busy || note === d.note} style={{ marginTop: 6 }} onClick={() => run("note", note)}>Guardar nota</button>
        <div style={{ marginTop: 12 }}>
          {d.events.map((e, i) => (
            <Line key={i} muted>{new Date(e.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })} · {STATUS_LABEL[e.status] ?? e.status}{e.note ? ` — ${e.note}` : ""}</Line>
          ))}
        </div>
        {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
      </Box>

      {open && <MakeOrder d={d} token={token} onChange={onChange} />}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  received: "Recibida", designing: "En diseño", proposal: "Propuesta enviada", ordered: "Pedido creado", cancelled: "Cancelada",
};

/** Las imágenes llevan la clave del panel: se bajan con fetch y se muestran como blobs. */
function Images({ d, token }: { d: AdminDesign; token: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const made = useRef<string[]>([]);

  const names = d.images.join("|");
  useEffect(() => {
    let alive = true;
    names.split("|").forEach(async (name) => {
      try {
        const url = URL.createObjectURL(await adminDesignImage(token, d.id, name));
        made.current.push(url);
        if (alive) setUrls((u) => ({ ...u, [name]: url }));
      } catch {
        // queda el nombre sin vista previa
      }
    });
    return () => {
      alive = false;
      made.current.forEach((u) => URL.revokeObjectURL(u));
      made.current = [];
    };
  }, [d.id, names, token]);

  return (
    <div className="ref-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
      {d.images.map((name) => (
        <a key={name} className="ref-tile" href={urls[name]} target="_blank" rel="noreferrer" download={`${d.id}-${name}`}>
          {urls[name] && !name.endsWith(".pdf") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[name]} alt={name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <span className="mono" style={{ position: "relative", padding: "4px 6px", fontSize: 11, background: "var(--glass)", width: "100%" }}>{name}</span>
        </a>
      ))}
    </div>
  );
}

/** Subir el modelo terminado con el precio: crea el pedido confirmado para que el cliente pague. */
function MakeOrder({ d, token, onChange }: { d: AdminDesign; token: string; onChange: (d: AdminDesign) => void }) {
  const accept = useModelAccept();
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [material, setMaterial] = useState(d.brief.material || "PLA");
  const [quality, setQuality] = useState("estandar");
  const [infill, setInfill] = useState("20");
  const [color, setColor] = useState(d.brief.color);
  const [address, setAddress] = useState(d.contact.address);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!file) return;
    if (!window.confirm(`¿Crear el pedido de ${d.contact.name} por $${money((+price || 0) + (+shipping || 0))}?`)) return;
    setBusy(true);
    setError("");
    try {
      onChange(await adminDesignOrder(token, d.id, {
        print_price: Math.round(+price || 0), shipping: Math.round(+shipping || 0), material, quality,
        infill: Math.round(+infill || 0), color, address,
      }, file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box title="Crear pedido con el modelo">
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
        Cuando el cliente apruebe la propuesta, sube el modelo y pon el precio total del diseño y la impresión ({d.brief.qty} {d.brief.qty === 1 ? "unidad" : "unidades"}).
        El pedido queda “Por pagar” y el cliente lo ve en su página.
      </p>
      <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
        Modelo (STL, 3MF, OBJ o STEP)
        <input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ ...field, padding: 7 }} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <Money label="Precio (diseño + impresión)" value={price} onChange={setPrice} />
        <Money label="Envío" value={shipping} onChange={setShipping} />
        <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Material
          <select value={material} onChange={(e) => setMaterial(e.target.value)} style={field}>
            {MATERIALS.map((m) => <option key={m.id}>{m.id}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Calidad
          <select value={quality} onChange={(e) => setQuality(e.target.value)} style={field}>
            {QUALITIES.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </label>
        <Text label="Relleno (%)" value={infill} onChange={setInfill} />
        <label style={{ fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Color
          <input list="admin-design-colors" value={color} maxLength={40} onChange={(e) => setColor(e.target.value)} style={field} />
          <datalist id="admin-design-colors">{COLORS.map((x) => <option key={x.name} value={x.name} />)}</datalist>
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <Text label="Dirección de envío" value={address} onChange={setAddress} placeholder="Calle 10 # 20-30, barrio" />
      </div>
      <Line muted>Total para el cliente: ${money((+price || 0) + (+shipping || 0))}</Line>
      <button className="btn btn-primary" disabled={busy || !file || !(+price > 0) || address.trim().length < 5} style={actionBtn} onClick={submit}>
        {busy ? "Subiendo modelo…" : "Crear pedido para pagar"}
      </button>
      {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </Box>
  );
}
