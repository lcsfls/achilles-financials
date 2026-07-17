import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/quotes";

export const dynamic = "force-dynamic";

/** Kursverlauf für den Hover-Chart der Watchlist. */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const symbol = params.get("symbol");
  const range = params.get("range") ?? "6mo";
  if (!symbol) return NextResponse.json({ error: "symbol erforderlich" }, { status: 400 });

  const data = await getHistory(symbol, range);
  if (!data) return NextResponse.json({ error: "Kein Verlauf verfügbar" }, { status: 404 });
  return NextResponse.json({ symbol, range, points: data });
}
