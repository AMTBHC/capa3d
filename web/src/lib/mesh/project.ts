/** Una pieza (instancia de objeto) ya transformada: triángulos sin indexar en mm, Z hacia arriba. */
export interface ModelObject {
  name: string;
  positions: Float32Array;
}

/** Datos que el slicer guardó en el archivo al laminar esa cama. */
export interface SlicedPlate {
  seconds?: number;
  grams?: number;
  filaments: { type: string; color: string; grams?: number }[];
}

/** Una cama de impresión = un trabajo de impresión. */
export interface Plate {
  id: number;
  name: string;
  objects: ModelObject[];
  /** PNG de la miniatura que generó el slicer. */
  thumbnail?: Uint8Array;
  sliced?: SlicedPlate;
}

export interface ProjectInfo {
  /** De dónde salen las camas: el archivo las declara, se dedujeron por posición, o hay una sola. */
  platesFrom: "file" | "position" | "single";
  slicer?: string;
  printer?: string;
  layerHeight?: number;
  infill?: number;
  filaments: { type: string; color: string }[];
}

export interface Project {
  plates: Plate[];
  info: ProjectInfo;
}

/** Todos los triángulos de una cama en un solo arreglo. */
export function platePositions(plate: Plate): Float32Array {
  if (plate.objects.length === 1) return plate.objects[0].positions;
  const out = new Float32Array(plate.objects.reduce((s, o) => s + o.positions.length, 0));
  let off = 0;
  for (const o of plate.objects) {
    out.set(o.positions, off);
    off += o.positions.length;
  }
  return out;
}
