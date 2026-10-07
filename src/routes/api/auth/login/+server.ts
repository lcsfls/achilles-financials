import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import {
  SESSION_COOKIE, authEnabled, createSession, loginLockSeconds, noteLoginFailure, noteLoginSuccess, verifyPassword,
} from "$lib/server/auth";


export async function POST({ request: req, cookies, url }: RequestEvent) {
  if (!authEnabled()) return json({ error: "Login ist nicht eingerichtet." }, { status: 400 });

  const { username, password } = await req.json();
  if (!username || !password) {
    return json({ error: "Benutzername und Passwort erforderlich" }, { status: 400 });
  }

  // Nach Herkunft sperren, nicht nach Benutzername: Sonst könnte ein Fremder
  // den echten Nutzer aussperren, indem er dessen Namen falsch durchprobiert.
  const who = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "direkt";
  const lock = loginLockSeconds(who);
  if (lock > 0) {
    return json({ error: "Zu viele Fehlversuche. Bitte {n} Sekunden warten.", seconds: lock }, { status: 429 });
  }

  if (!verifyPassword(String(username), String(password))) {
    noteLoginFailure(who);
    // Bewusst nicht verraten, welches der beiden falsch war
    return json({ error: "Benutzername oder Passwort ist falsch." }, { status: 401 });
  }
  noteLoginSuccess(who);

  const session = createSession();
  cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
    // secure nur bei HTTPS — im LAN läuft es oft über http, sonst käme das
    // Cookie nie an und der Login schiene grundlos fehlzuschlagen.
    secure: url.protocol === "https:",
  });
  return json({ ok: true });
}
