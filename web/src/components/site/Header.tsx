"use client";

import Link from "next/link";
import { useState } from "react";
import { cartCount, openCart, useCart } from "@/lib/cart";
import { whatsappUrl } from "@/lib/config";
import { AdminShortcut } from "../AdminShortcut";
import { Logo } from "../brand/Logo";
import { Icon, ICONS } from "../Icon";
import { Sheet } from "../ui/Sheet";
import { WhatsAppIcon } from "../WhatsAppIcon";

export const NAV = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/#a-medida", label: "Pedido a medida" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#preguntas", label: "Preguntas" },
  { href: "/mis-pedidos", label: "Mis pedidos" },
];

export function Header() {
  const { items } = useCart();
  const count = cartCount(items);
  const [menu, setMenu] = useState(false);
  const close = () => setMenu(false);

  return (
    <header className="site-header">
      <div className="site-header-in">
        <Link href="/" className="site-logo" aria-label="CR3D, inicio">
          <Logo height={24} />
        </Link>
        <nav aria-label="Principal" className="site-nav">
          {NAV.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </nav>
        <div className="site-actions">
          <AdminShortcut />
          <button type="button" className="icon-btn cart-btn" onClick={openCart} aria-label={`Mi pedido, ${count} ${count === 1 ? "producto" : "productos"}`}>
            <Icon d={ICONS.bag} size={22} stroke={1.9} />
            {count > 0 && <span className="cart-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
          </button>
          <Link href="/#a-medida" className="btn btn-primary header-cta">
            <Icon d={ICONS.camera} size={18} stroke={2} />Pedir con una foto
          </Link>
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-expanded={menu}>
            <Icon d={ICONS.menu} size={22} stroke={2} />
          </button>
        </div>
      </div>

      <Sheet open={menu} onClose={close} title="Menú" variant="drawer">
        <nav aria-label="Menú" className="menu-list">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} onClick={close}>
              {l.label}
              <Icon d={ICONS.arrow} size={18} stroke={2} />
            </Link>
          ))}
        </nav>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <Link href="/#a-medida" className="btn btn-primary btn-lg btn-block" onClick={close}>
            <Icon d={ICONS.camera} size={20} stroke={2} />Pedir algo con una foto
          </Link>
          <a href={whatsappUrl("Hola, tengo una consulta sobre impresión 3D.")} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-lg btn-block">
            <WhatsAppIcon size={20} />Escribir por WhatsApp
          </a>
        </div>
        <p className="field-hint" style={{ marginTop: 20 }}>
          ¿Ya tienes un archivo 3D (STL, 3MF)? <Link href="/cotizar" className="text-link" onClick={close}>Cotízalo aquí</Link>
        </p>
      </Sheet>
    </header>
  );
}
