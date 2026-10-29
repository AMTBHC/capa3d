"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_URL, whatsappUrl } from "@/lib/config";
import { createDesign, type DesignBrief, type DesignContact, type DesignUse } from "@/lib/api";
import { COLORS, MATERIALS } from "@/lib/catalog";
import { designPath, saveDesign } from "@/lib/myOrders";
import { shrinkImage } from "@/lib/shrinkImage";
import { Icon, ICONS } from "../Icon";
import { DEPARTMENTS, SAVED_CUSTOMER } from "../quoter/OrderDialog";
import { WhatsAppIcon } from "../WhatsAppIcon";

const MAX_IMAGES = 6;
const MAX_MB = 10;

const USES: [DesignUse, string][] = [
  ["figura", "Figura o personaje"],
  ["regalo", "Regalo"],
  ["decoracion", "Decoración"],
  ["repuesto", "Repuesto o pieza"],
  ["funcional", "Algo funcional"],
  ["otro", "Otro"],
];

const EMPTY_CONTACT: DesignContact = { name: "", phone: "", email: "", city: "", department: "", address: "" };

interface Ref {
  file: File;
  url: string;
}

/** Solicitud de diseño a medida: fotos o bocetos de referencia, qué quiere y cómo contactarlo. */
export function DesignForm() {
  const router = useRouter();
  const [refs, setRefs] = useState<Ref[]>([]);
  const [drag, setDrag] = useState(false);
  const [brief, setBrief] = useState<DesignBrief>({
    description: "", use: "figura", size_cm: null, qty: 1, material: "", color: "", deadline: "", budget: null,
  });
  const [contact, setContact] = useState<DesignContact>(EMPTY_CONTACT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const refsNow = useRef(refs);
  useEffect(() => {
    refsNow.current = refs;
  }, [refs]);

  useEffect(() => {
    // Datos de un pedido anterior en este navegador.
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_CUSTOMER) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContact((c) => ({ ...c, ...Object.fromEntries(Object.entries(saved).filter(([k]) => k in EMPTY_CONTACT)) }));
    } catch {
      // sin datos guardados
    }
    return () => refsNow.current.forEach((r) => URL.revokeObjectURL(r.url));
  }, []);

  const add = (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next = [...refs];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) {
        setError(`Puedes subir hasta ${MAX_IMAGES} imágenes.`);
        break;
      }
      if (!/^image\//.test(file.type) && file.type !== "application/pdf" && !/\.(heic|heif|pdf)$/i.test(file.name)) {
        setError(`“${file.name}” no es una foto ni un PDF.`);
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setRefs(next);
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(refs[i].url);
    setRefs(refs.filter((_, j) => j !== i));
  };

  const setB = <K extends keyof DesignBrief>(k: K, v: DesignBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));
  const setC = (k: keyof DesignContact) => (e: { target: { value: string } }) => setContact((c) => ({ ...c, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!refs.length) {
      setError("Sube al menos una foto, boceto o captura de lo que quieres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const files = await Promise.all(refs.map((r) => shrinkImage(r.file)));
      const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
      if (big) throw new Error(`“${big.name}” pesa más de ${MAX_MB} MB.`);
      const d = await createDesign(contact, brief, files);
      try {
        const prev = JSON.parse(localStorage.getItem(SAVED_CUSTOMER) ?? "{}");
        localStorage.setItem(SAVED_CUSTOMER, JSON.stringify({ ...prev, ...contact }));
      } catch {
        // sin almacenamiento
      }
      saveDesign({ id: d.id, token: d.token, created_at: d.created_at, description: d.brief.description, status_label: d.status_label });
      router.push(`${designPath(d.id, d.token)}&nuevo=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (!API_URL) {
    return (
      <div className="status status-info">
        <span>Escríbenos por WhatsApp con tus fotos de referencia y te ayudamos con tu diseño.</span>
        <a className="btn btn-primary" href={whatsappUrl("Hola, quiero un diseño a medida para imprimir en 3D.")} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12 }}>
          <WhatsAppIcon size={16} /> WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="design-form">
      <section className="step">
        <div className="step-head">
          <span className="step-n">1</span>
          <div>
            <h2 className="step-title">Tus referencias</h2>
            <p className="step-sub">Fotos de lo que quieres, desde varios ángulos si puedes. También sirven bocetos, capturas o un PDF con medidas.</p>
          </div>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className="ref-grid"
          style={{ outline: drag ? "2px dashed var(--ac)" : "none", outlineOffset: 4, borderRadius: 16 }}
        >
          {refs.map((r, i) => (
            <figure key={r.url} className="ref-tile">
              {r.file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.url} alt={`Referencia ${i + 1}`} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : null}
              <figcaption>{r.file.name}</figcaption>
              <button type="button" onClick={() => remove(i)} aria-label={`Quitar ${r.file.name}`} className="ref-remove">
                <Icon d={ICONS.close} size={14} stroke={2.2} />
              </button>
            </figure>
          ))}
          {refs.length < MAX_IMAGES && (
            <button type="button" className="ref-add" onClick={() => input.current?.click()}>
              <Icon d={ICONS.upload} size={26} />
              <span style={{ fontWeight: 600 }}>{refs.length ? "Agregar otra" : "Subir fotos"}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Hasta {MAX_IMAGES} · JPG, PNG, HEIC o PDF</span>
            </button>
          )}
        </div>
        <input ref={input} type="file" multiple accept="image/*,application/pdf" hidden
          onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </section>

      <section className="step">
        <div className="step-head">
          <span className="step-n">2</span>
          <div>
            <h2 className="step-title">Qué quieres</h2>
            <p className="step-sub">Entre más detalles, mejor queda la primera propuesta.</p>
          </div>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
          <legend style={{ fontSize: 13, color: "var(--text-2)", padding: 0, marginBottom: 6 }}>¿Para qué es?</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {USES.map(([id, name]) => (
              <button key={id} type="button" className="chip-btn" aria-pressed={brief.use === id} onClick={() => setB("use", id)}>{name}</button>
            ))}
          </div>
        </fieldset>
        <Field label="Descripción">
          <textarea className="input" required minLength={10} maxLength={2000} rows={5} value={brief.description}
            onChange={(e) => setB("description", e.target.value)}
            placeholder="Ej.: Una figura de mi perro sentado como en la foto, con su nombre en la base. Que se vea la mancha café de la oreja."
            style={{ resize: "vertical" }} />
        </Field>
        <div className="form-cols">
          <Field label="Medida aproximada (cm, lo más largo)">
            <input className="input" type="number" inputMode="decimal" min={0.5} max={200} step="any" placeholder="Ej.: 12"
              value={brief.size_cm ?? ""} onChange={(e) => setB("size_cm", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Cantidad">
            <input className="input" type="number" inputMode="numeric" min={1} max={500} required
              value={brief.qty} onChange={(e) => setB("qty", Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Material (opcional)">
            <select className="input" value={brief.material} onChange={(e) => setB("material", e.target.value)}>
              <option value="">Que me recomienden</option>
              {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
          </Field>
          <Field label="Color (opcional)">
            <input className="input" list="design-colors" maxLength={60} placeholder="Ej.: Blanco, o varios colores"
              value={brief.color} onChange={(e) => setB("color", e.target.value)} />
            <datalist id="design-colors">
              {COLORS.map((c) => <option key={c.name} value={c.name} />)}
              <option value="Varios colores" />
            </datalist>
          </Field>
          <Field label="¿Para cuándo lo necesitas? (opcional)">
            <input className="input" type="date" min={new Date().toISOString().slice(0, 10)}
              value={brief.deadline} onChange={(e) => setB("deadline", e.target.value)} />
          </Field>
          <Field label="Presupuesto aproximado (opcional)">
            <input className="input" type="number" inputMode="numeric" min={0} step={1000} placeholder="Ej.: 80000"
              value={brief.budget ?? ""} onChange={(e) => setB("budget", e.target.value ? Number(e.target.value) : null)} />
          </Field>
        </div>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="step-n">3</span>
          <div>
            <h2 className="step-title">Cómo te contactamos</h2>
            <p className="step-sub">Te escribimos por WhatsApp o correo para afinar detalles y enviarte la propuesta.</p>
          </div>
        </div>
        <Field label="Nombre completo"><input className="input" required minLength={2} maxLength={80} autoComplete="name" value={contact.name} onChange={setC("name")} /></Field>
        <div className="form-cols">
          <Field label="Celular (WhatsApp)"><input className="input" required type="tel" inputMode="tel" autoComplete="tel" placeholder="300 123 4567" value={contact.phone} onChange={setC("phone")} /></Field>
          <Field label="Correo"><input className="input" required type="email" autoComplete="email" value={contact.email} onChange={setC("email")} /></Field>
          <Field label="Departamento">
            <select className="input" required value={contact.department} onChange={setC("department")}>
              <option value="" disabled>Elige…</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Ciudad o municipio"><input className="input" required minLength={2} maxLength={60} autoComplete="address-level2" value={contact.city} onChange={setC("city")} /></Field>
        </div>
        <Field label="Dirección de envío (opcional, la puedes dar después)">
          <input className="input" maxLength={200} autoComplete="street-address" placeholder="Calle 10 # 20-30, apto 401, barrio" value={contact.address} onChange={setC("address")} />
        </Field>

        <div className="status status-info" style={{ margin: "6px 0 16px" }}>
          <span aria-hidden="true" style={{ fontSize: 18 }}>📐</span>
          <span><strong>No pagas nada por enviar la solicitud.</strong> Revisamos tus referencias, te contamos el precio del diseño y la impresión, y solo cuando apruebes la propuesta pagas desde la página de tu pedido.</span>
        </div>
        {error && <p role="alert" style={{ color: "var(--bad)", fontSize: 14, margin: "0 0 12px" }}>{error}</p>}
        <button className="btn btn-primary" disabled={busy} style={{ width: "100%", padding: 16, borderRadius: 16, fontSize: 16 }}>
          {busy ? "Enviando referencias…" : "Enviar solicitud de diseño"}
        </button>
      </section>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text-2)", marginBottom: 14, minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}
