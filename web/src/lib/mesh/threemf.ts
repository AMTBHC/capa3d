import { strFromU8, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import type { Bed } from "../checks";
import type { ModelObject, Plate, ProjectInfo, SlicedPlate } from "./project";

/**
 * Lector de 3MF propio. Soporta lo que usan los slicers actuales:
 * - objetos con componentes en otros archivos del paquete (extensión de producción, `p:path`),
 * - transformaciones de componentes y de la construcción,
 * - unidades del modelo,
 * - varias camas (Bambu Studio / OrcaSlicer: `Metadata/model_settings.config`),
 * - datos laminados (`Metadata/slice_info.config`) y ajustes del proyecto,
 * - miniaturas de cada cama.
 * Funciona con expresiones regulares, sin DOM, para poder probarlo y correrlo en cualquier hilo.
 */

/** Matriz afín 3MF: 12 números en orden fila, el punto se multiplica por la izquierda (p · M). */
type Mat = number[];

const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseMat(s: string | undefined): Mat {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : IDENTITY;
}

/** Aplica `a` y luego `b`. */
function mul(a: Mat, b: Mat): Mat {
  const r = new Array<number>(12);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      let s = i === 3 ? b[9 + j] : 0;
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
      r[i * 3 + j] = s;
    }
  return r;
}

const UNIT_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

interface Component {
  path?: string;
  id: string;
  m: Mat;
}

interface Obj {
  name?: string;
  vertices?: Float64Array;
  triangles?: Uint32Array;
  components: Component[];
}

interface Item {
  id: string;
  path?: string;
  m: Mat;
}

interface ModelFile {
  unit: number;
  objects: Map<string, Obj>;
  items: Item[];
}

const RE = {
  x: /\bx="([^"]*)"/,
  y: /\by="([^"]*)"/,
  z: /\bz="([^"]*)"/,
  v1: /\bv1="([^"]*)"/,
  v2: /\bv2="([^"]*)"/,
  v3: /\bv3="([^"]*)"/,
  id: /\bid="([^"]*)"/,
  objectid: /\bobjectid="([^"]*)"/,
  name: /\bname="([^"]*)"/,
  path: /\b(?:\w+:)?path="([^"]*)"/,
  transform: /\btransform="([^"]*)"/,
  printable: /\bprintable="([^"]*)"/,
};

const get = (attrs: string, re: RegExp) => attrs.match(re)?.[1];

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&");
}

const normPath = (p: string) => p.replace(/^\/+/, "");

function parseModel(xml: string): ModelFile {
  const unit = UNIT_MM[xml.match(/<model\b[^>]*\bunit="([^"]+)"/)?.[1] ?? "millimeter"] ?? 1;
  const objects = new Map<string, Obj>();

  const objRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  let om: RegExpExecArray | null;
  while ((om = objRe.exec(xml))) {
    const id = get(om[1], RE.id);
    if (!id) continue;
    const body = om[2];
    const name = get(om[1], RE.name);
    const obj: Obj = { name: name ? decodeXml(name) : undefined, components: [] };

    const mesh = body.match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/);
    if (mesh) {
      const verts: number[] = [];
      const vRe = /<vertex\b([^>]*)>/g;
      let vm: RegExpExecArray | null;
      while ((vm = vRe.exec(mesh[1]))) verts.push(+(get(vm[1], RE.x) ?? 0), +(get(vm[1], RE.y) ?? 0), +(get(vm[1], RE.z) ?? 0));
      const tris: number[] = [];
      const tRe = /<triangle\b([^>]*)>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRe.exec(mesh[1]))) tris.push(+(get(tm[1], RE.v1) ?? 0), +(get(tm[1], RE.v2) ?? 0), +(get(tm[1], RE.v3) ?? 0));
      obj.vertices = Float64Array.from(verts);
      obj.triangles = Uint32Array.from(tris);
    }

    const cRe = /<component\b([^>]*)>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(body))) {
      const cid = get(cm[1], RE.objectid);
      if (!cid) continue;
      const path = get(cm[1], RE.path);
      obj.components.push({ id: cid, path: path ? normPath(path) : undefined, m: parseMat(get(cm[1], RE.transform)) });
    }
    objects.set(id, obj);
  }

  const items: Item[] = [];
  const build = xml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/);
  if (build) {
    const iRe = /<item\b([^>]*)>/g;
    let im: RegExpExecArray | null;
    while ((im = iRe.exec(build[1]))) {
      const id = get(im[1], RE.objectid);
      if (!id) continue;
      const path = get(im[1], RE.path);
      items.push({ id, path: path ? normPath(path) : undefined, m: parseMat(get(im[1], RE.transform)) });
    }
  }
  return { unit, objects, items };
}

