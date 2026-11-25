/**
 * "Mi pedido": la lista de productos que el cliente va armando en el catálogo. Vive en el
 * navegador (localStorage) y termina en un mensaje de WhatsApp con el resumen.
 */

import { useSyncExternalStore } from "react";
import { business } from "./config";
import { money } from "./format";

const KEY = "cr3d-mi-pedido";
const MAX_ITEMS = 40;
export const MAX_QTY = 99;

export interface CartItem {
  /** Producto + opciones: el mismo producto con otras opciones es otra línea. */
  key: string;
  productId: string;
  name: string;
  image: string | null;
  emoji: string;
  size: string;
  color: string;
  finish: string;
  /** Texto de un producto personalizado (llavero con nombre). */
  text: string;
  qty: number;
  /** Precio "desde" por unidad, si se conoce. */
  priceFrom: number | null;
  /** Producto de muestra (sitio sin API): no tiene página propia. */
  sample?: boolean;
}

export type NewItem = Omit<CartItem, "key">;

interface State {
  items: CartItem[];
  note: string;
}

const EMPTY: State = { items: [], note: "" };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && Array.isArray(saved.items)) state = { items: saved.items.slice(0, MAX_ITEMS), note: String(saved.note ?? "") };
  } catch {
    // sin almacenamiento o datos dañados: pedido vacío
  }
}

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // sin almacenamiento: el pedido dura mientras la página esté abierta
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Otra pestaña cambió el pedido.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const snapshot = () => {
  load();
  return state;
};

export function useCart(): State {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const itemKey = (i: NewItem) => [i.productId, i.size, i.color, i.finish, i.text].join("|");

export function addItem(item: NewItem): void {
  load();
  const key = itemKey(item);
  const found = state.items.find((x) => x.key === key);
  const items = found
    ? state.items.map((x) => (x.key === key ? { ...x, qty: Math.min(MAX_QTY, x.qty + item.qty) } : x))
    : [...state.items, { ...item, key }].slice(-MAX_ITEMS);
  set({ ...state, items });
  announce(`${item.name} agregado a tu pedido`);
}

export function setQty(key: string, qty: number): void {
  set({ ...state, items: state.items.map((x) => (x.key === key ? { ...x, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : x)) });
}

export function removeItem(key: string): void {
  set({ ...state, items: state.items.filter((x) => x.key !== key) });
}

export function setNote(note: string): void {
  set({ ...state, note: note.slice(0, 500) });
}

export function clearCart(): void {
  set(EMPTY);
}

export const cartCount = (items: CartItem[]) => items.reduce((n, x) => n + x.qty, 0);

/** Suma de los precios "desde"; null si ningún producto tiene precio. */
export function cartFrom(items: CartItem[]): number | null {
  const priced = items.filter((x) => x.priceFrom);
  return priced.length ? priced.reduce((s, x) => s + (x.priceFrom ?? 0) * x.qty, 0) : null;
}

export function itemDetails(i: Pick<CartItem, "size" | "color" | "finish" | "text">): string {
  return [i.text && `“${i.text}”`, i.size, i.color, i.finish].filter(Boolean).join(" · ");
}

/** El mensaje de WhatsApp con todo el pedido, listo para enviar. */
export function cartMessage(items: CartItem[], note: string, origin = ""): string {
  const lines = [`Hola ${business.name} 👋 Quiero hacer este pedido:`, ""];
  items.forEach((x, i) => {
    lines.push(`${i + 1}. ${x.name}${x.qty > 1 ? ` × ${x.qty}` : ""}`);
    lines.push(`   ${itemDetails(x)}`);
    if (x.priceFrom) lines.push(`   Desde $${money(x.priceFrom)} c/u`);
    if (origin && !x.sample) lines.push(`   ${origin}/producto/${x.productId}`);
  });
  const from = cartFrom(items);
  if (from) lines.push("", `Total de referencia: desde $${money(from)}`);
  if (note.trim()) lines.push("", `Nota: ${note.trim()}`);
  lines.push("", "¿Me confirman el precio final y el tiempo de entrega?");
  return lines.join("\n");
}

// Abrir el panel del pedido y avisos cortos ("Agregado ✓") desde cualquier componente.

type UiEvent = { type: "open" } | { type: "toast"; text: string };
const uiListeners = new Set<(e: UiEvent) => void>();

export function onCartUi(l: (e: UiEvent) => void): () => void {
  uiListeners.add(l);
  return () => uiListeners.delete(l);
}

export const openCart = () => uiListeners.forEach((l) => l({ type: "open" }));
const announce = (text: string) => uiListeners.forEach((l) => l({ type: "toast", text }));
