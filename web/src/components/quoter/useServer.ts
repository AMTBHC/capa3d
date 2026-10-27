"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { createQuote, defaultCatalog, fetchCatalog, getQuote, type QuoteParams, type ServerCatalog, type ServerQuote } from "@/lib/api";

/** Precios y cama del servidor; mientras carga (o sin API) usa los valores locales. */
export function useCatalog(): ServerCatalog {
  const [catalog, setCatalog] = useState(defaultCatalog);
  useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    fetchCatalog().then(
      (c) => alive && setCatalog(c),
      (e) => console.warn("No se pudo leer el catálogo de la API", e),
    );
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}

export type ServerQuoteState =
  | { status: "off" }
  | { status: "pending" }
  | { status: "done"; quote: ServerQuote }
  | { status: "failed"; error: string; quote?: ServerQuote };

const DEBOUNCE_MS = 700;
const POLL_MS = 1000;

/**
 * Cotización laminada en el servidor para el archivo y las opciones actuales.
 * Espera a que el usuario deje de cambiar opciones antes de pedirla.
 */
export function useServerQuote(fileId: string | undefined, params: QuoteParams | null): ServerQuoteState {
  const key = fileId && params ? JSON.stringify([fileId, params]) : null;
  const [state, setState] = useState<{ key: string; value: ServerQuoteState } | null>(null);

  useEffect(() => {
    if (!key) return;
    const [id, p] = JSON.parse(key) as [string, QuoteParams];
    let alive = true;
    const set = (value: ServerQuoteState) => alive && setState({ key, value });
    const timer = setTimeout(async () => {
      try {
        let q = await createQuote(id, p);
        while (alive && q.status === "pending") {
          await new Promise((r) => setTimeout(r, POLL_MS));
          q = await getQuote(q.id);
        }
        if (q.status === "done") set({ status: "done", quote: q });
        else set({ status: "failed", error: q.error ?? "No se pudo cotizar", quote: q });
      } catch (e) {
        set({ status: "failed", error: e instanceof Error ? e.message : String(e) });
      }
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (!key) return { status: "off" };
  return state?.key === key ? state.value : { status: "pending" };
}
