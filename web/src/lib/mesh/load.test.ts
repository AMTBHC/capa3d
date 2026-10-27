import { describe, expect, it } from "vitest";
import { loadMesh, UnsupportedFormatError } from "./load";
import { analyzeMesh } from "./analyze";
import { binaryStl, cube } from "../testing";

const asciiStl = (p: Float32Array) => {
  let s = "solid t\n";
  for (let i = 0; i < p.length; i += 9) {
    s += "facet normal 0 0 0\nouter loop\n";
    for (let k = 0; k < 9; k += 3) s += `vertex ${p[i + k]} ${p[i + k + 1]} ${p[i + k + 2]}\n`;
    s += "endloop\nendfacet\n";
  }
  return s + "endsolid t\n";
};

describe("loadMesh", () => {
  it("lee STL binario", async () => {
    const p = await loadMesh(new File([binaryStl(cube(20))], "pieza.stl"));
    expect(analyzeMesh(p).volumeCm3).toBeCloseTo(8);
  });

  it("lee STL ASCII", async () => {
    const p = await loadMesh(new File([asciiStl(cube(10))], "pieza.STL"));
    expect(analyzeMesh(p).openEdges).toBe(0);
  });

  it("lee OBJ y lo pasa a Z arriba", async () => {
    const obj = "v 0 0 0\nv 10 0 0\nv 0 30 0\nf 1 2 3\n";
    const a = analyzeMesh(await loadMesh(new File([obj], "t.obj")));
    expect(a.dz).toBeCloseTo(30);
    expect(a.dy).toBeCloseTo(0);
  });

  it("rechaza formatos desconocidos", async () => {
    await expect(loadMesh(new File(["x"], "t.dwg"))).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
});
