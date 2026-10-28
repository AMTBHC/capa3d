import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { fetchPlateStl, getServerFile } from "./api";
import { runAnalysis } from "./mesh/runAnalysis";
import type { MeshAnalysis } from "./mesh/analyze";

export interface ServerPlateMesh {
  id: number;
  name: string;
  positions: Float32Array;
  analysis: MeshAnalysis;
}

/** Las camas de un archivo del servidor, listas para el visor 3D (productos del catálogo). */
export async function loadServerModel(fileId: string): Promise<ServerPlateMesh[]> {
  const file = await getServerFile(fileId);
  const loader = new STLLoader();
  const plates: ServerPlateMesh[] = [];
  for (const p of file.plates) {
    const geo = loader.parse(await fetchPlateStl(fileId, p.id));
    const positions = geo.getAttribute("position").array as Float32Array;
    plates.push({ id: p.id, name: p.name, positions, analysis: await runAnalysis(positions) });
  }
  return plates;
}
