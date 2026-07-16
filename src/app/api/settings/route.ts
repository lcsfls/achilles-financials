import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const secretId = getSetting("gc_secret_id");
  return NextResponse.json({
    gcConfigured: Boolean(secretId && getSetting("gc_secret_key")),
    gcSecretIdMasked: secretId ? `${secretId.slice(0, 8)}…` : null,
    country: getSetting("gc_country") || "DE",
    demoMode: getSetting("demo_mode") === "1",
    language: getSetting("language") || "de",
    setupDone: getSetting("setup_done") === "1",
  });
}

export async function POST(req: NextRequest) {
  const { gcSecretId, gcSecretKey, country, language, setupDone } = await req.json();
  if (gcSecretId) setSetting("gc_secret_id", String(gcSecretId).trim());
  if (gcSecretKey) setSetting("gc_secret_key", String(gcSecretKey).trim());
  if (country) setSetting("gc_country", String(country).trim().toUpperCase());
  if (language === "de" || language === "en") setSetting("language", language);
  if (setupDone === true) setSetting("setup_done", "1");
  // Token-Cache invalidieren, falls neue Credentials
  if (gcSecretId || gcSecretKey) {
    setSetting("gc_access_expiry", "0");
  }
  return NextResponse.json({ ok: true });
}
