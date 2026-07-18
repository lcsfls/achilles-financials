import { NextRequest, NextResponse } from "next/server";
import { deleteSetting, getSetting, setSetting } from "@/lib/db";
import { SESSION_COOKIE, authEnabled, createSession, disableAuth, getUsername, setCredentials, verifyPassword } from "@/lib/auth";
import { callbackUrl, publicOrigin, validateAppUrl } from "@/lib/app-url";
import { isSupported } from "@/lib/currency";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appId = getSetting("eb_app_id");
  return NextResponse.json({
    ebConfigured: Boolean(appId && getSetting("eb_private_key")),
    ebAppIdMasked: appId ? `${appId.slice(0, 8)}…` : null,
    country: getSetting("eb_country") || "DE",
    demoMode: getSetting("demo_mode") === "1",
    language: getSetting("language") || "de",
    displayCurrency: getSetting("display_currency") || "EUR",
    loansInNetWorth: getSetting("loans_in_networth") || "none",
    propertyInNetWorth: getSetting("property_in_networth") || "include",
    setupDone: getSetting("setup_done") === "1",
    authEnabled: authEnabled(),
    authUser: getUsername(),
    // Die tatsächlich verwendete Adresse — nicht window.location, sonst zeigt
    // die Oberfläche hinter einem Proxy etwas anderes an, als verschickt wird.
    appUrl: getSetting("app_url") ?? "",
    appUrlSource: getSetting("app_url") ? "setting" : process.env.APP_URL ? "env" : "request",
    effectiveOrigin: publicOrigin(req.url),
    callbackUrl: callbackUrl(req.url),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ebAppId, ebPrivateKey, country, language, setupDone } = body;

  // Anzeigewährung — nur bekannte Codes, sonst wirft Intl.NumberFormat später
  // auf jeder Seite und das Dashboard bliebe leer.
  if (typeof body.display_currency === "string" && isSupported(body.display_currency)) {
    setSetting("display_currency", body.display_currency);
  }

  // Nur bekannte Werte — ein Tippfehler würde sonst still zu "nicht einbeziehen"
  if (["none", "borrowed", "both"].includes(body.loans_in_networth)) {
    setSetting("loans_in_networth", body.loans_in_networth);
  }
  if (["include", "exclude"].includes(body.property_in_networth)) {
    setSetting("property_in_networth", body.property_in_networth);
  }

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

    // Sofort anmelden, wer gerade das Passwort gesetzt hat.
    //
    // Ohne das sperrt man sich mit dem eigenen Klick aus: setCredentials
    // schaltet den Login ein und wechselt das Sitzungsgeheimnis, der Browser
    // hat aber noch gar kein (bzw. kein gültiges) Cookie. Jeder folgende
    // Request lief danach in den 401 der Middleware — die Seite bekam
    // {error:…} statt der Einstellungen und stürzte beim Rendern ab.
    const session = createSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
      secure: req.nextUrl.protocol === "https:",
    });
    return res;
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
  if (body.appUrl !== undefined) {
    const raw = String(body.appUrl).trim();
    if (raw === "") {
      deleteSetting("app_url");
    } else {
      const check = validateAppUrl(raw);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      setSetting("app_url", check.url);
    }
  }
  if (country) setSetting("eb_country", String(country).trim().toUpperCase());
  if (language === "de" || language === "en") setSetting("language", language);
  if (setupDone === true) setSetting("setup_done", "1");

  return NextResponse.json({ ok: true });
}
