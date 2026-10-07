/**
 * Lightweight i18n without a library: the German UI strings are the keys, the
 * EN dictionary translates them. Missing keys fall back to German.
 *
 * t() reads prefs.lang, a $state value — calling it in a template is enough
 * for that text to update when the language changes.
 */
import { EN } from "./i18n-en";
import { prefs } from "./prefs.svelte";

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

export const t: TFunc = (key, vars) => {
  let out = prefs.lang === "en" ? EN[key] ?? key : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  }
  return out;
};