/** Clave/valor de las etiquetas `<metadata key=".." value=".."/>` de un bloque. */
function metadata(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<metadata\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const k = m[1].match(/\bkey="([^"]*)"/)?.[1];
    const v = m[1].match(/\bvalue="([^"]*)"/)?.[1];
    if (k !== undefined && v !== undefined) out[k] = decodeXml(v);
  }
  return out;
}

export interface ThreeMfResult {
  plates: Plate[];
  info: ProjectInfo;
}

export function parse3mf(data: ArrayBuffer | Uint8Array, bed: Bed): ThreeMfResult {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const zip = unzipSync(u8, {
    filter: (f) => /\.(model|rels|config|json)$/i.test(f.name) || /^Metadata\/.*\.png$/i.test(f.name),
  });
  const text = (name: string) => (zip[name] ? strFromU8(zip[name]) : undefined);

  // Modelo raíz según _rels/.rels; si no, el primero en 3D/.
  const rels = text("_rels/.rels") ?? "";
  const target = rels.match(/<Relationship\b[^>]*Target="([^"]+\.model)"[^>]*Type="[^"]*3dmodel"/i)?.[1]
    ?? rels.match(/<Relationship\b[^>]*Type="[^"]*3dmodel"[^>]*Target="([^"]+\.model)"/i)?.[1];
  const rootPath = target ? normPath(target) : Object.keys(zip).find((n) => /^3D\/[^/]+\.model$/i.test(n));
  if (!rootPath || !zip[rootPath]) throw new Error("3MF sin modelo");

  const files = new Map<string, ModelFile>();
  const model = (path: string): ModelFile | undefined => {
    if (!files.has(path)) {
      const xml = text(path);
      if (xml === undefined) return undefined;
      files.set(path, parseModel(xml));
    }
    return files.get(path);
  };
  const root = model(rootPath)!;
  const unit = root.unit;

  // Expande un objeto (y sus componentes) a triángulos sin indexar, en mm.
  const emit = (path: string, id: string, m: Mat, out: Float32Array[], depth: number) => {
    if (depth > 32) return;
    const obj = model(path)?.objects.get(id);
    if (!obj) return;
    if (obj.vertices && obj.triangles) {
      const v = obj.vertices, t = obj.triangles;
      const p = new Float32Array(t.length * 3);
      for (let i = 0; i < t.length; i++) {
        const o = t[i] * 3;
        const x = v[o], y = v[o + 1], z = v[o + 2];
        p[i * 3] = (x * m[0] + y * m[3] + z * m[6] + m[9]) * unit;
        p[i * 3 + 1] = (x * m[1] + y * m[4] + z * m[7] + m[10]) * unit;
        p[i * 3 + 2] = (x * m[2] + y * m[5] + z * m[8] + m[11]) * unit;
      }
      out.push(p);
    }
    for (const c of obj.components) emit(c.path ?? path, c.id, mul(c.m, m), out, depth + 1);
  };

  // Nombres de los objetos según el slicer (Bambu/Orca), si existen.
  const settings = text("Metadata/model_settings.config") ?? "";
  const names = new Map<string, string>();
  const soRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  let so: RegExpExecArray | null;
  while ((so = soRe.exec(settings))) {
    const id = get(so[1], RE.id);
    const md = metadata(so[2].split(/<part\b/)[0]);
    if (id && md.name) names.set(id, md.name);
  }

  const instances: ModelObject[] = [];
  const byObject = new Map<string, number[]>();
  root.items.forEach((it, i) => {
    const out: Float32Array[] = [];
    emit(it.path ?? rootPath, it.id, it.m, out, 0);
    const positions = concat(out);
    const name = names.get(it.id) ?? model(it.path ?? rootPath)?.objects.get(it.id)?.name ?? `Objeto ${it.id}`;
    instances.push({ name, positions });
    if (!byObject.has(it.id)) byObject.set(it.id, []);
    byObject.get(it.id)!.push(i);
  });

  // Camas definidas por el slicer.
  const thumbs = (n: string | undefined) => (n && zip[normPath(n)] ? zip[normPath(n)] : undefined);
  let plates: Plate[] = [];
  let platesFrom: ProjectInfo["platesFrom"] = "single";
  const plRe = /<plate>([\s\S]*?)<\/plate>/g;
  let pl: RegExpExecArray | null;
  while ((pl = plRe.exec(settings))) {
    const head = metadata(pl[1].split(/<model_instance>/)[0]);
    const id = Number(head.plater_id ?? plates.length + 1);
    const objects: ModelObject[] = [];
    const miRe = /<model_instance>([\s\S]*?)<\/model_instance>/g;
    let mi: RegExpExecArray | null;
    while ((mi = miRe.exec(pl[1]))) {
      const md = metadata(mi[1]);
      const idx = byObject.get(md.object_id ?? "")?.[Number(md.instance_id ?? 0)];
      if (idx !== undefined && instances[idx].positions.length) objects.push(instances[idx]);
    }
    if (objects.length)
      plates.push({ id, name: head.plater_name || `Cama ${id}`, objects, thumbnail: thumbs(head.thumbnail_file ?? `Metadata/plate_${id}.png`) });
  }
  if (plates.length) platesFrom = "file";
  else {
    const printable = instances.filter((o) => o.positions.length);
    const groups = groupByPosition(printable, bed);
    platesFrom = groups.length > 1 ? "position" : "single";
    plates = groups.map((objects, i) => ({
      id: i + 1,
      name: `Cama ${i + 1}`,
      objects,
      thumbnail: groups.length === 1 ? thumbs("Metadata/thumbnail.png") ?? thumbs("Metadata/plate_1.png") : undefined,
    }));
  }
  plates.sort((a, b) => a.id - b.id);

  // Datos laminados por cama.
  const slice = text("Metadata/slice_info.config");
  if (slice) {
    const re = /<plate>([\s\S]*?)<\/plate>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(slice))) {
      const md = metadata(m[1]);
      const plate = plates.find((p) => p.id === Number(md.index));
      if (!plate) continue;
      const filaments: SlicedPlate["filaments"] = [];
      const fRe = /<filament\b([^>]*)>/g;
      let f: RegExpExecArray | null;
      while ((f = fRe.exec(m[1]))) {
        filaments.push({
          type: f[1].match(/\btype="([^"]*)"/)?.[1] ?? "",
          color: f[1].match(/\bcolor="([^"]*)"/)?.[1] ?? "",
          grams: numOrUndef(f[1].match(/\bused_g="([^"]*)"/)?.[1]),
        });
      }
      plate.sliced = { seconds: numOrUndef(md.prediction), grams: numOrUndef(md.weight), filaments };
    }
  }

  return { plates, info: { ...projectSettings(text), platesFrom } };
}

