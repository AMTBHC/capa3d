"use client";
/* eslint-disable @next/next/no-img-element -- fotos servidas por la API */

import Link from "next/link";
import { useState } from "react";
import { BADGE_LABEL, type CatalogProduct } from "@/lib/api";
import { COLORS } from "@/lib/catalog";
import { money } from "@/lib/format";
import { DEMO, productImage } from "@/lib/shop";
import { Icon, ICONS } from "../Icon";
import { QuickAdd } from "./QuickAdd";

/** Tarjeta del catálogo: foto, nombre, precio y un botón para agregarla con sus opciones. */
export function ProductCard({ p, emoji, category }: { p: CatalogProduct; emoji: string; category?: string }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const img = broken ? null : productImage(p);
  const sizes = p.sizes.length > 1 ? `${p.sizes.length} tamaños` : null;

  const photo = (
    <>
      {img ? <img src={img} alt={p.name} loading="lazy" onError={() => setBroken(true)} /> : <span className="pc-emoji" aria-hidden="true">{emoji}</span>}
      {(p.badges.length > 0 || p.personalize) && (
        <span className="pc-badges">
          {p.badges.slice(0, 2).map((b) => <span key={b} className="badge">{BADGE_LABEL[b]}</span>)}
          {p.personalize && <span className="badge badge-ac">Con tu nombre</span>}
        </span>
      )}
    </>
  );

  return (
    <article className="pcard">
      {DEMO ? (
        <button type="button" className="pc-photo" onClick={() => setOpen(true)} aria-label={`Elegir opciones de ${p.name}`}>{photo}</button>
      ) : (
        <Link href={`/producto/${p.id}`} className="pc-photo" aria-label={`Ver ${p.name}`}>{photo}</Link>
      )}
      <div className="pc-body">
        {(category ?? p.subsection) && <span className="pc-cat">{category ?? p.subsection}</span>}
        <h3 className="pc-name">
          {DEMO ? p.name : <Link href={`/producto/${p.id}`}>{p.name}</Link>}
        </h3>
        <span className="pc-price">
          {p.price_from ? <>Desde <strong>${money(p.price_from)}</strong></> : "Precio según tamaño"}
        </span>
        <span className="pc-meta">
          <span className="pc-dots" aria-hidden="true">
            {COLORS.slice(0, 5).map((c) => <span key={c.name} style={{ background: c.render }} />)}
          </span>
          {COLORS.length} colores{sizes ? ` · ${sizes}` : ""}
        </span>
        <button type="button" className="btn btn-primary pc-add" onClick={() => setOpen(true)}>
          <Icon d={p.personalize ? ICONS.chat : ICONS.plus} size={18} stroke={2.2} />
          {p.personalize ? "Personalizar" : "Agregar"}
        </button>
      </div>
      {open && <QuickAdd p={p} emoji={emoji} open={open} onClose={() => setOpen(false)} />}
    </article>
  );
}
