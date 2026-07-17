import { NextRequest, NextResponse } from "next/server";
import { deleteSetting, getSetting, setSetting } from "@/lib/db";
import { FinTsError, listAccounts } from "@/lib/fints";

export const dynamic = "force-dynamic";

export async function GET() {
  const pin = getSetting("fints_pin");
  return NextResponse.json({
    url: getSetting("fints_url") ?? "",
    blz: getSetting("fints_blz") ?? "",
    user: getSetting("fints_user") ?? "",
    // PIN nie zurückgeben, nur ob eine hinterlegt ist
    pinSet: Boolean(pin),
    productId: getSetting("fints_product_id") ?? "",
    lastSync: getSetting("fints_last_sync"),
  });
}

export async function POST(req: NextRequest) {
  const { url, blz, user, pin, productId } = await req.json();

  if (url !== undefined) {
    const v = String(url).trim();
    if (v && !/^https:\/\//.test(v)) {
      return NextResponse.json({ error: "Die FinTS-URL muss mit https:// beginnen." }, { status: 400 });
    }
    setSetting("fints_url", v);
  }
  if (blz !== undefined) {
    const v = String(blz).trim();
    if (v && !/^\d{8}$/.test(v)) {
      return NextResponse.json({ error: "Die Bankleitzahl besteht aus genau 8 Ziffern." }, { status: 400 });
    }
    setSetting("fints_blz", v);
  }
  if (user !== undefined) setSetting("fints_user", String(user).trim());
  if (pin) setSetting("fints_pin", String(pin));
  if (productId !== undefined) setSetting("fints_product_id", String(productId).trim());

  return NextResponse.json({ ok: true });
}

/** Verbindung prüfen, ohne Daten zu schreiben. */
export async function PUT() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    const msg = e instanceof FinTsError ? e.message : "Verbindungstest fehlgeschlagen";
    return NextResponse.json({ error: msg, needsTan: e instanceof FinTsError && e.needsTan }, { status: 400 });
  }
}

export async function DELETE() {
  for (const k of ["fints_url", "fints_blz", "fints_user", "fints_pin", "fints_product_id", "fints_last_sync"]) {
    deleteSetting(k);
  }
  return NextResponse.json({ ok: true });
}
