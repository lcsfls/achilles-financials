import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Aktive Zahlen-/Datums-Locale — wird vom LanguageProvider gesetzt.
let LOCALE = "de-DE";
export function setNumberLocale(locale: string) {
  LOCALE = locale;
}

export function fmtEUR(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);
}

export function fmtEUR0(n: number) {
  return fmtEUR(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

export function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %`;
}

export function fmtNum(n: number, maxFrac = 2) {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxFrac });
}

export function fmtGrams(n: number) {
  return `${n.toLocaleString(LOCALE, { maximumFractionDigits: 2 })} g`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(LOCALE);
}
