"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listCollections, listProducts, type CatalogCollection, type CatalogProduct } from "@/lib/api";
import { SiteHeader } from "../SiteHeader";
import { grid, ProductCard } from "./Cards";

const PAGE = 36;

const SORTS = {
  destacados: "Destacados",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  nombre: "Nombre (A–Z)",
} as const;
type Sort = keyof typeof SORTS;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Catálogo completo: colecciones y categorías a un lado, búsqueda y orden arriba. Los filtros viven en la URL. */
export function CatalogBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const c = params.get("c") ?? "";
  const s = params.get("s") ?? "";
  const q = params.get("q") ?? "";
  const sort = (params.get("o") ?? "destacados") as Sort;

  const [collections, setCollections] = useState<CatalogCollection[] | null>(null);
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState(q);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    Promise.all([listCollections(), listProducts()]).then(([cs, ps]) => {
      setCollections(cs);
      setProducts(ps);
    }, () => setFailed(true));
  }, []);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setLimit(PAGE);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  // La búsqueda se aplica mientras se escribe, con una pequeña pausa.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const byCollection = useMemo(() => {
    const m = new Map<string, CatalogProduct[]>();
    for (const p of products ?? []) m.set(p.collection_id, [...(m.get(p.collection_id) ?? []), p]);
    return m;
  }, [products]);

  const subsections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of (c ? byCollection.get(c) : products) ?? []) if (p.subsection) counts.set(p.subsection, (counts.get(p.subsection) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [c, byCollection, products]);

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const names = new Map(collections?.map((x) => [x.id, x.name]));
    const list = (products ?? []).filter((p) => {
      if (c && p.collection_id !== c) return false;
      if (s && p.subsection !== s) return false;
      const text = norm(`${p.name} ${p.subsection} ${names.get(p.collection_id) ?? ""}`);
      return words.every((w) => text.includes(w));
    });
    const price = (p: CatalogProduct) => p.price_from ?? Infinity;
    if (sort === "precio-asc") list.sort((a, b) => price(a) - price(b));
    if (sort === "precio-desc") list.sort((a, b) => (b.price_from ?? 0) - (a.price_from ?? 0));
    if (sort === "nombre") list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }, [products, collections, c, s, q, sort]);

  const active = collections?.find((x) => x.id === c);
  const emoji = (id: string) => collections?.find((x) => x.id === id)?.emoji ?? "";

  return (
    <main className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <SiteHeader />
      <nav aria-label="Ruta" style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 10 }}>
        <Link href="/" style={{ color: "var(--text-3)" }}>Inicio</Link> › {active ? <><Link href="/catalogo" style={{ color: "var(--text-3)" }}>Catálogo</Link> › {active.name}</> : "Catálogo"}
      </nav>
      <h1 className="h2" style={{ margin: "0 0 6px" }}>{active ? active.name : "Catálogo"}</h1>
      <p className="lead" style={{ margin: "0 0 24px" }}>{active?.description || "Piezas listas para imprimir en el color y tamaño que elijas."}</p>

      {failed && <div className="status status-warn">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</div>}

      <div className="browse">
        <aside className="browse-side" aria-label="Colecciones">
          <SideLink on={!c} onClick={() => update({ c: "", s: "" })} label="Todo el catálogo" count={products?.length} />
          {collections?.map((x) => (
            <div key={x.id}>
              <SideLink on={c === x.id && !s} onClick={() => update({ c: x.id, s: "" })} label={x.name} count={byCollection.get(x.id)?.length} />
              {c === x.id && subsections.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", margin: "2px 0 8px 12px", paddingLeft: 10, borderLeft: "1px solid var(--line-2)" }}>
                  {subsections.map(([name, n]) => (
                    <SideLink key={name} small on={s === name} onClick={() => update({ s: s === name ? "" : name })} label={name} count={n} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        <div style={{ minWidth: 0 }}>
          <div className="browse-tools">
            <label className="search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar: llavero, dragón, maceta…" aria-label="Buscar en el catálogo" />
            </label>
            <select className="input" value={sort} onChange={(e) => update({ o: e.target.value === "destacados" ? "" : e.target.value })} aria-label="Ordenar" style={{ width: "auto" }}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* En celular: colecciones y categorías como fichas desplazables. */}
          <div className="browse-chips">
            <div className="chip-scroll">
              <button className="chip-btn" aria-pressed={!c} onClick={() => update({ c: "", s: "" })}>Todo</button>
              {collections?.map((x) => <button key={x.id} className="chip-btn" aria-pressed={c === x.id} onClick={() => update({ c: x.id, s: "" })}>{x.name}</button>)}
            </div>
            {subsections.length > 1 && (
              <div className="chip-scroll">
                {subsections.map(([name]) => <button key={name} className="chip-btn" aria-pressed={s === name} onClick={() => update({ s: s === name ? "" : name })}>{name}</button>)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "4px 0 16px", fontSize: 14, color: "var(--text-3)" }}>
            {products ? <span>{shown.length} {shown.length === 1 ? "producto" : "productos"}</span> : <span><span className="spin" /> Cargando…</span>}
            {[c && active && ["c", active.name], s && ["s", s], q && ["q", `“${q}”`]].filter(Boolean).map((f) => {
              const [k, label] = f as [string, string];
              return (
                <button key={k} className="chip-btn" onClick={() => { if (k === "q") setSearch(""); update(k === "c" ? { c: "", s: "" } : { [k]: "" }); }} aria-label={`Quitar filtro ${label}`}>
                  {label} ✕
                </button>
              );
            })}
          </div>

          {products && shown.length === 0 && (
            <div className="status status-info" style={{ flexDirection: "column" }}>
              <strong>No encontramos productos con esos filtros.</strong>
              <span>Prueba otra palabra o <button className="link-btn" onClick={() => { setSearch(""); update({ c: "", s: "", q: "" }); }}>mira todo el catálogo</button>. Si tienes tu propio archivo, <Link href="/#quote">cotízalo aquí</Link>.</span>
            </div>
          )}
          <div style={grid}>{shown.slice(0, limit).map((p) => <ProductCard key={p.id} p={p} emoji={emoji(p.collection_id)} />)}</div>
          {shown.length > limit && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
              <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)} style={{ padding: "12px 22px", borderRadius: 12 }}>
                Ver más ({shown.length - limit} restantes)
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SideLink({ on, onClick, label, count, small }: { on: boolean; onClick: () => void; label: string; count?: number; small?: boolean }) {
  return (
    <button className="side-link" aria-current={on ? "true" : undefined} onClick={onClick} style={small ? { fontSize: 13, padding: "6px 10px" } : undefined}>
      <span>{label}</span>
      {count !== undefined && <span className="side-count">{count}</span>}
    </button>
  );
}
