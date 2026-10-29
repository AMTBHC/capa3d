"use client";

import { useState } from "react";
import { useModelAccept } from "@/lib/useModelAccept";
import { API_URL, printer } from "@/lib/config";
import { Icon, ICONS } from "../Icon";
import type { FileStatus, UploadStatus } from "./useModelFile";

export const FILE_INPUT_ID = "quote-file";

const SUB: Record<FileStatus, string> = {
  idle: API_URL ? "STL, OBJ, 3MF (también proyectos de Bambu Studio) o STEP" : "STL, OBJ o 3MF · los STEP envíalos por WhatsApp",
  reading: "Analizando tu modelo…",
  ok: "",
  manual: "Los archivos STEP los revisamos a mano. Envíanoslo por WhatsApp y te cotizamos.",
  error: "No pudimos leer este archivo. Expórtalo como STL u OBJ, o envíanoslo por WhatsApp.",
  big: `Supera ${printer.maxFileMB} MB. Envíanoslo por WhatsApp o con un enlace de descarga.`,
};

interface Props {
  fileName: string;
  status: FileStatus;
  upload: { status: UploadStatus; error?: string };
  onFile: (f: File) => void;
}

/** Zona para soltar o elegir el archivo; con archivo cargado queda como una fila compacta. */
export function FileDrop({ fileName, status, upload, onFile }: Props) {
  const accept = useModelAccept();
  const [over, setOver] = useState(false);
  const loaded = status === "ok" || status === "reading";
  const bad = status === "error" || status === "big" || status === "manual";
  const border = over ? "var(--ac)" : bad ? "var(--warn)" : loaded ? "var(--line)" : "var(--line-3)";

  return (
    <div
      onDragEnter={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      style={{
        position: "relative", borderRadius: 18, border: `2px ${loaded ? "solid" : "dashed"} ${border}`,
        background: over ? "var(--ac-tint)" : "var(--surface-3)", padding: loaded ? 14 : "28px 20px",
        display: "flex", flexDirection: loaded ? "row" : "column", alignItems: "center", gap: loaded ? 14 : 10,
        textAlign: loaded ? "left" : "center", transition: "all .2s",
      }}
    >
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept={accept}
        aria-label="Subir archivo 3D"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
      />
      <span style={{ width: loaded ? 44 : 56, height: loaded ? 44 : 56, flex: "none", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: loaded ? "var(--surface)" : "var(--ac)", color: loaded ? "var(--ac)" : "var(--bg)" }}>
        <Icon d={loaded ? ICONS.box : ICONS.upload} size={loaded ? 22 : 26} stroke={2} />
      </span>
      {loaded ? (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</div>
            <div role="status" style={{ fontSize: 13, color: "var(--text-3)" }}>
              {status === "reading" ? SUB.reading : upload.status === "error" ? "No pudimos subirlo para el precio exacto; te mostramos un estimado." : "Listo"}
            </div>
          </div>
          <span style={{ flex: "none", fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line-3)" }}>Cambiar</span>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{fileName && bad ? fileName : "Arrastra tu archivo aquí o haz clic para elegirlo"}</div>
          <div role="status" style={{ fontSize: 14, color: bad ? "var(--warn)" : "var(--text-3)", lineHeight: 1.5, maxWidth: 420 }}>{SUB[status]}</div>
        </>
      )}
    </div>
  );
}
