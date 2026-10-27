"use client";

import { useCallback, useRef, useState } from "react";
import { printer } from "@/lib/config";
import { extensionOf, loadProject, MANUAL_FORMATS, MESH_FORMATS } from "@/lib/mesh/load";
import { runAnalysis } from "@/lib/mesh/runAnalysis";
import type { MeshAnalysis } from "@/lib/mesh/analyze";
import { platePositions, type Plate, type ProjectInfo } from "@/lib/mesh/project";

export type FileStatus = "idle" | "reading" | "ok" | "manual" | "error" | "big";

export interface LoadedPlate {
  plate: Plate;
  /** Triángulos de toda la cama. */
  positions: Float32Array;
  analysis: MeshAnalysis;
  /** URL de la miniatura del slicer, si el archivo la trae. */
  thumbUrl?: string;
}

export interface LoadedModel {
  plates: LoadedPlate[];
  info: ProjectInfo;
}

/** Carga y analiza el archivo del cliente; ignora resultados de archivos reemplazados mientras cargaban. */
export function useModelFile() {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<FileStatus>("idle");
  const [model, setModel] = useState<LoadedModel | null>(null);
  const req = useRef(0);
  const current = useRef<LoadedModel | null>(null);

  const replace = useCallback((next: LoadedModel | null) => {
    current.current?.plates.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
    current.current = next;
    setModel(next);
  }, []);

  const load = useCallback(async (file: File) => {
    const id = ++req.current;
    const ext = extensionOf(file.name);
    setFileName(file.name);
    replace(null);

    if ((MANUAL_FORMATS as readonly string[]).includes(ext)) return setStatus("manual");
    if (!(MESH_FORMATS as readonly string[]).includes(ext)) return setStatus("error");
    if (file.size > printer.maxFileMB * 1024 * 1024) return setStatus("big");

    setStatus("reading");
    try {
      const project = await loadProject(file);
      const plates: LoadedPlate[] = [];
      for (const plate of project.plates) {
        const positions = platePositions(plate);
        const analysis = await runAnalysis(positions);
        const thumbUrl = plate.thumbnail
          ? URL.createObjectURL(new Blob([plate.thumbnail as BlobPart], { type: "image/png" }))
          : undefined;
        plates.push({ plate, positions, analysis, thumbUrl });
      }
      if (id !== req.current) {
        plates.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
        return;
      }
      replace({ plates, info: project.info });
      setStatus("ok");
    } catch (err) {
      if (id !== req.current) return;
      console.warn("No se pudo leer el modelo", err);
      setStatus("error");
    }
  }, [replace]);

  return { fileName, status, model, load };
}
