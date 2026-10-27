import { describe, expect, it } from "vitest";
import { printability, projectPrintability } from "./checks";

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

describe("projectPrintability", () => {
  it("resume varias camas y señala la que no cabe", () => {
    const r = projectPrintability(
      [
        { name: "Cama 1", metrics: m(50, 50, 50), openEdges: 0 },
        { name: "Cama 2", metrics: m(300, 300, 50), openEdges: 4 },
      ],
      bed,
      100,
    );
    expect(r.plates).toHaveLength(2);
    expect(r.fits).toBe(false);
    expect(r.verdict).toBe("bad");
    expect(r.checks.map((c) => c.text).join(" ")).toMatch(/Cama 2 excede/);
    expect(r.checks.map((c) => c.text).join(" ")).toMatch(/bordes abiertos en: Cama 2/);
  });

  it("con una cama es igual a la revisión normal", () => {
    const one = projectPrintability([{ name: "Cama 1", metrics: m(50, 50, 50), openEdges: 0 }], bed, 100);
    expect(one.checks).toEqual(printability(m(50, 50, 50), 0, bed, 100).checks);
  });
});
