import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { listAspsps } from "@/lib/enablebanking";

import { isEnabled } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/** Banken eines Landes für die Auswahl auf der Verbinden-Seite. */
export async function GET(req: NextRequest) {
  if (!isEnabled("enablebanking")) {
    return NextResponse.json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  const country = (new URL(req.url).searchParams.get("country") || getSetting("eb_country") || "DE").toUpperCase();
  try {
    const aspsps = await listAspsps(country);
    // Das sandbox-Feld setzt Enable Banking nur in der Sandbox-Umgebung. Taucht
    // es auf, läuft die App gegen die Sandbox — dann fehlen echte Banken wie
    // Revolut, und das soll die Oberfläche sagen statt es zu verschweigen.
    const sandbox = aspsps.some((a) => a.sandbox !== undefined);
    return NextResponse.json({ country, aspsps, sandbox });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Banken konnten nicht geladen werden" }, { status: 500 });
  }
}
