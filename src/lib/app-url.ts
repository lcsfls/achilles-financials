import { getSetting } from "./db";

/**
 * Öffentliche Adresse der Instanz — die, unter der dein Handy sie erreicht.
 *
 * Reihenfolge: Einstellung > APP_URL aus der Umgebung > Ursprung des Requests.
 * Hinter einem Reverse-Proxy ist der Request-Ursprung die interne Adresse
 * (http://<lxc-ip>:3000) und damit für Enable Banking unbrauchbar — deshalb
 * muss die Domain explizit hinterlegt werden können.
 */
export function publicOrigin(requestUrl?: string): string {
  const configured = getSetting("app_url")?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  return requestUrl ? new URL(requestUrl).origin : "";
}

export function callbackUrl(requestUrl?: string): string {
  return `${publicOrigin(requestUrl)}/api/bank/callback`;
}

/** Prüft die Eingabe, bevor sie später als kryptischer Bank-Fehler auftaucht. */
export function validateAppUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "Keine gültige URL. Erwartet wird z. B. https://achilles.deine-domain.de" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Nur http:// oder https:// sind erlaubt." };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, error: "Bitte nur die Basis-Adresse angeben, ohne Pfad." };
  }
  return { ok: true, url: `${url.protocol}//${url.host}` };
}
