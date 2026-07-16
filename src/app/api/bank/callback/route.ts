import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db";
import { completeAuth } from "@/lib/enablebanking";

export const dynamic = "force-dynamic";

/**
 * Redirect-Ziel nach der Autorisierung in der Banking-App.
 * Anders als bei GoCardless muss die Session hier selbst eingelöst werden:
 * der `code` aus der Query wird gegen eine Session getauscht.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = process.env.APP_URL || url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? undefined;
  const error = url.searchParams.get("error");

  if (error || !code) {
    setSetting("eb_auth_status", "error");
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent(error || "no_code")}`);
  }

  try {
    await completeAuth(code, state);
    return NextResponse.redirect(`${origin}/connect?linked=1`);
  } catch (e) {
    setSetting("eb_auth_status", "error");
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
}
