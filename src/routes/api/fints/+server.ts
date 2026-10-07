import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { deleteSetting, getSetting, setSetting } from "$lib/server/db";
import { FinTsError, listAccounts } from "$lib/server/fints";


export async function GET() {
  const pin = getSetting("fints_pin");
  return json({
    url: getSetting("fints_url") ?? "",
    blz: getSetting("fints_blz") ?? "",
    user: getSetting("fints_user") ?? "",
    // PIN nie zurückgeben, nur ob eine hinterlegt ist
    pinSet: Boolean(pin),
    productId: getSetting("fints_product_id") ?? "",
    lastSync: getSetting("fints_last_sync"),
  });
}

export async function POST({ request: req }: RequestEvent) {
  const { url, blz, user, pin, productId } = await req.json();

  if (url !== undefined) {
    const v = String(url).trim();
    if (v && !/^https:\/\//.test(v)) {
      return json({ error: "Die FinTS-URL muss mit https:// beginnen." }, { status: 400 });
    }
    setSetting("fints_url", v);
  }
  if (blz !== undefined) {
    const v = String(blz).trim();
    if (v && !/^\d{8}$/.test(v)) {
      return json({ error: "Die Bankleitzahl besteht aus genau 8 Ziffern." }, { status: 400 });
    }
    setSetting("fints_blz", v);
  }
  if (user !== undefined) setSetting("fints_user", String(user).trim());
  if (pin) setSetting("fints_pin", String(pin));
  if (productId !== undefined) setSetting("fints_product_id", String(productId).trim());

  return json({ ok: true });
}

/** Verbindung prüfen, ohne Daten zu schreiben. */
export async function PUT() {
  try {
    const accounts = await listAccounts();
    return json({ ok: true, accounts });
  } catch (e) {
    const msg = e instanceof FinTsError ? e.message : "Verbindungstest fehlgeschlagen";
    return json({ error: msg, needsTan: e instanceof FinTsError && e.needsTan }, { status: 400 });
  }
}

export async function DELETE() {
  for (const k of ["fints_url", "fints_blz", "fints_user", "fints_pin", "fints_product_id", "fints_last_sync"]) {
    deleteSetting(k);
  }
  return json({ ok: true });
}
