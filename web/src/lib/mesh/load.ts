import { BufferGeometry, Mesh, Object3D } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { printer } from "../config";
import type { Bed } from "../checks";
import { parse3mf } from "./threemf";
import type { Project } from "./project";

export const MESH_FORMATS = ["stl", "obj", "3mf"] as const;
export const MANUAL_FORMATS = ["step", "stp"] as const;
export const ACCEPT = ".stl,.obj,.3mf,.step,.stp";

export function extensionOf(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export class UnsupportedFormatError extends Error {}

/**
 * Lee un archivo 3D. STL y OBJ dan una sola cama con un objeto; un 3MF puede traer
 * varias camas, varios objetos y datos del slicer.
 */
export async function loadProject(file: File, bed: Bed = printer.bed): Promise<Project> {
  const ext = extensionOf(file.name);
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, "");
  let project: Project;
  switch (ext) {
    case "stl":
      project = single(name, geometryPositions(new STLLoader().parse(buf)));
      break;
    case "obj": {
      const positions = objectPositions(new OBJLoader().parse(new TextDecoder().decode(buf)));
      // OBJ viene con Y hacia arriba: (x, y, z) → (x, -z, y).
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        positions[i + 1] = -positions[i + 2];
        positions[i + 2] = y;
      }
      project = single(name, positions);
      break;
    }
    case "3mf":
      project = parse3mf(buf, bed);
      break;
    default:
      throw new UnsupportedFormatError(ext);
  }
  project.plates = project.plates.filter((p) => p.objects.some((o) => o.positions.length >= 9));
  if (!project.plates.length) throw new Error("empty mesh");
  for (const plate of project.plates)
    for (const o of plate.objects)
      for (let i = 0; i < o.positions.length; i++) if (!Number.isFinite(o.positions[i])) throw new Error("invalid vertex");
  return project;
}

function single(name: string, positions: Float32Array): Project {
  return { plates: [{ id: 1, name: "Cama 1", objects: [{ name, positions }] }], info: { platesFrom: "single", filaments: [] } };
}

function geometryPositions(g: BufferGeometry): Float32Array {
  const geo = g.index ? g.toNonIndexed() : g;
  const arr = geo.getAttribute("position").array as Float32Array;
  return arr.length % 9 ? arr.slice(0, arr.length - (arr.length % 9)) : arr;
}

/** Junta todas las mallas de un objeto aplicando sus transformaciones. */
function objectPositions(root: Object3D): Float32Array {
  root.updateMatrixWorld(true);
  const parts: Float32Array[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !m.geometry) return;
    parts.push(geometryPositions(m.geometry.clone().applyMatrix4(m.matrixWorld)));
  });
  const out = new Float32Array(parts.reduce((s, a) => s + a.length, 0));
  let off = 0;
  for (const a of parts) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}
