import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Redirect-Ziel nach der Autorisierung in der Revolut-App / im Browser. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  setSetting("gc_requisition_status", error ? "error" : "linked");
  const origin = process.env.APP_URL || url.origin;
  return NextResponse.redirect(`${origin}/connect?${error ? "error=1" : "linked=1"}`);
}
