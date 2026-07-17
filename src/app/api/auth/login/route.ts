import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE, authEnabled, createSession, loginLockSeconds, noteLoginFailure, noteLoginSuccess, verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authEnabled()) return NextResponse.json({ error: "Login ist nicht eingerichtet." }, { status: 400 });

  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Benutzername und Passwort erforderlich" }, { status: 400 });
  }

  // Nach Herkunft sperren, nicht nach Benutzername: Sonst könnte ein Fremder
  // den echten Nutzer aussperren, indem er dessen Namen falsch durchprobiert.
  const who = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "direkt";
  const lock = loginLockSeconds(who);
  if (lock > 0) {
    return NextResponse.json({ error: "Zu viele Fehlversuche. Bitte {n} Sekunden warten.", seconds: lock }, { status: 429 });
  }

  if (!verifyPassword(String(username), String(password))) {
    noteLoginFailure(who);
    // Bewusst nicht verraten, welches der beiden falsch war
    return NextResponse.json({ error: "Benutzername oder Passwort ist falsch." }, { status: 401 });
  }
  noteLoginSuccess(who);

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
