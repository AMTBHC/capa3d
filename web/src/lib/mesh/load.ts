import { BufferGeometry, Group, Mesh, Object3D } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";

export const MESH_FORMATS = ["stl", "obj", "3mf"] as const;
export const MANUAL_FORMATS = ["step", "stp"] as const;
export const ACCEPT = ".stl,.obj,.3mf,.step,.stp";

export type MeshFormat = (typeof MESH_FORMATS)[number];

export function extensionOf(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export class UnsupportedFormatError extends Error {}

/**
 * Lee un archivo 3D y devuelve sus triángulos sin indexar
 * (9 floats por triángulo, en mm, Z hacia arriba).
 */
export async function loadMesh(file: File): Promise<Float32Array> {
  const ext = extensionOf(file.name);
  const buf = await file.arrayBuffer();
  let positions: Float32Array;
  switch (ext) {
    case "stl":
      positions = geometryPositions(new STLLoader().parse(buf));
      break;
    case "obj": {
      const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
      // OBJ viene con Y hacia arriba: (x, y, z) → (x, -z, y).
      positions = objectPositions(obj);
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        positions[i + 1] = -positions[i + 2];
        positions[i + 2] = y;
      }
      break;
    }
    case "3mf": {
      const group = new ThreeMFLoader().parse(buf) as Group;
      positions = objectPositions(group);
      const k = threeMfUnitToMm(buf);
      if (k !== 1) for (let i = 0; i < positions.length; i++) positions[i] *= k;
      break;
    }
    default:
      throw new UnsupportedFormatError(ext);
  }
  if (positions.length < 9) throw new Error("empty mesh");
  for (let i = 0; i < positions.length; i++) if (!Number.isFinite(positions[i])) throw new Error("invalid vertex");
  return positions;
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
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    parts.push(geometryPositions(g));
  });
  const out = new Float32Array(parts.reduce((s, a) => s + a.length, 0));
  let off = 0;
  for (const a of parts) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

const UNIT_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

/** El cargador de three.js no aplica el atributo `unit` del 3MF; lo leemos aparte. */
function threeMfUnitToMm(buf: ArrayBuffer): number {
  try {
    const files = unzipSync(new Uint8Array(buf), { filter: (f) => /\.model$/i.test(f.name) });
    for (const data of Object.values(files)) {
      const unit = strFromU8(data).match(/<model[^>]*\bunit="([^"]+)"/)?.[1];
      if (unit) return UNIT_MM[unit] ?? 1;
    }
  } catch {
    // Si no se puede leer, se asume milímetros (el valor por defecto del formato).
  }
  return 1;
}
