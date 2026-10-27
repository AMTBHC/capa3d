import { describe, expect, it } from "vitest";
import { printability } from "./checks";

const bed = { x: 220, y: 220, z: 250 };
const m = (dx: number, dy: number, dz: number) => ({ dx, dy, dz, volumeCm3: 1, areaCm2: 1 });

describe("printability", () => {
  it("aprueba una pieza cerrada que cabe", () => {
    const r = printability(m(50, 50, 50), 0, bed, 100);
    expect(r.verdict).toBe("ok");
    expect(r.fits).toBe(true);
  });

  it("acepta piezas que caben girándolas", () => {
    const r = printability(m(240, 100, 100), 0, bed, 100);
    expect(r.fits).toBe(true);
    expect(r.verdict).toBe("ok");
  });

  it("sugiere una escala cuando no cabe", () => {
    const r = printability(m(500, 100, 100), 0, bed, 100);
    expect(r.verdict).toBe("bad");
    expect(r.maxScale).toBe(50);
  });

  it("advierte mallas abiertas y piezas diminutas", () => {
    expect(printability(m(50, 50, 50), 3, bed, 100).verdict).toBe("warn");
    expect(printability(m(2, 2, 2), 0, bed, 100).verdict).toBe("warn");
  });
});
