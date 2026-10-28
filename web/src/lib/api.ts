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
  /** Filamentos distintos de la cama (archivos de Bambu/Orca/Prusa con varios colores). */
  colors?: number;
  color_mix_mm?: number;
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
  /** Muy grande para cotizarlo en línea: el motivo. */
  review?: string | null;
}

export interface QuoteParams {
  material: MaterialId;
  quality: string;
  infill: number;
  qty: number;
  unit: "mm" | "cm" | "in";
  scale: number;
  supports: boolean;
  /** Archivos de varios colores: imprimirlos así (con cambios de filamento) o en uno solo. */
  multicolor?: boolean;
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
    /** Cambios de filamento y gramos purgados, ya sumados en grams y hours. */
    color_changes?: number;
    purge_grams?: number;
  } | null;
  error: string | null;
  created_at: string;
  valid_until: string;
  /** Muy grande para cotizarlo en línea: el motivo (no trae precio). */
  review?: string | null;
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
  /** Más allá de esto no hay precio en línea: se cotiza por WhatsApp. */
  limits: { maxPlates: number; maxFileMb: number } | null;
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
    limits?: { max_plates: number; max_file_mb: number };
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
    limits: c.limits ? { maxPlates: c.limits.max_plates, maxFileMb: c.limits.max_file_mb } : null,
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

export const defaultCatalog: ServerCatalog = { rates: pricing, bed: printer.bed, slicing: false, shipping: null, payments: false, limits: null };

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

// Catálogo

export type Badge = "viral" | "mas_pedido" | "nuevo";

export const BADGE_LABEL: Record<Badge, string> = { viral: "🔥 Viral", mas_pedido: "⭐ Más pedido", nuevo: "✨ Nuevo" };

export interface ProductSize {
  label: string;
  /** Escala en % sobre el modelo original. */
  scale: number;
}

export interface CatalogCollection {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cover: string | null;
  count: number;
  price_from: number | null;
}

export interface CatalogProduct {
  id: string;
  collection_id: string;
  kind: "model" | "name_keychain";
  name: string;
  subsection: string;
  description: string;
  badges: Badge[];
  images: string[];
  sizes: ProductSize[];
  default_color: string;
  file_id: string | null;
  price_from: number | null;
  personalize: { max_length: number } | null;
  collection?: { id: string; name: string; emoji: string };
}

export interface AdminProduct extends CatalogProduct {
  published: boolean;
  sort: number;
  /** Tiene modelo (o OpenSCAD para los llaveros con nombre). */
  ready: boolean;
}

export interface AdminCollection extends Omit<CatalogCollection, "count" | "price_from"> {
  published: boolean;
  sort: number;
  products: AdminProduct[];
}

/** Foto del catálogo; las de productos importados pueden ser un enlace externo mientras se descargan. */
export const imageUrl = (name: string) => (/^https?:\/\//.test(name) ? name : `${API_URL}/api/catalog/images/${name}`);

export function listCollections(): Promise<CatalogCollection[]> {
  return request("/api/catalog/collections");
}

/** Todos los productos visibles, para buscar y filtrar en el catálogo. */
export function listProducts(): Promise<CatalogProduct[]> {
  return request("/api/catalog/products");
}

/** Productos con foto para la galería de la página de inicio, de varias subsecciones. */
export function getFeatured(limit = 24): Promise<CatalogProduct[]> {
  return request(`/api/catalog/featured?limit=${limit}`);
}

export function getCollection(id: string): Promise<CatalogCollection & { products: CatalogProduct[] }> {
  return request(`/api/catalog/collections/${encodeURIComponent(id)}`);
}

export function getProduct(id: string): Promise<CatalogProduct> {
  return request(`/api/catalog/products/${encodeURIComponent(id)}`);
}

/** Genera el llavero con el texto; devuelve el archivo para verlo y cotizarlo. */
export async function personalize(productId: string, text: string): Promise<string> {
  const r = await request<{ file_id: string }>(`/api/catalog/products/${encodeURIComponent(productId)}/personalize`, json({ text }));
  return r.file_id;
}

/** Deja listo el modelo de un producto (los importados se descargan la primera vez). */
export async function prepareProduct(productId: string): Promise<string> {
  const r = await request<{ file_id: string }>(`/api/catalog/products/${encodeURIComponent(productId)}/prepare`, { method: "POST" });
  return r.file_id;
}

export function getServerFile(id: string): Promise<ServerFile> {
  return request(`/api/files/${id}`);
}

// Catálogo en el panel

const adminJson = (token: string, method: string, body?: unknown): RequestInit => ({
  method,
  headers: { ...auth(token), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const adminUpload = (token: string, file: File): RequestInit => {
  const body = new FormData();
  body.append("file", file);
  return { method: "POST", headers: auth(token), body };
};

export interface CollectionInput {
  name: string;
  description: string;
  emoji: string;
  sort: number;
  published: boolean;
}

export interface ProductInput {
  collection_id: string;
  name: string;
  subsection: string;
  description: string;
  badges: Badge[];
  sizes: ProductSize[];
  default_color: string;
  sort: number;
  published: boolean;
}

export function getAdminCatalog(token: string): Promise<{ collections: AdminCollection[]; openscad: boolean }> {
  return request("/api/admin/catalog", { headers: auth(token) });
}

export function saveCollection(token: string, data: CollectionInput, id?: string): Promise<unknown> {
  return id
    ? request(`/api/admin/catalog/collections/${id}`, adminJson(token, "PUT", data))
    : request("/api/admin/catalog/collections", adminJson(token, "POST", data));
}

export async function deleteCollection(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/catalog/collections/${id}`, adminJson(token, "DELETE"));
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).detail ?? res.statusText, res.status);
}

export function uploadCover(token: string, id: string, file: File): Promise<unknown> {
  return request(`/api/admin/catalog/collections/${id}/cover`, adminUpload(token, file));
}

export function saveProduct(token: string, data: ProductInput, id?: string): Promise<AdminProduct> {
  return id
    ? request(`/api/admin/catalog/products/${id}`, adminJson(token, "PUT", data))
    : request("/api/admin/catalog/products", adminJson(token, "POST", data));
}

export async function deleteProduct(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${id}`, adminJson(token, "DELETE"));
  if (!res.ok) throw new ApiError(res.statusText, res.status);
}

export function uploadProductModel(token: string, id: string, file: File): Promise<AdminProduct> {
  return request(`/api/admin/catalog/products/${id}/model`, adminUpload(token, file));
}

export function uploadProductImage(token: string, id: string, file: File): Promise<AdminProduct> {
  return request(`/api/admin/catalog/products/${id}/images`, adminUpload(token, file));
}

export function deleteProductImage(token: string, id: string, name: string): Promise<AdminProduct> {
  return request(`/api/admin/catalog/products/${id}/images/${name}`, adminJson(token, "DELETE"));
}
