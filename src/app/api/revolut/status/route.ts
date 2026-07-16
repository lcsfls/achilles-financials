import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { getRequisitionStatus } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasCreds = Boolean(getSetting("gc_secret_id") && getSetting("gc_secret_key"));
  if (!hasCreds) {
    return NextResponse.json({ hasCreds: false, status: null, accounts: 0, lastSync: null });
  }
  try {
    const status = await getRequisitionStatus();
    if (status?.status === "LN") {
      const { setSetting } = await import("@/lib/db");
      setSetting("gc_requisition_status", "linked");
    }
    return NextResponse.json({
      hasCreds: true,
      status: status?.status ?? null,
      accounts: status?.accounts.length ?? 0,
      lastSync: getSetting("gc_last_sync"),
    });
  } catch (e) {
    return NextResponse.json({ hasCreds: true, status: null, accounts: 0, lastSync: getSetting("gc_last_sync"), error: e instanceof Error ? e.message : "Fehler" });
  }
}
