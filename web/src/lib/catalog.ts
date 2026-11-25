import type { MaterialId } from "./config";

/** Perfil de una pieza para las vistas apiladas por capas: u ∈ [0,1] (base→tope) → ancho en px. */
export type Profile = (u: number) => number;

export const vase =
  (base: number, amp: number, taper: number): Profile =>
  (u) =>
    base + amp * Math.sin(Math.PI * (0.12 + 0.76 * u)) - taper * u;

export interface Material {
  id: MaterialId;
  tag: string;
  /** Resistencia, flexibilidad y calor, de 1 a 5. */
  meters: [number, number, number];
  /** g/cm³ */
  density: number;
  color: string;
  desc: string;
  temp: string;
  ideal: string;
  finish: string;
  flexibility: string;
  radius: string;
  profile: Profile;
}

export const MATERIALS: Material[] = [
  {
    id: "PLA",
    tag: "Fácil y versátil",
    meters: [3, 1, 2],
    density: 1.24,
    color: "#8C53FD",
    desc: "El material más versátil: preciso, económico y con gran variedad de colores. Ideal para empezar.",
    temp: "Hasta ~55 °C",
    ideal: "Prototipos, figuras, decoración",
    finish: "Mate o brillante, buen detalle",
    flexibility: "Baja",
    radius: "50%",
    profile: vase(70, 96, 36),
  },
  {
    id: "PETG",
    tag: "Tenaz y resistente",
    meters: [4, 2, 3],
    density: 1.27,
    color: "#3D8BFF",
    desc: "Más tenaz que el PLA y resistente a la humedad y a muchos químicos. Para piezas que se usan.",
    temp: "Hasta ~75 °C",
    ideal: "Piezas funcionales, exteriores, contenedores",
    finish: "Brillante y liso",
    flexibility: "Media",
    radius: "50%",
    profile: (u) => 128 - 12 * u,
  },
  {
    id: "ABS",
    tag: "Aguanta calor",
    meters: [4, 2, 5],
    density: 1.04,
    color: "#C9C9C3",
    desc: "Soporta temperaturas altas y golpes. Se puede lijar y dar acabado para uso exigente.",
    temp: "Hasta ~95 °C",
    ideal: "Carcasas, piezas mecánicas, automotriz",
    finish: "Mate, se puede lijar",
    flexibility: "Media",
    radius: "14px",
    profile: () => 132,
  },
  {
    id: "TPU",
    tag: "Flexible",
    meters: [2, 5, 3],
    density: 1.21,
    color: "#3DDC84",
    desc: "Elástico y resistente al desgaste: se dobla y vuelve a su forma sin romperse.",
    temp: "Hasta ~60 °C",
    ideal: "Fundas, sellos, agarres, amortiguadores",
    finish: "Tacto tipo caucho",
    flexibility: "Muy alta",
    radius: "50%",
    profile: (u) => 112 + 24 * Math.sin(u * Math.PI * 4),
  },
];

export interface Quality {
  /** Id en el catálogo de la API (api/config/catalog.toml). */
  id: string;
  name: string;
  layerMm: number;
  /** Líneas del ícono. */
  lines: number;
  /** Capas en la vista previa de ejemplo. */
  previewLayers: number;
  previewBorder: number;
  /** mm³/s efectivos. */
  flow: number;
}

export const QUALITIES: Quality[] = [
  { id: "borrador", name: "Borrador", layerMm: 0.28, lines: 4, previewLayers: 14, previewBorder: 3, flow: 12 },
  { id: "estandar", name: "Estándar", layerMm: 0.2, lines: 6, previewLayers: 24, previewBorder: 2, flow: 8 },
  { id: "detalle", name: "Detalle", layerMm: 0.12, lines: 9, previewLayers: 38, previewBorder: 1.5, flow: 4.5 },
];

export interface FilamentColor {
  name: string;
  /** Color del carrete. */
  spool: string;
  /** Color con el que se pinta la vista previa. */
  render: string;
}

export const COLORS: FilamentColor[] = [
  { name: "Negro", spool: "#1A1A1D", render: "#4A4A52" },
  { name: "Blanco", spool: "#F2F2EE", render: "#F2F2EE" },
  { name: "Gris", spool: "#8A8F98", render: "#8A8F98" },
  { name: "Naranja", spool: "#FF5A1F", render: "#FF5A1F" },
  { name: "Azul", spool: "#2F6BFF", render: "#4F82FF" },
  { name: "Verde", spool: "#3DDC84", render: "#3DDC84" },
  { name: "Rojo", spool: "#E5383B", render: "#EF4F52" },
  { name: "Amarillo", spool: "#FFD23F", render: "#FFD23F" },
];
