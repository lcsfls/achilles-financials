import { json } from "@sveltejs/kit";
import { FinTsError, syncAccounts } from "$lib/server/fints";
import { isEnabled } from "$lib/server/integrations";


export async function POST() {
  if (!isEnabled("fints")) {
    return json({ error: "Die FinTS-Integration ist nicht aktiviert." }, { status: 400 });
  }
  try {
    const result = await syncAccounts();
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof FinTsError ? e.message : "Sync fehlgeschlagen";
    return json({ error: msg, needsTan: e instanceof FinTsError && e.needsTan }, { status: 400 });
  }
}
