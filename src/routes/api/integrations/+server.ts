import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getIntegrations, setEnabled, type IntegrationId } from "$lib/server/integrations";


export async function GET() {
  return json({ integrations: getIntegrations() });
}

export async function POST({ request: req }: RequestEvent) {
  const { id, enabled } = await req.json();
  if (id !== "enablebanking" && id !== "fints") {
    return json({ error: "Unbekannte Integration" }, { status: 400 });
  }
  setEnabled(id as IntegrationId, Boolean(enabled));
  return json({ ok: true });
}
