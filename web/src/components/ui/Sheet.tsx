"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, ICONS } from "../Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto pequeño bajo el título. */
  subtitle?: ReactNode;
  /** Zona fija abajo (botones), siempre visible aunque el contenido se desplace. */
  footer?: ReactNode;
  /** "drawer": panel a la derecha en computador. "dialog": ventana centrada. En celular ambos suben desde abajo. */
  variant?: "drawer" | "dialog";
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Ventana accesible: Esc cierra, el foco queda dentro y vuelve al botón que la abrió. */
export function Sheet({ open, onClose, title, subtitle, footer, variant = "dialog", children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Se lee al cerrar con Esc: así un onClose nuevo en cada render no reinicia el foco.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
    first?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="sheet-backdrop" data-variant={variant} onClick={onClose}>
      <div ref={panel} className="sheet" data-variant={variant} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-grip" aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="sheet-title">{title}</h2>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon d={ICONS.close} size={20} stroke={2} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
