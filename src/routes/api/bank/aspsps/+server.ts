import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getSetting } from "$lib/server/db";
import { listAspsps } from "$lib/server/enablebanking";

import { isEnabled } from "$lib/server/integrations";


/** Banken eines Landes für die Auswahl auf der Verbinden-Seite. */
export async function GET({ request: req }: RequestEvent) {
  if (!isEnabled("enablebanking")) {
    return json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  const country = (new URL(req.url).searchParams.get("country") || getSetting("eb_country") || "DE").toUpperCase();
  try {
    const aspsps = await listAspsps(country);
    // Das sandbox-Feld setzt Enable Banking nur in der Sandbox-Umgebung. Taucht
    // es auf, läuft die App gegen die Sandbox — dann fehlen echte Banken wie
    // Revolut, und das soll die Oberfläche sagen statt es zu verschweigen.
    const sandbox = aspsps.some((a) => a.sandbox !== undefined);
    return json({ country, aspsps, sandbox });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Banken konnten nicht geladen werden" }, { status: 500 });
  }
}
