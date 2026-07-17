import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Aufruf der eigenen API.
 *
 * Ist die Sitzung abgelaufen — oder wurde der Login gerade erst eingerichtet —
 * antwortet die Middleware mit 401. Ein blankes r.json() lieferte dann
 * {error:…} statt der Daten, die Seite rendert damit weiter und stürzt ab
 * ("Application error"). Ein abgelaufener Login gehört auf die Login-Seite.
 */
export async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  // Auf der Login-Seite selbst NICHT weiterleiten: Dort ist ein 401 der
  // Normalfall, und ein Sprung nach /login lädt die Seite neu, die dann
  // erneut abruft — eine Endlosschleife, die als Flackern erscheint und die
  // Eingabe der Zugangsdaten unmöglich macht.
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
    // Bewusst nie erfüllt: Während der Wechsel zur Login-Seite läuft, soll
    // kein Aufrufer mit Fehlerdaten weiterrendern.
    return new Promise<never>(() => {});
  }
  return res.json() as Promise<T>;
}

// Aktive Zahlen-/Datums-Locale — wird vom LanguageProvider gesetzt.
let LOCALE = "de-DE";
export function setNumberLocale(locale: string) {
  LOCALE = locale;
}

/**
 * Anzeigewährung.
 *
 * Gerechnet und gespeichert wird durchgehend in EUR (alle Spalten heißen
 * *_eur). Umgerechnet wird ausschließlich hier, beim Formatieren — deshalb
 * nimmt fmtEUR weiterhin einen EUR-Betrag entgegen und alle bestehenden
 * Aufrufstellen stimmen ohne Änderung.
 */
let DISPLAY = { code: "EUR", rate: 1 };
let USD_RATE: number | null = null;

export function setDisplayCurrency(code: string, rate: number, usdRate: number | null) {
  DISPLAY = { code, rate: Number.isFinite(rate) && rate > 0 ? rate : 1 };
  USD_RATE = usdRate && usdRate > 0 ? usdRate : null;
}

export function displayCurrency() {
  return DISPLAY.code;
}

/** Betrag in EUR — formatiert in der eingestellten Anzeigewährung. */
export function fmtEUR(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: DISPLAY.code,
    maximumFractionDigits: 2,
    ...opts,
  }).format(n * DISPLAY.rate);
}

export function fmtEUR0(n: number) {
  return fmtEUR(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/**
 * Derselbe Betrag zusätzlich in USD — die Zweitanzeige neben jedem Wert.
 * Gibt null zurück, wenn USD bereits die Anzeigewährung ist (dann wäre es eine
 * Dopplung) oder kein Kurs vorliegt.
 */
export function fmtUSD(n: number, opts: Intl.NumberFormatOptions = {}): string | null {
  if (DISPLAY.code === "USD" || USD_RATE === null) return null;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    ...opts,
  }).format(n * USD_RATE);
}

export function fmtUSD0(n: number) {
  return fmtUSD(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
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
