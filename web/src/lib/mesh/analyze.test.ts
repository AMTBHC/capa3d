import { describe, expect, it } from "vitest";
import { analyzeMesh } from "./analyze";
import { cube } from "../testing";

describe("analyzeMesh", () => {
  it("mide un cubo cerrado de 10 mm", () => {
    const a = analyzeMesh(cube(10));
    expect(a.triangles).toBe(12);
    expect([a.dx, a.dy, a.dz]).toEqual([10, 10, 10]);
    expect(a.volumeCm3).toBeCloseTo(1);
    expect(a.areaCm2).toBeCloseTo(6);
    expect(a.openEdges).toBe(0);
    expect(a.center).toEqual([5, 5, 5]);
  });

  it("detecta bordes abiertos", () => {
    const open = cube(10).slice(0, 10 * 9); // sin la cara superior
    expect(analyzeMesh(open).openEdges).toBeGreaterThan(0);
  });
});
