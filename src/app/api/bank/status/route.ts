import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { getSessionStatus } from "@/lib/enablebanking";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasCreds = Boolean(getSetting("eb_app_id") && getSetting("eb_private_key"));
  const base = {
    hasCreds,
    aspsp: getSetting("eb_aspsp_name"),
    country: getSetting("eb_country") || "DE",
    lastSync: getSetting("eb_last_sync"),
    linkedAt: getSetting("eb_linked_at"),
  };

  if (!hasCreds) return NextResponse.json({ ...base, status: null, accounts: 0 });

  try {
    const session = await getSessionStatus();
    return NextResponse.json({ ...base, status: session?.status ?? null, accounts: session?.accounts ?? 0 });
  } catch (e) {
    return NextResponse.json({ ...base, status: null, accounts: 0, error: e instanceof Error ? e.message : "Fehler" });
  }
}
