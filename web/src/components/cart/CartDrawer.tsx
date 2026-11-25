"use client";
/* eslint-disable @next/next/no-img-element -- fotos servidas por la API */

import Link from "next/link";
import { cartCount, cartFrom, cartMessage, clearCart, itemDetails, removeItem, setNote, setQty, useCart } from "@/lib/cart";
import { whatsappUrl } from "@/lib/config";
import { money } from "@/lib/format";
import { Icon, ICONS } from "../Icon";
import { Sheet } from "../ui/Sheet";
import { QtyStepper } from "../catalog/Pickers";
import { WhatsAppIcon } from "../WhatsAppIcon";

/** "Mi pedido": revisar lo elegido y enviarlo por WhatsApp con el resumen. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, note } = useCart();
  const count = cartCount(items);
  const from = cartFrom(items);

  const send = () => {
    window.open(whatsappUrl(cartMessage(items, note, window.location.origin)), "_blank", "noopener,noreferrer");
  };

  return (
    <Sheet open={open} onClose={onClose} variant="drawer" title="Mi pedido"
      subtitle={count ? `${count} ${count === 1 ? "producto" : "productos"}` : undefined}
      footer={items.length > 0 && (
        <>
          {from && (
            <div className="cart-total">
              <span>Total de referencia</span>
              <strong>Desde ${money(from)}</strong>
            </div>
          )}
          <button type="button" className="btn btn-wa btn-lg btn-block" onClick={send}>
            <WhatsAppIcon size={22} />
            Enviar pedido por WhatsApp
          </button>
          <p className="field-hint" style={{ textAlign: "center", margin: "8px 0 0" }}>
            No pagas nada todavía: te confirmamos precio final, envío y tiempo de entrega.
          </p>
        </>
      )}>
      {items.length === 0 ? (
        <div className="cart-empty">
          <span className="cart-empty-icon"><Icon d={ICONS.bag} size={30} stroke={1.8} /></span>
          <p style={{ fontWeight: 600, margin: "4px 0 0" }}>Tu pedido está vacío</p>
          <p className="field-hint" style={{ margin: 0 }}>Agrega productos del catálogo o mándanos una foto de lo que necesitas.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 12 }}>
            <Link href="/catalogo" className="btn btn-primary btn-block" onClick={onClose}>Ver catálogo</Link>
            <Link href="/#a-medida" className="btn btn-outline btn-block" onClick={onClose}>
              <Icon d={ICONS.camera} size={18} stroke={2} />Pedir algo con una foto
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {items.map((x) => (
              <li key={x.key} className="cart-item">
                <div className="cart-thumb">{x.image ? <img src={x.image} alt="" /> : <span aria-hidden="true">{x.emoji}</span>}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cart-name">{x.name}</div>
                  <div className="cart-details">{itemDetails(x)}</div>
                  <div className="cart-row">
                    <QtyStepper compact value={x.qty} onChange={(n) => setQty(x.key, n)} label={`Cantidad de ${x.name}`} />
                    <span className="cart-price">{x.priceFrom ? <>desde <strong>${money(x.priceFrom * x.qty)}</strong></> : "a cotizar"}</span>
                  </div>
                </div>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeItem(x.key)} aria-label={`Quitar ${x.name}`}>
                  <Icon d={ICONS.trash} size={18} stroke={1.9} />
                </button>
              </li>
            ))}
          </ul>
          <label className="field" style={{ marginTop: 16 }}>
            <span className="field-label-sm">¿Algo más que debamos saber? <span className="muted">(opcional)</span></span>
            <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: lo necesito para el 15 de diciembre, es para regalo…" />
          </label>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14, fontSize: 14 }}>
            <Link href="/catalogo" className="text-link" onClick={onClose}>Seguir viendo el catálogo</Link>
            <button type="button" className="link-btn" style={{ color: "var(--text-3)" }} onClick={() => window.confirm("¿Vaciar tu pedido?") && clearCart()}>
              Vaciar
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