function numOrUndef(s: string | undefined): number | undefined {
  const n = s === undefined ? NaN : parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function concat(parts: Float32Array[]): Float32Array {
  if (parts.length === 1) return parts[0];
  const out = new Float32Array(parts.reduce((s, a) => s + a.length, 0));
  let off = 0;
  for (const a of parts) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/** Ajustes del proyecto: JSON de Bambu/Orca o .ini de PrusaSlicer. */
function projectSettings(text: (n: string) => string | undefined): Omit<ProjectInfo, "platesFrom"> {
  const info: Omit<ProjectInfo, "platesFrom"> = { filaments: [] };
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const json = text("Metadata/project_settings.config");
  if (json) {
    try {
      const s = JSON.parse(json) as Record<string, unknown>;
      info.slicer = "Bambu Studio / OrcaSlicer";
      info.printer = String(first(s.printer_model) ?? first(s.printer_settings_id) ?? "") || undefined;
      info.layerHeight = numOrUndef(String(first(s.layer_height) ?? ""));
      info.infill = numOrUndef(String(first(s.sparse_infill_density) ?? "").replace("%", ""));
      const types = (Array.isArray(s.filament_type) ? s.filament_type : []) as string[];
      const colors = (Array.isArray(s.filament_colour) ? s.filament_colour : []) as string[];
      info.filaments = types.map((type, i) => ({ type: String(type), color: String(colors[i] ?? "") }));
    } catch {
      // Ajustes ilegibles: se ignoran.
    }
    return info;
  }
  const ini = text("Metadata/Slic3r_PE.config");
  if (ini) {
    const val = (k: string) => ini.match(new RegExp(`^;\\s*${k}\\s*=\\s*(.*)$`, "m"))?.[1]?.trim();
    info.slicer = "PrusaSlicer";
    info.printer = val("printer_model") || val("printer_settings_id") || undefined;
    info.layerHeight = numOrUndef(val("layer_height"));
    info.infill = numOrUndef(val("fill_density")?.replace("%", ""));
    const types = (val("filament_type") ?? "").split(";").filter(Boolean);
    const colors = (val("filament_colour") ?? "").split(";");
    info.filaments = types.map((type, i) => ({ type, color: colors[i] ?? "" }));
  }
  return info;
}

interface Box {
  min: [number, number];
  max: [number, number];
}

function xyBox(p: Float32Array): Box {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < a) a = p[i];
    if (p[i] > c) c = p[i];
    if (p[i + 1] < b) b = p[i + 1];
    if (p[i + 1] > d) d = p[i + 1];
  }
  return { min: [a, b], max: [c, d] };
}

