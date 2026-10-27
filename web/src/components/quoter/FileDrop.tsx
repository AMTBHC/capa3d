"use client";

import { useState } from "react";
import { ACCEPT } from "@/lib/mesh/load";
import { API_URL, printer } from "@/lib/config";
import { Icon, ICONS } from "../Icon";
import type { FileStatus, UploadStatus } from "./useModelFile";

const SUB: Record<FileStatus, string> = {
  idle: API_URL
    ? "o haz clic para buscarlo · STL, OBJ, 3MF o STEP"
    : "o haz clic para buscarlo · STL, OBJ y 3MF se analizan al instante; STEP lo revisamos manualmente",
  reading: "Leyendo la malla y calculando medidas, volumen y peso…",
  ok: "Analizado. Toca aquí para cambiar de archivo.",
  manual: "Los archivos STEP los revisamos manualmente. Mientras tanto ves el estimado de ejemplo; envíanoslo por WhatsApp.",
  error: "No pudimos leer este archivo. Expórtalo como STL u OBJ, o envíanoslo por WhatsApp.",
  big: `Supera ${printer.maxFileMB} MB. Envíanoslo por WhatsApp o con un enlace de descarga.`,
};

interface Props {
  fileName: string;
  status: FileStatus;
  upload: { status: UploadStatus; error?: string };
  onFile: (f: File) => void;
}

export function FileDrop({ fileName, status, upload, onFile }: Props) {
  const [over, setOver] = useState(false);
  const border = status === "ok" || over ? "var(--ac)" : status === "error" || status === "big" ? "var(--bad)" : "rgba(255,255,255,.2)";
  return (
    <div
      onDragEnter={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      style={{ position: "relative", borderRadius: 24, border: `2px dashed ${border}`, background: status === "ok" || over ? "var(--ac-tint)" : "var(--surface)", padding: 28, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}
    >
      <input
        type="file"
        accept={ACCEPT}
        aria-label="Subir archivo 3D"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
      />
      <span style={{ width: 56, height: 56, flex: "none", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac)", color: "var(--bg)" }}>
        <Icon d={ICONS.upload} size={26} stroke={2} />
      </span>
      <div style={{ flex: "1 1 220px" }}>
        <div className="mono label">01 / ARCHIVO</div>
        <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4, wordBreak: "break-all" }}>{fileName || "Arrastra tu modelo aquí"}</div>
        <div role="status" style={{ color: "var(--text-3)", fontSize: 14, marginTop: 2, lineHeight: 1.5 }}>
          {SUB[status]}
          {upload.status === "uploading" && status !== "reading" && " Subiendo para laminarlo…"}
          {upload.status === "error" && status !== "error" && (
            <span style={{ display: "block", color: "var(--warn)" }}>No pudimos subirlo para laminarlo ({upload.error}). Te mostramos el estimado.</span>
          )}
        </div>
      </div>
    </div>
  );
}
