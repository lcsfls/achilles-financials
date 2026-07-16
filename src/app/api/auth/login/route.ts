import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authEnabled, createSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authEnabled()) return NextResponse.json({ error: "Login ist nicht eingerichtet." }, { status: 400 });

  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Benutzername und Passwort erforderlich" }, { status: 400 });
  }

  if (!verifyPassword(String(username), String(password))) {
    // Bewusst nicht verraten, welches der beiden falsch war
    return NextResponse.json({ error: "Benutzername oder Passwort ist falsch." }, { status: 401 });
  }

  const session = createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
    // secure nur bei HTTPS — im LAN läuft es oft über http, sonst käme das
    // Cookie nie an und der Login schiene grundlos fehlzuschlagen.
    secure: req.nextUrl.protocol === "https:",
  });
  return res;
}
