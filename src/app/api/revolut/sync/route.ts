import { NextResponse } from "next/server";
import { syncAccounts } from "@/lib/gocardless";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncAccounts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync fehlgeschlagen" }, { status: 500 });
  }
}
