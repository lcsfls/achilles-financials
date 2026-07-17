import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { isSupported, ratesFromEur } from "@/lib/currency";

export const dynamic = "force-dynamic";

/** Anzeigewährung + Umrechnungskurse ab EUR für die Oberfläche. */
export async function GET() {
  const configured = getSetting("display_currency");
  const currency = configured && isSupported(configured) ? configured : "EUR";
  const rates = await ratesFromEur();

  return NextResponse.json({
    currency,
    rate: rates[currency] ?? 1,
    // USD wird immer zusätzlich angezeigt — außer es ist schon die Hauptwährung
    usdRate: rates.USD ?? null,
    rates,
  });
}
