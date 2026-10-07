import { json } from "@sveltejs/kit";
import { FinTsError, syncHoldings } from "$lib/server/fints";
import { PositionError } from "$lib/server/positions";
import { isConfigured, isEnabled } from "$lib/server/integrations";


/** Depotbestände über FinTS abrufen und ins Depot übernehmen. */
export async function POST() {
  if (!isEnabled("fints") || !isConfigured("fints")) {
    return json(
      { error: "Die FinTS-Integration ist nicht aktiviert oder nicht vollständig eingerichtet. Siehe Einstellungen → Integrationen." },
      { status: 400 }
    );
  }

  try {
    return json(await syncHoldings());
  } catch (e) {
    if (e instanceof FinTsError || e instanceof PositionError) {
      return json({ error: e.message }, { status: 400 });
    }
    return json({ error: "Der Depotabruf ist fehlgeschlagen." }, { status: 500 });
  }
}

/** Ob der Abruf angeboten werden kann — die Oberfläche blendet ihn sonst aus. */
export async function GET() {
  return json({ available: isEnabled("fints") && isConfigured("fints") });
}
