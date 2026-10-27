import { zipSync } from "three/examples/jsm/libs/fflate.module.js";

/** Cubo cerrado de lado `s` mm con la esquina en el origen (12 triángulos). */
export function cube(s = 10): Float32Array {
  const v = [
    [0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0],
    [0, 0, s], [s, 0, s], [s, s, s], [0, s, s],
  ];
  const f = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  return new Float32Array(f.flatMap((t) => t.flatMap((i) => v[i])));
}

export function binaryStl(p: Float32Array): ArrayBuffer {
  const n = p.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, n, true);
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) dv.setFloat32(84 + i * 50 + 12 + k * 4, p[i * 9 + k], true);
  return buf;
}

const CUBE_TRIS = [
  [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
  [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
];

/** Malla 3MF de un cubo de lado `s` (en las unidades del archivo). */
export function cubeMeshXml(s: number): string {
  const v = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]];
  return (
    "<mesh><vertices>" + v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join("") +
    "</vertices><triangles>" + CUBE_TRIS.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join("") +
    "</triangles></mesh>"
  );
}

const RELS =
  '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

export const tr = (x: number, y: number, z = 0) => `1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;

/** Paquete 3MF con los archivos dados (rutas sin barra inicial) más el _rels obligatorio. */
export function zip3mf(files: Record<string, string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const all: Record<string, Uint8Array> = { "_rels/.rels": enc.encode(RELS) };
  for (const [k, v] of Object.entries(files)) all[k] = typeof v === "string" ? enc.encode(v) : v;
  return zipSync(all);
}

/**
 * Proyecto al estilo de Bambu Studio: dos objetos cuyas mallas viven en
 * 3D/Objects/*.model (con ids repetidos entre archivos), dos camas, datos laminados
 * y ajustes del proyecto.
 */
export function bambuProject(): Uint8Array {
  const sub = (s: number) =>
    `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model">${cubeMeshXml(s)}</object></resources><build/></model>`;
  const root =
    '<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>' +
    '<object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object>' +
    '<object id="4" type="model"><components><component p:path="/3D/Objects/object_2.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object>' +
    `</resources><build><item objectid="2" transform="${tr(100, 100)}" printable="1"/><item objectid="4" transform="${tr(370, 100)}" printable="1"/><item objectid="2" transform="${tr(150, 100)}" printable="1"/></build></model>`;
  const settings =
    '<?xml version="1.0"?><config>' +
    '<object id="2"><metadata key="name" value="Cubo &amp; tapa"/><part id="1" subtype="normal_part"><metadata key="name" value="parte"/></part></object>' +
    '<object id="4"><metadata key="name" value="Cubo grande"/></object>' +
    '<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value=""/><metadata key="thumbnail_file" value="Metadata/plate_1.png"/>' +
    '<model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="0"/></model_instance>' +
    '<model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="1"/></model_instance></plate>' +
    '<plate><metadata key="plater_id" value="2"/><metadata key="plater_name" value="Tapas"/>' +
    '<model_instance><metadata key="object_id" value="4"/><metadata key="instance_id" value="0"/></model_instance></plate>' +
    "</config>";
  const slice =
    '<?xml version="1.0"?><config><plate><metadata key="index" value="2"/><metadata key="prediction" value="3600"/><metadata key="weight" value="12.5"/>' +
    '<filament id="1" type="PETG" color="#FFFFFF" used_m="4" used_g="12.5"/></plate></config>';
  const project = JSON.stringify({ printer_model: "Bambu Lab X1 Carbon", layer_height: "0.2", sparse_infill_density: "15%", filament_type: ["PETG"], filament_colour: ["#FFFFFF"] });
  return zip3mf({
    "3D/3dmodel.model": root,
    "3D/Objects/object_1.model": sub(10),
    "3D/Objects/object_2.model": sub(20),
    "Metadata/model_settings.config": settings,
    "Metadata/slice_info.config": slice,
    "Metadata/project_settings.config": project,
    "Metadata/plate_1.png": new Uint8Array([137, 80, 78, 71]),
  });
}
