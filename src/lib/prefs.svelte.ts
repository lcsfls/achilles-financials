/**
 * Display preferences shared by every component — language, number locale,
 * display currency and theme.
 *
 * A single $state object: the formatters in utils.ts read from it, so every
 * amount on screen re-renders by itself when the currency or language changes.
 * No provider, no context, no prop drilling.
 */
export type Lang = "de" | "en";
export type Theme = "system" | "light" | "dark";

export const prefs = $state({
  lang: "de" as Lang,
  locale: "de-DE",
  currency: "EUR",
  /** EUR → display currency. Amounts are stored in EUR throughout. */
  rate: 1,
  /** EUR → USD, for the secondary amount; null when unknown or USD is primary. */
  usdRate: null as number | null,
  theme: "system" as Theme,
});

export function applyLang(l: Lang) {
  prefs.lang = l;
  prefs.locale = l === "de" ? "de-DE" : "en-US";
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function applyFx(currency: string, rate: number, usdRate: number | null) {
  prefs.currency = currency;
  prefs.rate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  prefs.usdRate = usdRate && usdRate > 0 ? usdRate : null;
}

/** Fetch rates for the configured display currency. Without them it stays EUR. */
export async function loadFx() {
  try {
    const fx = await fetch("/api/fx").then((r) => r.json());
    applyFx(fx.currency, fx.rate, fx.usdRate);
  } catch {
    // Stay on EUR — better than empty amounts.
  }
}

export async function setLang(l: Lang) {
  applyLang(l);
  try { localStorage.setItem("achilles-lang", l); } catch { /* private mode */ }
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: l }),
  }).catch(() => {});
}

export async function setCurrency(code: string) {
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_currency: code }),
  }).catch(() => {});
  await loadFx();
}

/**
 * Theme is a per-device choice (a phone in the dark, a desk monitor in the
 * day), so it lives in localStorage, not in the server settings. static/theme.js
 * applies it before first paint so there is no flash.
 */
export function setTheme(t: Theme) {
  prefs.theme = t;
  try { localStorage.setItem("achilles-theme", t); } catch { /* private mode */ }
  applyTheme();
}

export function applyTheme() {
  if (typeof document === "undefined") return;
  const dark =
    prefs.theme === "dark" ||
    (prefs.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1115" : "#f6f7f9");
}
