import { business } from "./config";

export const money = (x: number) => Math.round(x).toLocaleString(business.locale);

export const num1 = (x: number) => x.toLocaleString(business.locale, { maximumFractionDigits: 1 });

export function duration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
