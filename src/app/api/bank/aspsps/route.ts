import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { listAspsps } from "@/lib/enablebanking";

export const dynamic = "force-dynamic";

/** Banken eines Landes für die Auswahl auf der Verbinden-Seite. */
export async function GET(req: NextRequest) {
  const country = (new URL(req.url).searchParams.get("country") || getSetting("eb_country") || "DE").toUpperCase();
  try {
    const aspsps = await listAspsps(country);
    return NextResponse.json({ country, aspsps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Banken konnten nicht geladen werden" }, { status: 500 });
  }
}
