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

export const METER_LABELS = ["RESISTENCIA", "FLEXIBILIDAD", "CALOR"] as const;

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

export const GALLERY_CATEGORIES = ["Prototipos", "Miniaturas", "Funcionales", "Arte y decoración"] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export interface Work {
  name: string;
  category: GalleryCategory;
  /** Ruta en /public. Sin imagen se dibuja una pieza por capas con `profile`. */
  img?: string;
  material: string;
  desc: string;
  profile: Profile;
  color: string;
  radius: string;
}

/** Reemplaza `img` por fotos reales de tus trabajos en /public/gallery. */
export const WORKS: Work[] = [
  { name: "Carcasa electrónica", category: "Prototipos", material: "PLA blanco", desc: "Caja con tapa a presión para proyectos de electrónica y sensores.", profile: () => 120, color: "#F2F2EE", radius: "12px" },
  { name: "Figura de colección", category: "Miniaturas", material: "PLA gris", desc: "Miniatura de 28 mm lista para pintar, con base integrada.", profile: (u) => (u < 0.15 ? 120 : 50 + 40 * Math.sin(Math.PI * u)), color: "#8A8F98", radius: "50%" },
  { name: "Engranaje de transmisión", category: "Funcionales", img: "/img/engranaje.svg", material: "PETG o ABS", desc: "Repuesto funcional con dientes precisos para mecanismos.", profile: () => 130, color: "#C9C9C3", radius: "50%" },
  { name: "Jarrón en espiral", category: "Arte y decoración", img: "/img/jarron.svg", material: "PLA azul", desc: "Pieza decorativa de pared continua, ligera y llamativa.", profile: vase(70, 96, 36), color: "#4F82FF", radius: "50%" },
  { name: "Clip de sujeción", category: "Prototipos", material: "TPU", desc: "Prototipo flexible que encaja y suelta sin romperse.", profile: (u) => 112 + 24 * Math.sin(u * Math.PI * 4), color: "#3DDC84", radius: "50%" },
  { name: "Torre de ajedrez", category: "Miniaturas", material: "PLA grafito", desc: "Pieza de juego con detalle en almenas y base estable.", profile: (u) => (u < 0.12 ? 130 : u > 0.85 ? 110 : 80), color: "#4A4A52", radius: "50%" },
  { name: "Soporte de montaje", category: "Funcionales", material: "ABS", desc: "Escuadra con perforaciones para tornillos, resistente al calor.", profile: (u) => (u < 0.2 ? 140 : 60), color: "#C9C9C3", radius: "8px" },
  { name: "Relieve decorativo", category: "Arte y decoración", material: "PLA rojo", desc: "Pieza de pared con anillos concéntricos para decoración.", profile: (u) => 150 - 110 * u, color: "#EF4F52", radius: "50%" },
];

export interface Step {
  n: string;
  title: string;
  text: string;
  icon: string;
}

export const STEPS: Step[] = [
  { n: "01", title: "Sube tu archivo", text: "Carga tu STL, OBJ, 3MF o STEP desde el cotizador.", icon: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4" },
  { n: "02", title: "Personaliza", text: "Elige material, calidad, relleno y color.", icon: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4" },
  { n: "03", title: "Revisión e impresión", text: "Confirmas el precio, revisamos el archivo e imprimimos.", icon: "M5 18h14 M6.5 14h11 M8 10h8 M9.5 6h5" },
  { n: "04", title: "Entrega", text: "Pieza posprocesada, empacada y enviada.", icon: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10" },
];

export const FAQS: [string, string][] = [
  ["¿Qué formatos de archivo aceptan?", "Aceptamos .STL, .OBJ, .3MF y .STEP. Si todavía no tienes el modelo, escríbenos y vemos cómo ayudarte."],
  ["¿Qué material me conviene?", "PLA para prototipos y decoración, PETG para piezas funcionales, ABS para piezas que soportan calor y TPU para piezas flexibles."],
  ["¿Revisan mi archivo antes de imprimir?", "Sí. Revisamos que el modelo sea imprimible y te avisamos si hace falta ajustar algo antes de empezar."],
  ["¿Puedo pedir varias unidades?", "Sí. Para lotes el precio por unidad baja con la cantidad. Escríbenos por WhatsApp con tu archivo y cuántas necesitas."],
  ["¿Cuánto tarda y cómo envían?", "[TUS TIEMPOS DE PRODUCCIÓN Y ENVÍO]"],
  ["¿Cómo pago?", "[TUS MEDIOS DE PAGO]"],
];
