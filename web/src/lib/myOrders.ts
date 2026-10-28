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
