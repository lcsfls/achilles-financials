import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authEnabled, getUsername, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    enabled: authEnabled(),
    username: getUsername(),
    authenticated: !authEnabled() || verifySession(req.cookies.get(SESSION_COOKIE)?.value),
  });
}
