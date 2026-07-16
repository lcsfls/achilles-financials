import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySession } from "@/lib/auth";

/**
 * Zentraler Schutz statt einer Prüfung je Route — vergessene Routen sind sonst
 * genau die Lücke. Braucht die Node-Runtime, weil die Sitzung gegen die
 * SQLite-Datenbank geprüft wird.
 */
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function middleware(req: NextRequest) {
  // Solange kein Login eingerichtet ist, bleibt alles offen — sonst könnte man
  // sich nach dem ersten Start selbst aussperren.
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth/") || pathname === "/login") return NextResponse.next();

  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
