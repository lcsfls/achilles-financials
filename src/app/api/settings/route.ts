import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { authEnabled, disableAuth, getUsername, setCredentials, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const appId = getSetting("eb_app_id");
  return NextResponse.json({
    ebConfigured: Boolean(appId && getSetting("eb_private_key")),
    ebAppIdMasked: appId ? `${appId.slice(0, 8)}…` : null,
    country: getSetting("eb_country") || "DE",
    demoMode: getSetting("demo_mode") === "1",
    language: getSetting("language") || "de",
    setupDone: getSetting("setup_done") === "1",
    authEnabled: authEnabled(),
    authUser: getUsername(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ebAppId, ebPrivateKey, country, language, setupDone } = body;

  // Login einrichten / ändern / abschalten
  if (body.auth !== undefined) {
    const { username, password, currentPassword, disable } = body.auth ?? {};

    // Ist schon ein Login aktiv, muss das alte Passwort stimmen — sonst könnte
    // jeder mit offener Sitzung die Zugangsdaten überschreiben.
    if (authEnabled()) {
      const user = getUsername() ?? "";
      if (!currentPassword || !verifyPassword(user, String(currentPassword))) {
        return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 403 });
      }
    }

    if (disable) {
      disableAuth();
      return NextResponse.json({ ok: true });
    }

    if (!username?.trim() || !password) {
      return NextResponse.json({ error: "Benutzername und Passwort erforderlich" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
    }
    setCredentials(String(username), String(password));
    return NextResponse.json({ ok: true });
  }

  if (ebAppId) setSetting("eb_app_id", String(ebAppId).trim());
  if (ebPrivateKey) {
    const key = String(ebPrivateKey).trim();
    // Früh prüfen — sonst scheitert erst der erste API-Call mit kryptischem Fehler
    if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) {
      return NextResponse.json(
        { error: "Das sieht nicht nach einem Private Key aus. Erwartet wird der Inhalt der .pem-Datei inklusive der BEGIN/END-Zeilen." },
        { status: 400 }
      );
    }
    setSetting("eb_private_key", key);
  }
  if (country) setSetting("eb_country", String(country).trim().toUpperCase());
  if (language === "de" || language === "en") setSetting("language", language);
  if (setupDone === true) setSetting("setup_done", "1");

  return NextResponse.json({ ok: true });
}
