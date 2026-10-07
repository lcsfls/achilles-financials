import { json } from "@sveltejs/kit";
import { syncAccounts } from "$lib/server/enablebanking";

import { isEnabled } from "$lib/server/integrations";


export async function POST() {
  if (!isEnabled("enablebanking")) {
    return json({ error: "Die Enable-Banking-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const result = await syncAccounts();
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Sync fehlgeschlagen" }, { status: 500 });
  }
}
