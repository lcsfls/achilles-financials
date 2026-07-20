import { NextRequest, NextResponse } from "next/server";
import { searchInstruments } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ hits: [] });
  try {
    return NextResponse.json({ hits: await searchInstruments(q) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, hits: [] }, { status: 502 });
  }
}
