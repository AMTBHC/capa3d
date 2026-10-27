import { describe, expect, it } from "vitest";
import { parse3mf } from "./threemf";
import { analyzeMesh } from "./analyze";
import { platePositions } from "./project";
import { bambuProject, cubeMeshXml, tr, zip3mf } from "../testing";

const bed = { x: 256, y: 256, z: 256 };
const model = (unit: string, resources: string, build: string) =>
  `<?xml version="1.0"?><model unit="${unit}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${resources}</resources><build>${build}</build></model>`;

describe("parse3mf", () => {
  it("aplica unidades y transformaciones de la construcción", () => {
    const f = zip3mf({ "3D/3dmodel.model": model("centimeter", `<object id="1">${cubeMeshXml(2)}</object>`, `<item objectid="1" transform="${tr(5, 5)}"/>`) });
    const { plates, info } = parse3mf(f, bed);
    expect(plates).toHaveLength(1);
    expect(info.platesFrom).toBe("single");
    const a = analyzeMesh(platePositions(plates[0]));
    expect([a.dx, a.dy, a.dz]).toEqual([20, 20, 20]);
    expect(a.center[0]).toBeCloseTo(60);
  });

  it("lee las camas de Bambu Studio / OrcaSlicer con objetos en subarchivos", () => {
    const { plates, info } = parse3mf(bambuProject(), bed);
    expect(plates.map((p) => p.name)).toEqual(["Cama 1", "Tapas"]);

    // Cama 1: dos instancias del cubo de 10 mm, en x=100 y x=150.
    expect(plates[0].objects.map((o) => o.name)).toEqual(["Cubo & tapa", "Cubo & tapa"]);
    const a = analyzeMesh(platePositions(plates[0]));
    expect(a.volumeCm3).toBeCloseTo(2);
    expect(a.dx).toBeCloseTo(60);
    expect(a.openEdges).toBe(0);
    expect(plates[0].thumbnail).toBeDefined();

    // Cama 2: el cubo de 20 mm del otro subarchivo (mismo id interno que el de 10 mm).
    const b = analyzeMesh(platePositions(plates[1]));
    expect(b.dx).toBeCloseTo(20);
    expect(plates[1].sliced).toEqual({ seconds: 3600, grams: 12.5, filaments: [{ type: "PETG", color: "#FFFFFF", grams: 12.5 }] });

    expect(info).toMatchObject({ platesFrom: "file", printer: "Bambu Lab X1 Carbon", layerHeight: 0.2, infill: 15, filaments: [{ type: "PETG", color: "#FFFFFF" }] });
  });

  it("resuelve componentes anidados dentro del mismo archivo", () => {
    const res = `<object id="1">${cubeMeshXml(10)}</object>` +
      `<object id="2"><components><component objectid="1"/><component objectid="1" transform="${tr(0, 0, 10)}"/></components></object>`;
    const { plates } = parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", res, '<item objectid="2"/>') }), bed);
    const a = analyzeMesh(platePositions(plates[0]));
    expect(a.dz).toBeCloseTo(20);
    expect(a.triangles).toBe(24);
  });

  it("separa por posición las camas que el archivo no declara", () => {
    const res = `<object id="1">${cubeMeshXml(10)}</object>`;
    const build = [tr(10, 10), tr(200, 200), tr(400, 10), tr(420, 30)].map((t) => `<item objectid="1" transform="${t}"/>`).join("");
    const { plates, info } = parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", res, build) }), bed);
    expect(info.platesFrom).toBe("position");
    expect(plates.map((p) => p.objects.length)).toEqual([2, 2]);
  });

  it("deja todo en una cama si las piezas caben juntas", () => {
    const res = `<object id="1">${cubeMeshXml(10)}</object>`;
    const build = [tr(10, 10), tr(200, 200)].map((t) => `<item objectid="1" transform="${t}"/>`).join("");
    const { plates } = parse3mf(zip3mf({ "3D/3dmodel.model": model("millimeter", res, build) }), bed);
    expect(plates).toHaveLength(1);
    expect(plates[0].objects).toHaveLength(2);
  });
});
