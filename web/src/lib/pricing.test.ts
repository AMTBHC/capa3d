import { describe, expect, it } from "vitest";
import { estimateQuote, SAMPLE_MODEL } from "./pricing";
import { MATERIALS, QUALITIES } from "./catalog";

const pla = MATERIALS[0];
const standard = QUALITIES[1];

describe("estimateQuote", () => {
  it("cotiza la pieza de ejemplo igual que el diseño original", () => {
    const q = estimateQuote({ metrics: SAMPLE_MODEL, material: pla, flow: standard.flow, infill: 20, qty: 1 });
    expect(q.grams).toBeCloseTo(22.697, 2);
    expect(q.hours).toBeCloseTo(0.9222, 3);
    expect(q.unitPrice).toBe(10000);
    expect(q.total).toBe(10000);
  });

  it("multiplica por la cantidad y redondea a 100", () => {
    const q = estimateQuote({ metrics: SAMPLE_MODEL, material: pla, flow: standard.flow, infill: 50, qty: 3 });
    expect(q.unitPrice % 100).toBe(0);
    expect(q.total).toBe(q.unitPrice * 3);
  });

  it("más relleno cuesta más", () => {
    const at = (infill: number) =>
      estimateQuote({ metrics: SAMPLE_MODEL, material: pla, flow: standard.flow, infill, qty: 1 }).unitPrice;
    expect(at(100)).toBeGreaterThan(at(20));
  });
});

describe("estimateQuote con varias camas", () => {
  it("suma material y tiempo por cama y cobra el cargo base una vez", () => {
    const one = estimateQuote({ metrics: SAMPLE_MODEL, material: pla, flow: standard.flow, infill: 20, qty: 1 });
    const two = estimateQuote({ metrics: [SAMPLE_MODEL, SAMPLE_MODEL], material: pla, flow: standard.flow, infill: 20, qty: 1 });
    expect(two.plates).toHaveLength(2);
    expect(two.grams).toBeCloseTo(one.grams * 2);
    expect(two.hours).toBeCloseTo(one.hours * 2);
    expect(two.unitPrice).toBe(Math.round((5000 + one.materialCost * 2 + one.machineCost * 2) / 100) * 100);
  });
});
