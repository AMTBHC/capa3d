"use client";
/* eslint-disable @next/next/no-img-element -- vistas previas locales */

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createDesign, type DesignBrief, type DesignContact } from "@/lib/api";
import { API_URL, whatsappUrl } from "@/lib/config";
import { NEEDS, REASSURANCE, REQUEST_TYPES, SIZE_PRESETS, type RequestUse } from "@/lib/content";
import { money } from "@/lib/format";
import { designPath, saveDesign } from "@/lib/myOrders";
import { shrinkImage } from "@/lib/shrinkImage";
import { ColorPicker, OptionGroup, QtyStepper } from "../catalog/Pickers";
import { Icon, ICONS } from "../Icon";
import { WhatsAppIcon } from "../WhatsAppIcon";

const MAX_IMAGES = 6;
const MAX_MB = 10;
const MIN_DESCRIPTION = 10;
/** Mismo lugar donde el pedido guarda los datos del cliente, para no pedirlos dos veces. */
const SAVED_CUSTOMER = "capa3d-cliente";

const STEPS = ["¿Qué necesitas?", "Tamaño y color", "Tus datos"];

const PLACEHOLDER: Record<RequestUse, string> = {
  repuesto: "Ej.: Se rompió la perilla de mi estufa. Es redonda, de unos 4 cm, y encaja en un eje con un lado plano.",
  figura: "Ej.: Una figura de mi perro sentado como en la foto, con su nombre en la base, para regalo.",
  maqueta: "Ej.: Maqueta de una casa de dos pisos para un proyecto del colegio, a partir de este plano.",
  decoracion: "Ej.: Un letrero con el nombre de mi tienda para poner en la pared, en morado y blanco.",
  otro: "Cuéntanos qué es, para qué lo vas a usar y cualquier detalle importante.",
};

interface Photo {
  file: File;
  url: string;
}

interface Contact {
  name: string;
  phone: string;
  email: string;
  city: string;
}

type Errors = Partial<Record<"description" | "size" | "name" | "phone" | "email" | "photos" | "submit", string>>;

const phoneOk = (v: string) => {
  const n = v.replace(/\D/g, "").length;
  return n >= 7 && n <= 15;
};
const emailOk = (v: string) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/**
 * "Mándanos tu foto o idea": pedido a medida guiado en tres pasos, pensado para el celular.
 * Fotos opcionales; lo único obligatorio es contar qué necesita y dejar nombre y WhatsApp.
 */
