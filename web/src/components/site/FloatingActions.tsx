"use client";

import { useEffect, useState } from "react";
import { cartCount, cartFrom, onCartUi, useCart } from "@/lib/cart";
import { whatsappUrl } from "@/lib/config";
import { money } from "@/lib/format";
import { CartDrawer } from "../cart/CartDrawer";
import { Icon, ICONS } from "../Icon";
import { WhatsAppIcon } from "../WhatsAppIcon";

const TOAST_MS = 3200;

/**
 * Siempre a mano: con productos elegidos, una barra "Mi pedido" que abre el resumen para
 * enviarlo por WhatsApp; sin productos, el botón de WhatsApp para preguntar.
 */
export function FloatingActions() {
  const { items } = useCart();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const count = cartCount(items);
  const from = cartFrom(items);

  useEffect(() => onCartUi((e) => {
    if (e.type === "open") setOpen(true);
    else setToast({ text: e.text, id: Date.now() });
  }), []);

  // En el celular, los botones flotantes se apartan cuando tapan los botones de un formulario
  // (los elementos marcados con data-hide-fab).
  const [covering, setCovering] = useState(false);
  useEffect(() => {
    const seen = new Set<Element>();
    const update = () => {
      seen.forEach((el) => !el.isConnected && seen.delete(el));
      setCovering(seen.size > 0);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      update();
    });
    const scan = () => {
      document.querySelectorAll("[data-hide-fab]").forEach((el) => io.observe(el));
      update();
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <div className="toast-zone" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            <span className="toast-check"><Icon d={ICONS.check} size={16} stroke={3} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>{toast.text}</span>
            <button type="button" className="toast-btn" onClick={() => { setToast(null); setOpen(true); }}>Ver pedido</button>
          </div>
        )}
      </div>

      {count > 0 ? (
        <button type="button" className="cart-bar wa-fab" data-covering={covering || undefined} onClick={() => setOpen(true)}>
          <span className="cart-bar-icon">
            <Icon d={ICONS.bag} size={20} stroke={2} />
            <span className="cart-bar-count">{count}</span>
          </span>
          <span className="cart-bar-text">
            <strong>Mi pedido</strong>
            {from ? <span>desde ${money(from)}</span> : <span>{count} {count === 1 ? "producto" : "productos"}</span>}
          </span>
          <span className="cart-bar-cta">
            <WhatsAppIcon size={18} />Enviar
          </span>
        </button>
      ) : (
        <a className="wa-fab wa-round" data-covering={covering || undefined} href={whatsappUrl("Hola, tengo una consulta sobre impresión 3D.")} target="_blank" rel="noopener noreferrer"
          aria-label="Escribir por WhatsApp">
          <WhatsAppIcon size={28} />
          <span className="wa-round-label">¿Dudas? Escríbenos</span>
        </a>
      )}

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
