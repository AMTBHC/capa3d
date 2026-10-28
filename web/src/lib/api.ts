import { API_URL, pricing, printer, type MaterialId, type PricingRates } from "./config";
import type { Bed } from "./checks";

/** Cliente de la API de cotización (api/). Todas las funciones requieren API_URL. */

export interface ServerPlate {
  id: number;
  name: string;
  objects: string[];
  triangles: number;
  dx: number;
  dy: number;
  dz: number;
  volume_cm3: number;
  area_cm2: number;
  open_edges: number;
  sliced_seconds: number | null;
  sliced_grams: number | null;
}

export interface ServerFile {
  id: string;
  name: string;
  format: string;
  size: number;
  plates: ServerPlate[];
  info: {
    plates_from: "file" | "position" | "single";
    slicer: string | null;
    printer: string | null;
    layer_height: number | null;
    infill: number | null;
    filaments: { type: string; color: string }[];
  };
}

export interface QuoteParams {
  material: MaterialId;
  quality: string;
  infill: number;
  qty: number;
  unit: "mm" | "cm" | "in";
  scale: number;
  supports: boolean;
}

export interface ServerQuote {
  id: string;
  file_id: string;
  status: "pending" | "done" | "failed";
  method: "slicer" | "estimate" | "mixed" | null;
  plates: { id: number; name: string; method: "slicer" | "estimate"; grams: number; hours: number; note: string | null }[];
  price: {
    currency: string;
    grams: number;
    hours: number;
    price_per_gram: number;
    material_cost: number;
    machine_cost: number;
    base_fee: number;
    unit_price: number;
    qty: number;
    total: number;
  } | null;
  error: string | null;
  created_at: string;
  valid_until: string;
}

export interface Shipping {
  cost: number;
  /** Ciudades con otra tarifa. */
  cities: Record<string, number>;
}

export interface ServerCatalog {
  rates: PricingRates;
  bed: Bed;
  slicing: boolean;
  shipping: Shipping | null;
  /** Pago en línea con Wompi disponible. */
  payments: boolean;
}

/** Igual que normalize_city en la API: sin tildes, minúsculas y espacios simples. */
export function normalizeCity(city: string): string {
  return city.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).join(" ");
}

export function shippingFor(s: Shipping, city: string): number {
  const key = normalizeCity(city);
  const hit = Object.entries(s.cities).find(([name]) => normalizeCity(name) === key);
  return hit ? hit[1] : s.cost;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // cuerpo sin JSON
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchCatalog(): Promise<ServerCatalog> {
  const c = await request<{
    pricing: { machine_rate_per_hour: number; base_fee: number; round_to: number; setup_hours_per_plate: number };
    bed: [number, number, number];
    materials: Record<string, { price_per_gram: number }>;
    slicing: boolean;
    shipping?: Shipping;
    payments?: boolean;
  }>("/api/catalog");
  const pricePerGram = { ...pricing.pricePerGram };
  for (const id of Object.keys(pricePerGram) as MaterialId[]) {
    const m = c.materials[id];
    if (m) pricePerGram[id] = m.price_per_gram;
  }
  return {
    rates: {
      pricePerGram,
      machineRatePerHour: c.pricing.machine_rate_per_hour,
      baseFee: c.pricing.base_fee,
      roundTo: c.pricing.round_to,
      setupHoursPerPlate: c.pricing.setup_hours_per_plate,
    },
    bed: { x: c.bed[0], y: c.bed[1], z: c.bed[2] },
    slicing: c.slicing,
    shipping: c.shipping ?? null,
    payments: !!c.payments,
  };
}

export function uploadFile(file: File): Promise<ServerFile> {
  const body = new FormData();
  body.append("file", file);
  return request<ServerFile>("/api/files", { method: "POST", body });
}

/** Malla STL de una cama tal como la tiene el servidor (se usa para mostrar STEP). */
export async function fetchPlateStl(fileId: string, plateId: number): Promise<ArrayBuffer> {
  const res = await fetch(`${API_URL}/api/files/${fileId}/plates/${plateId}.stl`);
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.arrayBuffer();
}

export function createQuote(fileId: string, params: QuoteParams): Promise<ServerQuote> {
  return request<ServerQuote>("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, ...params }),
  });
}

export function getQuote(id: string): Promise<ServerQuote> {
  return request<ServerQuote>(`/api/quotes/${id}`);
}

export const defaultCatalog: ServerCatalog = { rates: pricing, bed: printer.bed, slicing: false, shipping: null, payments: false };

