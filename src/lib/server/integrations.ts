import { getSetting, setSetting } from "./db";

/**
 * Bankanbindungen als einzeln aktivierbare Integrationen.
 *
 * Zwei Wege, die sich ergänzen statt zu ersetzen: Enable Banking deckt ganz
 * Europa ab, verlangt aber eine öffentlich erreichbare HTTPS-Domain. FinTS
 * spricht direkt mit deutschen Banken — ohne Redirect, ohne Domain, ohne
 * Aggregator — dafür nur mit deutschen Banken und nach Produktregistrierung.
 */
export type IntegrationId = "enablebanking" | "fints";

export type IntegrationState = {
  id: IntegrationId;
  enabled: boolean;
  configured: boolean;
};

const ENABLED_KEY: Record<IntegrationId, string> = {
  enablebanking: "eb_enabled",
  fints: "fints_enabled",
};

export function isEnabled(id: IntegrationId): boolean {
  const explicit = getSetting(ENABLED_KEY[id]);
  if (explicit !== null) return explicit === "1";
  // Bestandsinstallationen kannten den Schalter noch nicht: Wer Enable Banking
  // schon eingerichtet hat, soll es nach dem Update nicht abgeschaltet
  // vorfinden.
  return id === "enablebanking" && isConfigured("enablebanking");
}

export function setEnabled(id: IntegrationId, on: boolean) {
  // Beim Ausschalten "0" schreiben statt zu löschen: Ein fehlender Wert würde
  // den Bestandsfallback auslösen und ein konfiguriertes Enable Banking sofort
  // wieder aktivieren.
  setSetting(ENABLED_KEY[id], on ? "1" : "0");
}

export function isConfigured(id: IntegrationId): boolean {
  if (id === "enablebanking") return Boolean(getSetting("eb_app_id") && getSetting("eb_private_key"));
  return Boolean(getSetting("fints_url") && getSetting("fints_blz") && getSetting("fints_user") && getSetting("fints_pin"));
}

export function getIntegrations(): IntegrationState[] {
  return (["enablebanking", "fints"] as IntegrationId[]).map((id) => ({
    id,
    enabled: isEnabled(id),
    configured: isConfigured(id),
  }));
}
