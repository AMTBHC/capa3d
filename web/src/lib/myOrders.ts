/** Pedidos hechos o abiertos en este navegador, para encontrarlos en "Mis pedidos". */

const KEY = "capa3d-pedidos";

export interface SavedOrder {
  id: string;
  token: string;
  created_at: string;
  file_name: string;
  total: number;
  status_label: string;
}

export function savedOrders(): SavedOrder[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveOrder(o: SavedOrder): void {
  try {
    const rest = savedOrders().filter((x) => x.id !== o.id);
    localStorage.setItem(KEY, JSON.stringify([o, ...rest].slice(0, 30)));
  } catch {
    // sin almacenamiento: el cliente puede buscarlo por correo y celular
  }
}

export const orderPath = (id: string, token: string) => `/pedido/${id}?t=${encodeURIComponent(token)}`;

// Diseños a medida pedidos en este navegador.

const DESIGNS_KEY = "capa3d-disenos";

export interface SavedDesign {
  id: string;
  token: string;
  created_at: string;
  description: string;
  status_label: string;
}

export function savedDesigns(): SavedDesign[] {
  try {
    const list = JSON.parse(localStorage.getItem(DESIGNS_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveDesign(d: SavedDesign): void {
  try {
    const rest = savedDesigns().filter((x) => x.id !== d.id);
    localStorage.setItem(DESIGNS_KEY, JSON.stringify([d, ...rest].slice(0, 30)));
  } catch {
    // sin almacenamiento: el enlace también llega por WhatsApp o correo
  }
}

export const designPath = (id: string, token: string) => `/diseno/${id}?t=${encodeURIComponent(token)}`;
