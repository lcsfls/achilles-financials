import { NextResponse } from "next/server";
import { FinTsError, syncHoldings } from "@/lib/fints";
import { PositionError } from "@/lib/positions";
import { isConfigured, isEnabled } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/** Depotbestände über FinTS abrufen und ins Depot übernehmen. */
export async function POST() {
  if (!isEnabled("fints") || !isConfigured("fints")) {
    return NextResponse.json(
      { error: "Die FinTS-Integration ist nicht aktiviert oder nicht vollständig eingerichtet. Siehe Einstellungen → Integrationen." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await syncHoldings());
  } catch (e) {
    if (e instanceof FinTsError || e instanceof PositionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Der Depotabruf ist fehlgeschlagen." }, { status: 500 });
  }
}

/** Ob der Abruf angeboten werden kann — die Oberfläche blendet ihn sonst aus. */
export async function GET() {
  return NextResponse.json({ available: isEnabled("fints") && isConfigured("fints") });
}
