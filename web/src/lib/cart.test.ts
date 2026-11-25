import { describe, expect, it } from "vitest";
import { cartCount, cartFrom, cartMessage, itemDetails, itemKey, type CartItem, type NewItem } from "./cart";
import { sizeName } from "./content";

const base: NewItem = {
  productId: "dragon", name: "Dragón articulado", image: null, emoji: "🐉", size: "Mediano", color: "Morado",
  finish: "Mate", text: "", qty: 2, priceFrom: 35000,
};
const item = (patch: Partial<NewItem> = {}): CartItem => {
  const x = { ...base, ...patch };
  return { ...x, key: itemKey(x) };
};

describe("Mi pedido", () => {
  it("el mismo producto con otras opciones es otra línea", () => {
    expect(itemKey(base)).not.toBe(itemKey({ ...base, color: "Negro" }));
    expect(itemKey(base)).toBe(itemKey({ ...base, qty: 5 }));
  });

  it("suma unidades y precios de referencia", () => {
    const items = [item(), item({ productId: "llavero", qty: 1, priceFrom: 8000 }), item({ productId: "x", priceFrom: null })];
    expect(cartCount(items)).toBe(5);
    expect(cartFrom(items)).toBe(35000 * 2 + 8000);
    expect(cartFrom([item({ priceFrom: null })])).toBeNull();
  });

  it("describe las opciones en lenguaje sencillo", () => {
    expect(itemDetails(item({ text: "Sofía" }))).toBe("“Sofía” · Mediano · Morado · Mate");
    expect(itemDetails(item({ size: "", finish: "" }))).toBe("Morado");
    expect(sizeName("S")).toBe("Pequeño");
    expect(sizeName("Normal")).toBe("Normal");
  });

  it("arma el mensaje de WhatsApp con el resumen, el enlace y la nota", () => {
    const msg = cartMessage([item(), item({ productId: "demo", name: "Matera", qty: 1, priceFrom: 25000, sample: true })], "Es para regalo", "https://cr3d.co");
    expect(msg).toContain("1. Dragón articulado × 2\n   Mediano · Morado · Mate\n   Desde $35.000 c/u\n   https://cr3d.co/producto/dragon");
    expect(msg).toContain("2. Matera\n");
    expect(msg).not.toContain("/producto/demo");
    expect(msg).toContain("Total de referencia: desde $95.000");
    expect(msg).toContain("Nota: Es para regalo");
    expect(msg.trim().endsWith("¿Me confirman el precio final y el tiempo de entrega?")).toBe(true);
  });
});