/** El cliente tocó "Pedir por WhatsApp": la cotización queda marcada en el panel. */
export function markRequested(quoteId: string, color: string): void {
  fetch(`${API_URL}/api/quotes/${quoteId}/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
    // Sigue aunque la página se vaya a WhatsApp.
    keepalive: true,
  }).catch(() => {});
}

// Panel de administración

export interface AdminQuote {
  id: string;
  status: "pending" | "done" | "failed";
  created_at: string;
  valid_until: string;
  requested_at: string | null;
  color: string | null;
  file_name: string;
  file_format: string;
  plates: number;
  pieces: number;
  params: QuoteParams & { file_id: string };
  method: "slicer" | "estimate" | "mixed" | null;
  grams: number | null;
  hours: number | null;
  total: number | null;
  currency: string | null;
  error: string | null;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export function listAdminQuotes(token: string, requestedOnly: boolean): Promise<AdminQuote[]> {
  return request<AdminQuote[]>(`/api/admin/quotes?limit=200${requestedOnly ? "&requested=true" : ""}`, {
    headers: auth(token),
  });
}

/** Descarga el zip del pedido (archivo del cliente, G-code y resumen). */
export function downloadQuote(token: string, quoteId: string): Promise<{ blob: Blob; name: string }> {
  return downloadZip(`/api/admin/quotes/${quoteId}/download`, token, quoteId);
}

async function downloadZip(path: string, token: string, fallback: string): Promise<{ blob: Blob; name: string }> {
  const res = await fetch(`${API_URL}${path}`, { headers: auth(token) });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  const disposition = res.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=utf-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : plain ?? `${fallback}.zip`;
  return { blob: await res.blob(), name };
}

// Pedidos

export type OrderStatus = "received" | "confirmed" | "paid" | "printing" | "shipped" | "delivered" | "cancelled";

export interface CustomerData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  department: string;
  notes: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  status_label: string;
  status_text: string;
  flow: { status: OrderStatus; label: string }[];
  events: { status: OrderStatus; label: string; note: string | null; created_at: string }[];
  created_at: string;
  quote_id: string;
  file_name: string;
  plates: number;
  params: QuoteParams;
  color: string | null;
  customer: Pick<CustomerData, "name" | "city" | "department" | "address">;
  print_price: number;
  shipping: number;
  total: number;
  /** Lo que ya pagó el cliente (abono o total). */
  paid_amount: number;
  /** Lo que falta por pagar; con abono, se paga en efectivo al recibir. */
  balance: number;
  plan: "full" | "deposit" | null;
  /** Abono disponible para este pedido; 0 si el taller no ofrece abono. */
  deposit_amount: number;
  deposit_percent: number;
  currency: string;
  carrier: string | null;
  tracking: string | null;
  can_pay: boolean;
  payment_status: string | null;
}

export interface AdminOrder extends Omit<Order, "customer"> {
  token: string;
  customer: CustomerData;
  payments: { reference: string; amount: number; status: string; transaction_id: string | null; created_at: string }[];
  order_url: string;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function createOrder(quoteId: string, color: string, customer: CustomerData): Promise<Order & { token: string }> {
  return request("/api/orders", json({ quote_id: quoteId, color, customer }));
}

export function getOrder(id: string, token: string): Promise<Order> {
  return request(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`);
}

/**
 * URL de Wompi para pagar el pedido confirmado. `returns` es false cuando el sitio corre en una
 * dirección local: Wompi no devolverá al cliente, así que conviene abrirlo en otra pestaña.
 */
export function checkoutOrder(id: string, token: string, plan: "full" | "deposit"): Promise<{ url: string; returns: boolean }> {
  return request(`/api/orders/${encodeURIComponent(id)}/checkout?t=${encodeURIComponent(token)}`, json({ plan }));
}

export interface FoundOrder {
  id: string;
  token: string;
  status: OrderStatus;
  status_label: string;
  created_at: string;
  total: number;
  file_name: string;
}

/** Pedidos del cliente por correo y celular. */
export function lookupOrders(email: string, phone: string): Promise<FoundOrder[]> {
  return request("/api/orders/lookup", json({ email, phone }));
}

/** Dirección de la conexión en vivo del pedido (EventSource). */
export function orderStreamUrl(id: string, token: string): string {
  return `${API_URL}/api/orders/${encodeURIComponent(id)}/stream?t=${encodeURIComponent(token)}`;
}

/**
 * Conexión en vivo del panel. EventSource no permite el encabezado de la clave, así que se
 * lee el flujo con fetch. Se reconecta sola; devuelve una función para cerrarla.
 */
export function watchAdmin(token: string, onChange: (data: { count: number; by_status: Record<string, number> }) => void, onState: (live: boolean) => void): () => void {
  let stopped = false;
  let ctrl: AbortController | null = null;
  const run = async () => {
    while (!stopped) {
      ctrl = new AbortController();
      try {
        const res = await fetch(`${API_URL}/api/admin/stream`, { headers: auth(token), signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        onState(true);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = block.split("\n").find((l) => l.startsWith("data: "));
            if (data) onChange(JSON.parse(data.slice(6)));
          }
        }
      } catch {
        // desconexión: se reintenta
      }
      onState(false);
      if (!stopped) await new Promise((r) => setTimeout(r, 3000));
    }
  };
  run();
  return () => {
    stopped = true;
    ctrl?.abort();
  };
}

/** Al volver de Wompi: la API consulta la transacción y actualiza el pedido. */
export function confirmPayment(id: string, token: string, transactionId: string): Promise<Order> {
  return request(`/api/orders/${encodeURIComponent(id)}/payment-return?t=${encodeURIComponent(token)}`, json({ transaction_id: transactionId }));
}

export function listAdminOrders(token: string, statuses: OrderStatus[]): Promise<AdminOrder[]> {
  return request(`/api/admin/orders?status=${statuses.join(",")}`, { headers: auth(token) });
}

export type OrderActionName = "confirm" | "mark_paid" | "start_printing" | "ship" | "deliver" | "cancel";

export function adminOrderAction(
  token: string,
  id: string,
  action: OrderActionName,
  extra: { print_price?: number; shipping?: number; carrier?: string; tracking?: string; note?: string; plan?: "full" | "deposit" } = {},
): Promise<AdminOrder> {
  const init = json({ action, ...extra });
  return request(`/api/admin/orders/${id}/action`, { ...init, headers: { ...init.headers, ...auth(token) } });
}

/** Descarga el zip del pedido con los datos del cliente. */
export async function downloadOrder(token: string, id: string): Promise<{ blob: Blob; name: string }> {
  return downloadZip(`/api/admin/orders/${id}/download`, token, id);
}
