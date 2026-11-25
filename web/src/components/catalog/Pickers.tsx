"use client";

import type { ReactNode } from "react";
import type { ProductSize } from "@/lib/api";
import { COLORS } from "@/lib/catalog";
import { FINISHES, sizeName } from "@/lib/content";
import { MAX_QTY } from "@/lib/cart";
import { Icon, ICONS } from "../Icon";

/** Grupo de opciones con su nombre y lo elegido a la derecha. */
export function OptionGroup({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="opt-group">
      <legend className="opt-legend">
        <span>{label}</span>
        {value && <span className="opt-value">{value}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function SizePicker({ sizes, value, onChange, hint }: {
  sizes: ProductSize[];
  value: number;
  onChange: (i: number) => void;
  /** Medidas de cada tamaño, si se conocen. */
  hint?: (s: ProductSize) => string | null;
}) {
  if (sizes.length < 2) return null;
  return (
    <OptionGroup label="Tamaño">
      <div className="opt-row">
        {sizes.map((s, i) => (
          <button key={s.label} type="button" className="opt-chip" aria-pressed={i === value} onClick={() => onChange(i)}>
            {sizeName(s.label)}
            {hint?.(s) && <span className="opt-chip-hint">{hint(s)}</span>}
          </button>
        ))}
      </div>
    </OptionGroup>
  );
}

const DARK_CHECK = new Set(["Blanco", "Amarillo"]);

export function ColorPicker({ value, onChange, extra }: { value: string; onChange: (name: string) => void; extra?: ReactNode }) {
  return (
    <OptionGroup label="Color" value={value || "Que me recomienden"}>
      <div className="opt-row color-row">
        {COLORS.map((c) => {
          const on = c.name === value;
          return (
            <button key={c.name} type="button" className="color-dot" aria-pressed={on} aria-label={c.name} title={c.name} onClick={() => onChange(c.name)}>
              <span style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.4), transparent 50%), ${c.render}` }}>
                {on && <Check dark={DARK_CHECK.has(c.name)} />}
              </span>
            </button>
          );
        })}
        {extra}
      </div>
    </OptionGroup>
  );
}

function Check({ dark }: { dark: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#160f2e" : "#fff"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function FinishPicker({ value, onChange }: { value: string; onChange: (f: string) => void }) {
  if (!FINISHES.length) return null;
  return (
    <OptionGroup label="Acabado">
      <div className="opt-row">
        {FINISHES.map((f) => (
          <button key={f} type="button" className="opt-chip" aria-pressed={f === value} onClick={() => onChange(f)}>{f}</button>
        ))}
      </div>
    </OptionGroup>
  );
}

export function QtyStepper({ value, onChange, label = "Cantidad", compact = false }: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
  compact?: boolean;
}) {
  const stepper = (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Uno menos">
        <Icon d={ICONS.minus} size={16} stroke={2.4} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(MAX_QTY, value + 1))} disabled={value >= MAX_QTY} aria-label="Uno más">
        <Icon d={ICONS.plus} size={16} stroke={2.4} />
      </button>
    </div>
  );
  return compact ? stepper : <OptionGroup label={label}>{stepper}</OptionGroup>;
}