export function PhotoRequestForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [drag, setDrag] = useState(false);
  const [use, setUse] = useState<RequestUse>("otro");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<number | null>(null);
  const [customCm, setCustomCm] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState(1);
  const [material, setMaterial] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "", city: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sentByWhatsApp, setSentByWhatsApp] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photosNow = useRef(photos);
  useEffect(() => {
    photosNow.current = photos;
  }, [photos]);

  useEffect(() => {
    // Datos de un pedido anterior en este navegador.
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_CUSTOMER) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContact((c) => ({ name: saved.name ?? c.name, phone: saved.phone ?? c.phone, email: saved.email ?? c.email, city: saved.city ?? c.city }));
    } catch {
      // sin datos guardados
    }
    return () => photosNow.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  const sizeCm: number | null = preset === -1 ? (Number(customCm) > 0 ? Number(customCm) : null) : preset !== null ? SIZE_PRESETS[preset].cm : null;
  const typeLabel = REQUEST_TYPES.find((t) => t.use === use)?.label ?? "Otra idea";

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    let error = "";
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) {
        error = `Puedes subir hasta ${MAX_IMAGES} fotos.`;
        break;
      }
      if (!/^image\//.test(file.type) && file.type !== "application/pdf" && !/\.(heic|heif|pdf)$/i.test(file.name)) {
        error = `“${file.name}” no es una foto ni un PDF.`;
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
    setErrors((e) => ({ ...e, photos: error || undefined }));
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photos[i].url);
    setPhotos(photos.filter((_, j) => j !== i));
  };

  /** Revisa el paso actual; devuelve los errores encontrados. */
  const check = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0 && description.trim().length < MIN_DESCRIPTION) {
      e.description = "Cuéntanos en una frase qué necesitas (por ejemplo, qué es y para qué lo vas a usar).";
    }
    if (s === 1 && preset === -1 && !(Number(customCm) > 0 && Number(customCm) <= 200)) {
      e.size = "Escribe la medida en centímetros (entre 0,5 y 200), o elige una opción aproximada.";
    }
    if (s === 2) {
      if (contact.name.trim().length < 2) e.name = "Escribe tu nombre.";
      if (!phoneOk(contact.phone)) e.phone = "Escribe tu número de WhatsApp, por ejemplo 300 123 4567.";
      if (!emailOk(contact.email)) e.email = "Revisa el correo, o déjalo vacío.";
    }
    return e;
  };

  const focusFirstError = () => {
    requestAnimationFrame(() => top.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
  };

  const goTo = (s: number) => {
    setStep(s);
    setErrors({});
    requestAnimationFrame(() => {
      const box = top.current;
      if (!box) return;
      if (box.getBoundingClientRect().top < 70) box.scrollIntoView({ behavior: "smooth", block: "start" });
      box.querySelector<HTMLElement>(".step-panel h3")?.focus({ preventScroll: true });
    });
  };

  const next = () => {
    const e = check(step);
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError();
    goTo(step + 1);
  };

  const brief = (): DesignBrief => ({
    description: description.trim(), use, size_cm: sizeCm, qty, material, color,
    deadline, budget: Number(budget) > 0 ? Math.round(Number(budget)) : null,
  });

  const summary = [
    typeLabel,
    photos.length ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}` : "sin fotos",
    sizeCm ? `~${sizeCm} cm` : "medida por definir",
    color || "color a recomendar",
    `${qty} ${qty === 1 ? "unidad" : "unidades"}`,
  ];

  const whatsappText = () => {
    const b = brief();
    const need = NEEDS.find((n) => n.material === b.material);
    const lines = [
      "Hola 👋 Quiero pedir una pieza a medida:",
      "",
      `• Qué es: ${typeLabel}`,
      `• Descripción: ${b.description}`,
      `• Medida aproximada: ${b.size_cm ? `${b.size_cm} cm` : "no la sé (te mando foto con referencia)"}`,
      `• Color: ${b.color || "que me recomienden"}`,
      `• Cantidad: ${b.qty}`,
    ];
    if (need) lines.push(`• Necesita: ${need.label.toLowerCase()}`);
    if (b.deadline) lines.push(`• Para el: ${b.deadline}`);
    if (b.budget) lines.push(`• Presupuesto aproximado: $${money(b.budget)}`);
    lines.push("", `Soy ${contact.name.trim()}${contact.city.trim() ? `, de ${contact.city.trim()}` : ""}.`);
    if (photos.length) lines.push(`Te envío ${photos.length === 1 ? "la foto" : `las ${photos.length} fotos`} por aquí 📎`);
    return lines.join("\n");
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (step < STEPS.length - 1) return next();
    const all = { ...check(0), ...check(1), ...check(2) };
    setErrors(all);
    if (all.description) return goTo(0);
    if (all.size) return goTo(1);
    if (Object.keys(all).length) return focusFirstError();

    try {
      const prev = JSON.parse(localStorage.getItem(SAVED_CUSTOMER) ?? "{}");
      localStorage.setItem(SAVED_CUSTOMER, JSON.stringify({ ...prev, ...contact }));
    } catch {
      // sin almacenamiento: solo no se recuerdan los datos
    }

    // Sin la API, la solicitud sale por WhatsApp y las fotos se adjuntan en el chat.
    if (!API_URL) {
      window.open(whatsappUrl(whatsappText()), "_blank", "noopener,noreferrer");
      setSentByWhatsApp(true);
      return;
    }

    setBusy(true);
    try {
      const files = await Promise.all(photos.map((p) => shrinkImage(p.file)));
      const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
      if (big) throw new Error(`“${big.name}” pesa más de ${MAX_MB} MB. Quítala o envíala por WhatsApp.`);
      const c: DesignContact = { name: contact.name.trim(), phone: contact.phone, email: contact.email.trim(), city: contact.city.trim(), department: "", address: "" };
      const d = await createDesign(c, brief(), files);
      saveDesign({ id: d.id, token: d.token, created_at: d.created_at, description: d.brief.description, status_label: d.status_label });
      router.push(`${designPath(d.id, d.token)}&nuevo=1`);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };

  if (sentByWhatsApp) {
    return (
      <div className="form-card" ref={top}>
        <div className="done">
          <span className="done-icon"><Icon d={ICONS.check} size={30} stroke={3} /></span>
          <h3 className="step-h">¡Listo, {contact.name.trim().split(/\s+/)[0]}!</h3>
          <p>Abrimos WhatsApp con tu solicitud. Solo falta que toques <strong>Enviar</strong>{photos.length ? <> y adjuntes {photos.length === 1 ? "tu foto" : "tus fotos"} con el clip 📎</> : null}.</p>
          <a className="btn btn-wa btn-lg btn-block" href={whatsappUrl(whatsappText())} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={20} />Abrir WhatsApp otra vez
          </a>
          <button type="button" className="link-btn" onClick={() => { setSentByWhatsApp(false); setStep(0); }}>Hacer otra solicitud</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={top} className="form-wrap">
      <form className="form-card" onSubmit={submit} noValidate aria-label="Pedido a medida">
        <div className="stepper" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className="stepper-seg" data-state={i < step ? "done" : i === step ? "now" : undefined}>
              <span className="stepper-bar" />
              <span className="stepper-label">{s}</span>
            </span>
          ))}
        </div>
  
        {step === 0 && (
          <Panel n={1} title="¿Qué necesitas?" sub="Elige lo más parecido y cuéntanos con tus palabras.">
            <OptionGroup label="Es un…">
              <div className="type-grid">
                {REQUEST_TYPES.map((t) => (
                  <button key={t.use} type="button" className="type-card" aria-pressed={use === t.use} onClick={() => setUse(t.use)}>
                    <span className="type-emoji" aria-hidden="true">{t.emoji}</span>
                    <span className="type-label">{t.label}</span>
                    <span className="type-hint">{t.hint}</span>
                  </button>
                ))}
              </div>
            </OptionGroup>
  
            <OptionGroup label="Fotos o bocetos" value={<span className="muted">opcional, pero ayuda mucho</span>}>
              <div className={`dropzone${drag ? " is-drag" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addPhotos(e.dataTransfer.files); }}>
                {photos.length > 0 && (
                  <div className="thumbs">
                    {photos.map((p, i) => (
                      <figure key={p.url} className="thumb">
                        {p.file.type.startsWith("image/")
                          ? <img src={p.url} alt={`Foto ${i + 1}`} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          : <Icon d={ICONS.file} size={28} />}
                        <button type="button" className="thumb-x" onClick={() => removePhoto(i)} aria-label={`Quitar ${p.file.name}`}>
                          <Icon d={ICONS.close} size={14} stroke={2.6} />
                        </button>
                      </figure>
                    ))}
                  </div>
                )}
                {photos.length < MAX_IMAGES && (
                  <button type="button" className="drop-btn" onClick={() => fileInput.current?.click()}>
                    <span className="drop-icon"><Icon d={ICONS.camera} size={24} stroke={2} /></span>
                    <span>
                      <strong>{photos.length ? "Agregar otra foto" : "Tomar o subir fotos"}</strong>
                      <span className="drop-sub">Hasta {MAX_IMAGES}: desde varios ángulos, con una regla o moneda al lado si puedes.</span>
                    </span>
                  </button>
                )}
                <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" hidden
                  onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              </div>
              {errors.photos && <p className="field-error" role="alert">{errors.photos}</p>}
            </OptionGroup>
  
            <Field label="Cuéntanos qué necesitas" error={errors.description} htmlFor="req-desc">
              <textarea id="req-desc" className="input" rows={4} maxLength={2000} value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder={PLACEHOLDER[use]}
                aria-invalid={!!errors.description} aria-describedby="req-desc-msg" />
            </Field>
          </Panel>
        )}
  
        {step === 1 && (
          <Panel n={2} title="Tamaño y color" sub="Si no sabes la medida exacta, no pasa nada: la revisamos contigo.">
            <OptionGroup label="Tamaño aproximado">
              <div className="size-grid">
                {SIZE_PRESETS.map((s, i) => (
                  <Fragment key={s.label}>
                    {/* "Sé la medida" va justo antes de "No sé", que cierra la lista. */}
                    {s.cm === null && (
                      <button type="button" className="opt-chip opt-chip-col" aria-pressed={preset === -1} onClick={() => setPreset(-1)}>
                        Sé la medida<span className="opt-chip-hint">en centímetros</span>
                      </button>
                    )}
                    <button type="button" className="opt-chip opt-chip-col" aria-pressed={preset === i} onClick={() => setPreset(i)}>
                      {s.label}<span className="opt-chip-hint">{s.hint}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
              {preset === -1 && (
                <Field label="Lo más largo de la pieza (cm)" error={errors.size} htmlFor="req-cm">
                  <input id="req-cm" className="input" type="number" inputMode="decimal" min={0.5} max={200} step="any" placeholder="Ej.: 12"
                    value={customCm} onChange={(e) => setCustomCm(e.target.value)} aria-invalid={!!errors.size} aria-describedby="req-cm-msg" />
                </Field>
              )}
              <p className="tip"><Icon d={ICONS.ruler} size={18} stroke={2} /><span><strong>Tip:</strong> una foto con una regla, un metro o una moneda al lado nos dice el tamaño exacto.</span></p>
            </OptionGroup>
  
            <ColorPicker value={color} onChange={setColor} extra={
              <>
                <button type="button" className="opt-chip opt-chip-sm" aria-pressed={color === "Varios colores"} onClick={() => setColor("Varios colores")}>Varios colores</button>
                <button type="button" className="opt-chip opt-chip-sm" aria-pressed={color === ""} onClick={() => setColor("")}>Que me recomienden</button>
              </>
            } />
  
            <QtyStepper value={qty} onChange={setQty} label="¿Cuántas unidades?" />
  
            <details className="more-box">
              <summary>Más detalles <span className="muted">(opcional)</span></summary>
              <OptionGroup label="¿Necesita algo especial?">
                <div className="opt-row">
                  {NEEDS.map((n) => (
                    <button key={n.material} type="button" className="opt-chip" aria-pressed={material === n.material}
                      onClick={() => setMaterial(material === n.material ? "" : n.material)}>{n.label}</button>
                  ))}
                </div>
              </OptionGroup>
              <div className="form-cols">
                <Field label="¿Para cuándo lo necesitas?" htmlFor="req-date">
                  <input id="req-date" className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </Field>
                <Field label="Presupuesto aproximado ($)" htmlFor="req-budget">
                  <input id="req-budget" className="input" type="number" inputMode="numeric" min={0} step={1000} placeholder="Ej.: 80000" value={budget} onChange={(e) => setBudget(e.target.value)} />
                </Field>
              </div>
            </details>
          </Panel>
        )}
  
        {step === 2 && (
          <Panel n={3} title="¿Cómo te contactamos?" sub="Te escribimos por WhatsApp para revisar detalles y enviarte el precio.">
            <Field label="Tu nombre" error={errors.name} htmlFor="req-name">
              <input id="req-name" className="input" autoComplete="name" maxLength={80} value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })} aria-invalid={!!errors.name} aria-describedby="req-name-msg" />
            </Field>
            <Field label="Tu WhatsApp" error={errors.phone} htmlFor="req-phone">
              <input id="req-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="300 123 4567" maxLength={20} value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })} aria-invalid={!!errors.phone} aria-describedby="req-phone-msg" />
            </Field>
            <div className="form-cols">
              <Field label="Correo" optional error={errors.email} htmlFor="req-email">
                <input id="req-email" className="input" type="email" autoComplete="email" maxLength={120} value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby="req-email-msg" />
              </Field>
              <Field label="Ciudad" optional htmlFor="req-city">
                <input id="req-city" className="input" autoComplete="address-level2" maxLength={60} placeholder="Para calcular el envío" value={contact.city}
                  onChange={(e) => setContact({ ...contact, city: e.target.value })} />
              </Field>
            </div>
  
            <div className="summary-box">
              <span className="field-label-sm">Tu solicitud</span>
              <p>{summary.join(" · ")}</p>
              <button type="button" className="link-btn" onClick={() => goTo(0)}>Cambiar algo</button>
            </div>
  
            <div className="reassure">
              <Icon d={ICONS.shield} size={22} stroke={2} />
              <p><strong>No pagas nada por enviar la solicitud.</strong> {REASSURANCE}</p>
            </div>
            {errors.submit && <p className="field-error" role="alert">{errors.submit}</p>}
          </Panel>
        )}
  
        <div className="form-nav" data-hide-fab="">
          {step > 0 && (
            <button type="button" className="btn btn-ghost btn-lg" onClick={() => goTo(step - 1)} disabled={busy}>
              <Icon d={ICONS.back} size={18} stroke={2.2} />Atrás
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="submit" className="btn btn-primary btn-lg grow">
              Siguiente<Icon d={ICONS.arrow} size={18} stroke={2.2} />
            </button>
          ) : (
            <button type="submit" className={`btn btn-lg grow ${API_URL ? "btn-primary" : "btn-wa"}`} disabled={busy}>
              {busy ? <><span className="spin spin-light" />Enviando…</> : API_URL ? "Enviar mi solicitud" : <><WhatsAppIcon size={20} />Enviar por WhatsApp</>}
            </button>
          )}
        </div>
        <p className="form-foot">Paso {step + 1} de {STEPS.length} · Te respondemos por WhatsApp</p>
      </form>
    </div>
  );
}

function Panel({ n, title, sub, children }: { n: number; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="step-panel">
      <div className="step-top">
        <span className="step-num" aria-hidden="true">{n}</span>
        <div>
          <h3 className="step-h" tabIndex={-1}><span className="sr-only">Paso {n} de {STEPS.length}: </span>{title}</h3>
          <p className="step-p">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, optional, htmlFor, children }: { label: string; error?: string; optional?: boolean; htmlFor: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field-label-sm" htmlFor={htmlFor}>
        {label} {optional && <span className="muted">(opcional)</span>}
      </label>
      {children}
      <p id={`${htmlFor}-msg`} className="field-error" role={error ? "alert" : undefined} hidden={!error}>{error}</p>
    </div>
  );
}
