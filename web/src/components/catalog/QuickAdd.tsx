"use client";
/* eslint-disable @next/next/no-img-element -- fotos servidas por la API */

import Link from "next/link";
import { useState } from "react";
import type { CatalogProduct } from "@/lib/api";
import { addItem } from "@/lib/cart";
import { FINISHES, sizeName } from "@/lib/content";
import { money } from "@/lib/format";
import { DEMO, productImage } from "@/lib/shop";
import { Sheet } from "../ui/Sheet";
import { Icon, ICONS } from "../Icon";
import { ColorPicker, FinishPicker, OptionGroup, QtyStepper, SizePicker } from "./Pickers";

const DEFAULT_COLOR = "Blanco";

/** Elegir tamaño, color, acabado y cantidad sin salir del catálogo. */
export function QuickAdd({ p, emoji, open, onClose }: { p: CatalogProduct; emoji: string; open: boolean; onClose: () => void }) {
  const [size, setSize] = useState(() => Math.max(0, p.sizes.findIndex((s) => s.scale === 100)));
  const [color, setColor] = useState(p.default_color || DEFAULT_COLOR);
  const [finish, setFinish] = useState(FINISHES[0] ?? "");
  const [qty, setQty] = useState(1);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);

  const img = productImage(p);
  const needsText = !!p.personalize && !text.trim();

  const add = () => {
    setTried(true);
    if (needsText) return;
    addItem({
      productId: p.id, name: p.name, image: img, emoji, size: p.sizes.length > 1 ? sizeName(p.sizes[size].label) : "",
      color, finish, text: text.trim(), qty, priceFrom: p.price_from, sample: DEMO,
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Elige tus opciones"
      footer={
        <div className="qa-foot">
          {p.price_from && (
            <span className="qa-foot-price">
              <span>{qty > 1 ? `${qty} × desde` : "Desde"}</span>
              <strong>${money(p.price_from * qty)}</strong>
            </span>
          )}
          <button type="button" className="btn btn-primary btn-lg grow" onClick={add}>
            <Icon d={ICONS.bag} size={20} stroke={2} />
            Agregar a mi pedido
          </button>
        </div>
      }>
      <div className="qa-product">
        <div className="qa-thumb">
          {img ? <img src={img} alt="" /> : <span aria-hidden="true">{emoji}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="qa-name">{p.name}</div>
          <div className="qa-price">{p.price_from ? <>Desde <strong>${money(p.price_from)}</strong> c/u</> : "Te cotizamos el precio"}</div>
          {!DEMO && <Link href={`/producto/${p.id}`} className="text-link" style={{ fontSize: 14 }}>Ver fotos y detalles</Link>}
        </div>
      </div>

      {p.personalize && (
        <OptionGroup label="Texto o nombre">
          <input className="input" value={text} maxLength={p.personalize.max_length} onChange={(e) => setText(e.target.value)}
            placeholder="Ej.: Sofía" autoComplete="off" data-autofocus aria-invalid={tried && needsText}
            aria-describedby={`qa-text-${p.id}`} />
          <p id={`qa-text-${p.id}`} className="field-hint" style={{ color: tried && needsText ? "var(--bad)" : undefined }}>
            {tried && needsText ? "Escribe el nombre que quieres en tu llavero." : `Hasta ${p.personalize.max_length} letras.`}
          </p>
        </OptionGroup>
      )}
      <SizePicker sizes={p.sizes} value={size} onChange={setSize} />
      <ColorPicker value={color} onChange={setColor} />
      <FinishPicker value={finish} onChange={setFinish} />
      <QtyStepper value={qty} onChange={setQty} />
      <p className="field-hint" style={{ marginTop: 4 }}>
        El precio final depende del tamaño y la cantidad. Te lo confirmamos por WhatsApp antes de que pagues.
      </p>
    </Sheet>
  );
}
