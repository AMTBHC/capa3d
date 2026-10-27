"use client";

import { useCallback, useRef, useState } from "react";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { API_URL, printer } from "@/lib/config";
import { fetchPlateStl, uploadFile, type ServerFile } from "@/lib/api";
import type { Bed } from "@/lib/checks";
import { extensionOf, loadProject, MANUAL_FORMATS, MESH_FORMATS } from "@/lib/mesh/load";
import { runAnalysis } from "@/lib/mesh/runAnalysis";
import type { MeshAnalysis } from "@/lib/mesh/analyze";
import { platePositions, type Plate, type Project, type ProjectInfo } from "@/lib/mesh/project";

export type FileStatus = "idle" | "reading" | "ok" | "manual" | "error" | "big";

/** Estado de la copia del archivo en el servidor (solo con API). */
export type UploadStatus = "off" | "uploading" | "ready" | "error";

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

/**
 * Carga y analiza el archivo del cliente en el navegador y, si hay API, lo sube para
 * laminarlo. Los STEP solo se pueden ver con la API: el servidor los convierte a malla.
 * Ignora resultados de archivos reemplazados mientras cargaban.
 */
export function useModelFile(bed: Bed = printer.bed) {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<FileStatus>("idle");
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [upload, setUpload] = useState<{ status: UploadStatus; file?: ServerFile; error?: string }>({ status: "off" });
  const req = useRef(0);
  const current = useRef<LoadedModel | null>(null);

  const replace = useCallback((next: LoadedModel | null) => {
    current.current?.plates.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
    current.current = next;
    setModel(next);
  }, []);

  const load = useCallback(
    async (file: File) => {
      const id = ++req.current;
      const stale = () => id !== req.current;
      const ext = extensionOf(file.name);
      const isCad = (MANUAL_FORMATS as readonly string[]).includes(ext);
      setFileName(file.name);
      replace(null);
      setUpload({ status: "off" });

      if (!isCad && !(MESH_FORMATS as readonly string[]).includes(ext)) return setStatus("error");
      if (file.size > printer.maxFileMB * 1024 * 1024) return setStatus("big");
      if (isCad && !API_URL) return setStatus("manual");

      // Subida en paralelo al análisis local.
      let uploaded: Promise<ServerFile> | null = null;
      if (API_URL) {
        setUpload({ status: "uploading" });
        uploaded = uploadFile(file);
        uploaded.then(
          (f) => !stale() && setUpload({ status: "ready", file: f }),
          (e: Error) => !stale() && setUpload({ status: "error", error: e.message }),
        );
      }

      setStatus("reading");
      try {
        const project = isCad ? await projectFromServer(await uploaded!) : await loadProject(file, bed);
        const plates: LoadedPlate[] = [];
        for (const plate of project.plates) {
          const positions = platePositions(plate);
          const analysis = await runAnalysis(positions);
          const thumbUrl = plate.thumbnail
            ? URL.createObjectURL(new Blob([plate.thumbnail as BlobPart], { type: "image/png" }))
            : undefined;
          plates.push({ plate, positions, analysis, thumbUrl });
        }
        if (stale()) {
          plates.forEach((p) => p.thumbUrl && URL.revokeObjectURL(p.thumbUrl));
          return;
        }
        replace({ plates, info: project.info });
        setStatus("ok");
      } catch (err) {
        if (stale()) return;
        console.warn("No se pudo leer el modelo", err);
        setStatus(isCad ? "manual" : "error");
      }
    },
    [bed, replace],
  );

  return { fileName, status, model, upload, load };
}

/** Proyecto armado con las mallas que el servidor generó (archivos STEP). */
async function projectFromServer(f: ServerFile): Promise<Project> {
  const loader = new STLLoader();
  const plates: Plate[] = [];
  for (const p of f.plates) {
    const geo = loader.parse(await fetchPlateStl(f.id, p.id));
    const positions = geo.getAttribute("position").array as Float32Array;
    plates.push({ id: p.id, name: p.name, objects: [{ name: p.objects[0] ?? f.name, positions }] });
  }
  return {
    plates,
    info: { platesFrom: f.info.plates_from, filaments: f.info.filaments, slicer: f.info.slicer ?? undefined },
  };
}
