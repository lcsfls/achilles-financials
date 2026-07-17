import { NextResponse } from "next/server";
import { syncAccounts } from "@/lib/enablebanking";

import { isEnabled } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isEnabled("enablebanking")) {
    return NextResponse.json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const result = await syncAccounts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync fehlgeschlagen" }, { status: 500 });
  }
}
