import { NextRequest, NextResponse } from "next/server";
import { getIntegrations, setEnabled, type IntegrationId } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ integrations: getIntegrations() });
}

export async function POST(req: NextRequest) {
  const { id, enabled } = await req.json();
  if (id !== "enablebanking" && id !== "fints") {
    return NextResponse.json({ error: "Unbekannte Integration" }, { status: 400 });
  }
  setEnabled(id as IntegrationId, Boolean(enabled));
  return NextResponse.json({ ok: true });
}
