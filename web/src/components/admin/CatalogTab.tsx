"use client";
/* eslint-disable @next/next/no-img-element -- imágenes servidas por la API */

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  ApiError, BADGE_LABEL, deleteCollection, deleteProduct, deleteProductImage, getAdminCatalog, imageUrl, saveCollection, saveProduct,
  uploadCover, uploadProductImage, uploadProductModel, type AdminCollection, type AdminProduct, type Badge, type CollectionInput, type ProductInput,
} from "@/lib/api";
import { COLORS } from "@/lib/catalog";
import { money } from "@/lib/format";

interface Props {
  token: string;
  onUnauthorized: () => void;
}

const MODEL_ACCEPT = ".stl,.obj,.3mf,.step,.stp";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const DEFAULT_SIZES = [{ label: "S", scale: 75 }, { label: "M", scale: 100 }, { label: "L", scale: 150 }];

/** Catálogo de la tienda: colecciones, productos, modelos y fotos. */
export function CatalogTab({ token, onUnauthorized }: Props) {
  const [data, setData] = useState<{ collections: AdminCollection[]; openscad: boolean } | null>(null);
  const [error, setError] = useState("");
  const [editCol, setEditCol] = useState<AdminCollection | "new" | null>(null);
  const [editProd, setEditProd] = useState<{ p: AdminProduct | null; collection: string } | null>(null);

  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return onUnauthorized();
    setError(err instanceof Error ? err.message : String(err));
  }, [onUnauthorized]);

  const load = useCallback(async () => {
    try {
      setData(await getAdminCatalog(token));
      setError("");
    } catch (err) {
      fail(err);
    }
  }, [token, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const cover = async (c: AdminCollection, file: File) => {
    try {
      await uploadCover(token, c.id, file);
      await load();
    } catch (err) {
      fail(err);
    }
  };

  // El editor guarda en la API y luego avisa; el producto abierto se refresca con la respuesta.
  const productSaved = (p: AdminProduct) => {
    setEditProd((x) => (x ? { ...x, p } : x));
    load();
  };

  return (
    <>
      <div className="status status-info" style={{ marginBottom: 16, fontSize: 13 }}>
        Publica solo modelos que puedas vender: tuyos, con licencia comercial o de dominio público. Evita personajes de marcas (Disney, Marvel, Pokémon…) y usa fotos propias de tus impresiones.
      </div>
      {data && !data.openscad && (
        <div className="status status-warn" style={{ marginBottom: 16, fontSize: 13 }}>
          Los llaveros con nombre necesitan OpenSCAD en este computador. Instálalo desde openscad.org y reinicia con <code>iniciar</code>.
        </div>
      )}
      {error && <div className="status status-warn" style={{ marginBottom: 16 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href="/catalogo" target="_blank" className="chip-btn" style={{ textDecoration: "none" }}>Ver catálogo publicado ↗</Link>
        <button className="btn btn-primary" style={{ padding: "10px 16px", borderRadius: 12, fontSize: 14 }} onClick={() => setEditCol("new")}>+ Nueva colección</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data?.collections.map((c) => (
          <section key={c.id} style={{ padding: 18, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--line)", opacity: c.published ? 1 : 0.7 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <label title="Cambiar portada" style={{ position: "relative", width: 72, height: 72, borderRadius: 14, overflow: "hidden", background: "var(--surface-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flex: "0 0 auto" }}>
                {c.cover ? <img src={imageUrl(c.cover)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.emoji || "🧩"}
                <span style={{ position: "absolute", bottom: 0, insetInline: 0, fontSize: 10, textAlign: "center", background: "rgba(0,0,0,.6)", padding: 2 }}>Portada</span>
                <input type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && cover(c, e.target.files[0])} />
              </label>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{c.emoji} {c.name} {!c.published && <span style={{ fontSize: 12, color: "var(--warn)" }}>· oculta</span>}</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>{c.products.length} productos · {c.products.filter((p) => p.published && p.ready).length} visibles</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="chip-btn" onClick={() => setEditCol(c)}>Editar</button>
                <button className="chip-btn" onClick={() => setEditProd({ p: null, collection: c.id })}>+ Producto</button>
              </div>
            </div>
            {c.products.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginTop: 14 }}>
                {c.products.map((p) => (
                  <button key={p.id} onClick={() => setEditProd({ p, collection: c.id })}
                    style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-3)", color: "var(--text)", textAlign: "left", cursor: "pointer" }}>
                    <span style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flex: "0 0 auto", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.images[0] ? <img src={imageUrl(p.images[0])} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📦"}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: !p.ready ? "var(--bad)" : p.published ? "var(--ok)" : "var(--text-3)" }}>
                        {!p.ready ? "Falta el modelo" : p.published ? `Publicado${p.price_from ? ` · $${money(p.price_from)}` : ""}` : "Borrador"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      {editCol && (
        <CollectionEditor token={token} c={editCol === "new" ? null : editCol} onError={fail}
          onDone={() => { setEditCol(null); load(); }} onClose={() => setEditCol(null)} />
      )}
      {editProd && data && (
        <ProductEditor key={editProd.p?.id ?? "new"} token={token} p={editProd.p} collectionId={editProd.collection} collections={data.collections}
          onError={fail} onSaved={productSaved} onDeleted={() => { setEditProd(null); load(); }} onClose={() => setEditProd(null)} />
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 620, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <button className="chip-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, fontSize: 13, color: "var(--text-2)" }}>
      {label}
      {children}
    </label>
  );
}

function CollectionEditor({ token, c, onDone, onClose, onError }: {
  token: string;
  c: AdminCollection | null;
  onDone: () => void;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState<CollectionInput>({ name: c?.name ?? "", description: c?.description ?? "", emoji: c?.emoji ?? "", sort: c?.sort ?? 0, published: c?.published ?? true });
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => saveCollection(token, f, c?.id));
  };

  return (
    <Modal title={c ? `Editar ${c.name}` : "Nueva colección"} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 10 }}>
          <Field label="Emoji"><input className="input" value={f.emoji} maxLength={8} onChange={(e) => setF({ ...f, emoji: e.target.value })} /></Field>
          <Field label="Nombre"><input className="input" required minLength={2} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        </div>
        <Field label="Descripción"><textarea className="input" rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Field label="Orden"><input className="input" type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} style={{ width: 100 }} /></Field>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Publicada
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
          {c ? (
            <button type="button" className="chip-btn" style={{ color: "var(--bad)" }} disabled={busy || c.products.length > 0}
              title={c.products.length ? "Primero mueve o borra sus productos" : undefined}
              onClick={() => confirm(`¿Borrar la colección ${c.name}?`) && run(() => deleteCollection(token, c.id))}>Borrar</button>
          ) : <span />}
          <button className="btn btn-primary" disabled={busy} style={{ padding: "10px 18px", borderRadius: 12 }}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductEditor({ token, p, collectionId, collections, onSaved, onDeleted, onClose, onError }: {
  token: string;
  p: AdminProduct | null;
  collectionId: string;
  collections: AdminCollection[];
  onSaved: (p: AdminProduct) => void;
  onDeleted: () => void;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [f, setF] = useState<ProductInput>({
    collection_id: p?.collection_id ?? collectionId,
    name: p?.name ?? "",
    subsection: p?.subsection ?? "",
    description: p?.description ?? "",
    badges: p?.badges ?? [],
    sizes: p?.sizes ?? DEFAULT_SIZES,
    default_color: p?.default_color ?? "",
    sort: p?.sort ?? 0,
    published: p?.published ?? !!p,
  });
  const [busy, setBusy] = useState("");

  const run = async (what: string, fn: () => Promise<AdminProduct>) => {
    setBusy(what);
    try {
      onSaved(await fn());
    } catch (err) {
      onError(err);
    } finally {
      setBusy("");
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run("save", () => saveProduct(token, f, p?.id));
  };
  const toggleBadge = (b: Badge) => setF({ ...f, badges: f.badges.includes(b) ? f.badges.filter((x) => x !== b) : [...f.badges, b] });
  const setSize = (i: number, patch: Partial<{ label: string; scale: number }>) => setF({ ...f, sizes: f.sizes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const subsections = [...new Set(collections.find((c) => c.id === f.collection_id)?.products.map((x) => x.subsection).filter(Boolean))];

  const remove = async () => {
    if (!p || !confirm(`¿Borrar ${p.name}? Se borran sus fotos.`)) return;
    try {
      await deleteProduct(token, p.id);
      onDeleted();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Modal title={p ? p.name : "Nuevo producto"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nombre"><input className="input" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Colección">
            <select className="input" value={f.collection_id} onChange={(e) => setF({ ...f, collection_id: e.target.value })}>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </Field>
          <Field label="Subsección (opcional)">
            <input className="input" list="subsections" maxLength={60} value={f.subsection} placeholder="Ej: Animales" onChange={(e) => setF({ ...f, subsection: e.target.value })} />
            <datalist id="subsections">{subsections.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>
        <Field label="Descripción"><textarea className="input" rows={3} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>Etiquetas</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {(Object.keys(BADGE_LABEL) as Badge[]).map((b) => (
            <button type="button" key={b} className="chip-btn" aria-pressed={f.badges.includes(b)} onClick={() => toggleBadge(b)}>{BADGE_LABEL[b]}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>Tamaños (escala sobre el modelo original)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {f.sizes.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input" aria-label="Nombre del tamaño" required maxLength={12} value={s.label} onChange={(e) => setSize(i, { label: e.target.value })} style={{ width: 120 }} />
              <input className="input" aria-label="Escala %" type="number" required min={10} max={400} value={s.scale} onChange={(e) => setSize(i, { scale: Number(e.target.value) })} style={{ width: 100 }} />
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>%</span>
              {f.sizes.length > 1 && <button type="button" className="chip-btn" aria-label="Quitar tamaño" onClick={() => setF({ ...f, sizes: f.sizes.filter((_, j) => j !== i) })}>✕</button>}
            </div>
          ))}
          {f.sizes.length < 6 && <button type="button" className="chip-btn" style={{ alignSelf: "flex-start" }} onClick={() => setF({ ...f, sizes: [...f.sizes, { label: "", scale: 100 }] })}>+ Tamaño</button>}
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Field label="Color sugerido">
            <select className="input" value={f.default_color} onChange={(e) => setF({ ...f, default_color: e.target.value })}>
              <option value="">—</option>
              {COLORS.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Orden"><input className="input" type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} style={{ width: 90 }} /></Field>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Publicado
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          {p ? <button type="button" className="chip-btn" style={{ color: "var(--bad)" }} onClick={remove}>Borrar producto</button> : <span />}
          <button className="btn btn-primary" disabled={!!busy} style={{ padding: "10px 18px", borderRadius: 12 }}>{busy === "save" ? "Guardando…" : p ? "Guardar cambios" : "Crear y seguir"}</button>
        </div>
      </form>

      {p ? (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {p.kind === "model" ? (
            <div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>Modelo 3D {p.file_id ? <span style={{ color: "var(--ok)" }}>· cargado</span> : <span style={{ color: "var(--bad)" }}>· falta, sin él no se publica</span>}</div>
              <label className="chip-btn" style={{ display: "inline-block" }}>
                {busy === "model" ? "Subiendo y revisando…" : p.file_id ? "Reemplazar archivo" : "Subir STL / 3MF / OBJ / STEP"}
                <input type="file" accept={MODEL_ACCEPT} hidden disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) run("model", () => uploadProductModel(token, p.id, file)); }} />
              </label>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>Este llavero se genera con el nombre que escribe el cliente; no necesita archivo.</div>
          )}
          <div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>Fotos (la primera es la portada)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.images.map((img) => (
                <div key={img} style={{ position: "relative", width: 84, height: 84, borderRadius: 10, overflow: "hidden" }}>
                  <img src={imageUrl(img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" aria-label="Quitar foto" onClick={() => run("img", () => deleteProductImage(token, p.id, img))}
                    style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 99, border: 0, background: "rgba(0,0,0,.7)", color: "#fff", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <label style={{ width: 84, height: 84, borderRadius: 10, border: "1px dashed var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12, color: "var(--text-3)", cursor: "pointer" }}>
                {busy === "img" ? "Subiendo…" : "+ Foto"}
                <input type="file" accept={IMAGE_ACCEPT} multiple hidden disabled={!!busy}
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    run("img", async () => {
                      let last = p;
                      for (const file of files) last = await uploadProductImage(token, p.id, file);
                      return last;
                    });
                  }} />
              </label>
            </div>
          </div>
          {p.ready && p.published && <Link href={`/producto/${p.id}`} target="_blank" style={{ fontSize: 14 }}>Ver en la tienda ↗</Link>}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 14 }}>Después de crearlo podrás subir el modelo y las fotos.</p>
      )}
    </Modal>
  );
}
