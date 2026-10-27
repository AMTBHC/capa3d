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

export interface ServerCatalog {
  rates: PricingRates;
  bed: Bed;
  slicing: boolean;
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

export const defaultCatalog: ServerCatalog = { rates: pricing, bed: printer.bed, slicing: false };

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
export async function downloadQuote(token: string, quoteId: string): Promise<{ blob: Blob; name: string }> {
  const res = await fetch(`${API_URL}/api/admin/quotes/${quoteId}/download`, { headers: auth(token) });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  const disposition = res.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=utf-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : plain ?? `${quoteId}.zip`;
  return { blob: await res.blob(), name };
}
