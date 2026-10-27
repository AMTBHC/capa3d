import { analyzeMesh, type MeshAnalysis } from "./analyze";

/**
 * Analiza la malla en un Web Worker para no congelar la página con modelos
 * grandes. Si el navegador no permite workers, lo hace en el hilo principal.
 */
export function runAnalysis(positions: Float32Array): Promise<MeshAnalysis> {
  if (typeof Worker === "undefined") return Promise.resolve(analyzeMesh(positions));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(analyzeMesh(positions));
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: MeshAnalysis; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "analysis failed"));
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(analyzeMesh(positions));
    };
    // Se envía una copia: el visor sigue usando el arreglo original.
    worker.postMessage(positions.slice());
  });
}
