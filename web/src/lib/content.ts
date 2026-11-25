/**
 * Textos y opciones de la tienda en lenguaje sencillo. Todo lo que el cliente lee en la
 * portada sale de aquí, para cambiarlo sin tocar los componentes.
 *
 * Busca "[TU" para completar los datos de tu negocio.
 */

export const HERO = {
  eyebrow: "Impresión 3D · Envíos a toda Colombia",
  titleLead: "Piezas, repuestos y regalos",
  titleHighlight: "impresos en 3D, sin complicaciones.",
  lead:
    "Elige algo de nuestro catálogo o mándanos una foto de lo que necesitas. Nosotros lo diseñamos, te confirmamos el precio por WhatsApp y te lo enviamos.",
  primary: "Ver catálogo",
  secondary: "Pedir algo con una foto",
  trust: ["No necesitas archivos 3D", "Precio confirmado antes de imprimir", "Te asesoramos por WhatsApp"],
};

export const REASSURANCE =
  "No necesitas saber de diseño ni tener archivos 3D; nosotros nos encargamos de modelarlo y revisarlo contigo antes de imprimir.";

export interface HowStep {
  title: string;
  text: string;
  icon: string;
}

/** "¿Cómo funciona?": tres pasos, sin tecnicismos. */
export const HOW_STEPS: HowStep[] = [
  {
    title: "Eliges o nos cuentas",
    text: "Escoge una pieza del catálogo o mándanos una foto, un boceto o una descripción de lo que necesitas.",
    icon: "M4 7h3l2-3h6l2 3h3v12H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  },
  {
    title: "Revisamos y te cotizamos",
    text: "Revisamos medidas y que se pueda imprimir. Si hace falta, diseñamos la pieza y te la mostramos. Tú apruebas el precio.",
    icon: "M4 5h16v11H9l-5 4z M8 10h8 M8 13h5",
  },
  {
    title: "Imprimimos y te lo enviamos",
    text: "La imprimimos con acabado limpio, la empacamos y te la enviamos a tu casa o negocio.",
    icon: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
  },
];

export const FAQS: [string, string][] = [
  [
    "¿Necesito saber de diseño o tener un archivo 3D?",
    "No. Puedes elegir algo del catálogo o mandarnos una foto, un dibujo o una descripción. Nosotros lo modelamos, te lo mostramos y solo imprimimos cuando estés de acuerdo.",
  ],
  [
    "¿Cuánto cuesta?",
    "En el catálogo ves el precio desde el tamaño más pequeño. Para piezas a medida te enviamos el precio antes de empezar, sin compromiso: si no te convence, no pagas nada.",
  ],
  [
    "¿Cuánto se demora?",
    "[TUS TIEMPOS: por ejemplo, piezas pequeñas de 2 a 5 días hábiles; diseños a medida, según la complejidad. Más el envío.]",
  ],
  [
    "¿Hacen envíos?",
    "Sí, enviamos a toda Colombia con transportadora. El costo depende de tu ciudad y te lo decimos antes de pagar.",
  ],
  [
    "¿De qué material son las piezas?",
    "Usamos plásticos de impresión 3D. El más común sirve para decoración, figuras y regalos; tenemos otros que aguantan sol y agua, calor, o que son flexibles como el caucho. Si no sabes cuál, te recomendamos el adecuado.",
  ],
  [
    "Es un repuesto: ¿cómo sé que va a encajar?",
    "Mándanos fotos de la pieza desde varios ángulos con una regla o una moneda al lado. Revisamos las medidas contigo antes de imprimir y, si es posible, hacemos una prueba.",
  ],
  ["¿Cómo pago?", "[TUS MEDIOS DE PAGO: por ejemplo, enlace de pago con tarjeta, PSE o Nequi, o transferencia.]"],
  [
    "¿Hacen pedidos por cantidad para negocios?",
    "Sí. Imprimimos lotes para tiendas, emprendimientos y empresas: piezas promocionales, repuestos, exhibidores y más. Escríbenos con la cantidad y te damos precio por volumen.",
  ],
];

/** Tipos de pedido a medida. `use` es el valor que guarda la API. */
export const REQUEST_TYPES = [
  { use: "repuesto", label: "Repuesto o pieza rota", hint: "Perillas, soportes, tapas, ganchos…", emoji: "🔧" },
  { use: "figura", label: "Figura o regalo", hint: "Mascotas, personajes, trofeos…", emoji: "🎁" },
  { use: "maqueta", label: "Maqueta o prototipo", hint: "Proyectos, productos, arquitectura…", emoji: "🏗️" },
  { use: "decoracion", label: "Decoración", hint: "Letreros, materas, lámparas…", emoji: "🪴" },
  { use: "otro", label: "Otra idea", hint: "Cuéntanos y lo vemos juntos", emoji: "💡" },
] as const;

export type RequestUse = (typeof REQUEST_TYPES)[number]["use"];

/** Medidas aproximadas con objetos conocidos, para quien no tiene una regla a mano. */
export const SIZE_PRESETS: { label: string; hint: string; cm: number | null }[] = [
  { label: "Cabe en la mano", hint: "~5 cm", cm: 5 },
  { label: "Como un celular", hint: "~15 cm", cm: 15 },
  { label: "Como una hoja carta", hint: "~28 cm", cm: 28 },
  { label: "No sé", hint: "va en la foto", cm: null },
];

/** "¿Necesita algo especial?" en palabras del cliente; `material` es el que se sugiere al taller. */
export const NEEDS = [
  { material: "PETG", label: "Que aguante sol o agua" },
  { material: "ABS", label: "Que aguante calor (carro, cocina)" },
  { material: "TPU", label: "Que sea flexible" },
] as const;

/** Acabados que ofreces en el catálogo. Deja la lista vacía para no mostrar la opción. */
export const FINISHES = ["Mate", "Brillante"];

/** Nombres claros para las tallas cortas del catálogo. */
const SIZE_NAMES: Record<string, string> = { S: "Pequeño", M: "Mediano", L: "Grande", XL: "Extra grande" };
export const sizeName = (label: string) => SIZE_NAMES[label.trim().toUpperCase()] ?? label;

/**
 * Fotos de trabajos reales para la sección de confianza. Pon las fotos en
 * web/public/trabajos/ y agrégalas aquí; mientras esté vacía se usan las fotos del catálogo.
 */
export const REAL_WORKS: { src: string; title: string; caption: string }[] = [];
