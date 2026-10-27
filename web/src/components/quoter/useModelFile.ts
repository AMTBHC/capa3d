"use client";

import { useCallback, useRef, useState } from "react";
import { printer } from "@/lib/config";
import { extensionOf, loadMesh, MANUAL_FORMATS, MESH_FORMATS } from "@/lib/mesh/load";
import { runAnalysis } from "@/lib/mesh/runAnalysis";
import type { MeshAnalysis } from "@/lib/mesh/analyze";

export type FileStatus = "idle" | "reading" | "ok" | "manual" | "error" | "big";

export interface LoadedModel {
  positions: Float32Array;
  analysis: MeshAnalysis;
}

/** Carga y analiza el archivo del cliente; ignora resultados de archivos reemplazados mientras cargaban. */
export function useModelFile() {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<FileStatus>("idle");
  const [model, setModel] = useState<LoadedModel | null>(null);
  const req = useRef(0);

  const load = useCallback(async (file: File) => {
    const id = ++req.current;
    const ext = extensionOf(file.name);
    setFileName(file.name);
    setModel(null);

    if ((MANUAL_FORMATS as readonly string[]).includes(ext)) return setStatus("manual");
    if (!(MESH_FORMATS as readonly string[]).includes(ext)) return setStatus("error");
    if (file.size > printer.maxFileMB * 1024 * 1024) return setStatus("big");

    setStatus("reading");
    try {
      const positions = await loadMesh(file);
      const analysis = await runAnalysis(positions);
      if (id !== req.current) return;
      setModel({ positions, analysis });
      setStatus("ok");
    } catch (err) {
      if (id !== req.current) return;
      console.warn("No se pudo leer el modelo", err);
      setStatus("error");
    }
  }, []);

  return { fileName, status, model, load };
}
