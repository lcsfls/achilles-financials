import { NextResponse } from "next/server";
import { FinTsError, syncAccounts } from "@/lib/fints";
import { isEnabled } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isEnabled("fints")) {
    return NextResponse.json({ error: "Die FinTS-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const result = await syncAccounts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof FinTsError ? e.message : "Sync fehlgeschlagen";
    return NextResponse.json({ error: msg, needsTan: e instanceof FinTsError && e.needsTan }, { status: 400 });
  }
}