const fitsBed = (w: number, h: number, bed: Bed) =>
  (w <= bed.x && h <= bed.y) || (w <= bed.y && h <= bed.x);

/**
 * Sin camas declaradas: si las piezas no caben juntas en una cama, se agrupan por cercanía
 * (las camas de un slicer quedan separadas por un espacio vacío). Solo se acepta el
 * agrupamiento si cada grupo cabe en la cama; si no, todo queda en una sola.
 */
interface GroupBox {
  idx: number[];
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function groupBox(idx: number[], boxes: Box[]): GroupBox {
  const b = idx.map((i) => boxes[i]);
  const minX = Math.min(...b.map((x) => x.min[0])), maxX = Math.max(...b.map((x) => x.max[0]));
  const minY = Math.min(...b.map((x) => x.min[1])), maxY = Math.max(...b.map((x) => x.max[1]));
  return { idx, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

export function groupByPosition(objects: ModelObject[], bed: Bed): ModelObject[][] {
  if (objects.length <= 1) return [objects];
  const boxes = objects.map((o) => xyBox(o.positions));
  const all = boxes.reduce((u, b) => ({
    min: [Math.min(u.min[0], b.min[0]), Math.min(u.min[1], b.min[1])] as [number, number],
    max: [Math.max(u.max[0], b.max[0]), Math.max(u.max[1], b.max[1])] as [number, number],
  }));
  if (fitsBed(all.max[0] - all.min[0], all.max[1] - all.min[1], bed)) return [objects];

  const gap = 0.15 * Math.min(bed.x, bed.y);
  const parent = objects.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const dx = Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]);
      const dy = Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]);
      if (Math.max(dx, dy) < gap) parent[find(i)] = find(j);
    }
  const byRoot = new Map<number, number[]>();
  objects.forEach((_, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r)!.push(i);
  });
  let list = [...byRoot.values()].map((idx) => groupBox(idx, boxes));
  if (!list.every((g) => fitsBed(g.w, g.h, bed))) return [objects];

  // Une grupos mientras el conjunto quepa en una cama, empezando por los que quedan más compactos.
  for (;;) {
    let best: { i: number; j: number; g: GroupBox } | null = null;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const g = groupBox([...list[i].idx, ...list[j].idx], boxes);
        if (fitsBed(g.w, g.h, bed) && (!best || g.w * g.h < best.g.w * best.g.h)) best = { i, j, g };
      }
    if (!best) break;
    list = list.filter((_, k) => k !== best!.i && k !== best!.j).concat(best.g);
  }

  // Orden de lectura: filas de arriba hacia abajo, de izquierda a derecha.
  const row = (cy: number) => Math.round(-cy / (bed.y * 1.2));
  list.sort((a, b) => row(a.cy) - row(b.cy) || a.cx - b.cx);
  return list.map((g) => g.idx.map((i) => objects[i]));
}
