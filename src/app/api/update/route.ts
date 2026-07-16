import { NextResponse } from "next/server";
import {
  BRANCH, FIX_PERMISSIONS_COMMAND, REPO, compareSemver, controlState, fetchLatestRelease,
  getUpdateStatus, getVersion, parseSemver, requestUpdate,
} from "@/lib/version";

export const dynamic = "force-dynamic";

/** Versions- und Update-Status inkl. Prüfung gegen die neueste Release-Version. */
export async function GET() {
  const version = getVersion();
  const status = getUpdateStatus();
  const control = controlState();

  const latest = await fetchLatestRelease();

  const installedSv = parseSemver(version.version);
  const latestSv = parseSemver(latest?.version);

  // Ohne bekannte installierte Version lässt sich nichts vergleichen — dann
  // lieber nichts behaupten, statt fälschlich ein Update anzubieten.
  const updateAvailable =
    installedSv !== null && latestSv !== null ? compareSemver(latestSv, installedSv) > 0 : null;

  return NextResponse.json({
    repo: REPO,
    branch: BRANCH,
    version,
    status,
    canUpdate: control === "ok",
    control,
    fixCommand: control === "readonly" ? FIX_PERMISSIONS_COMMAND : null,
    latest: latest ? { version: latest.version, tag: latest.tag, notes: latest.notes, publishedAt: latest.publishedAt } : null,
    updateAvailable,
    upToDate: updateAvailable === false,
    releasesUrl: `https://github.com/${REPO}/releases`,
    shellCommand: "cd /opt/achilles-financials && ./deploy/update.sh",
  });
}

/** Update anstoßen — der Host-Watcher übernimmt den eigentlichen Rebuild. */
export async function POST() {
  const control = controlState();
  if (control === "readonly") {
    // Der häufigste Fall im Betrieb: update.sh lief als root und hat die
    // Statusdatei root-eigen hinterlassen.
    return NextResponse.json(
      {
        error: "Keine Schreibrechte im Control-Verzeichnis — die Dateien gehören root, die App läuft als uid 1001. Einmalig auf dem Host reparieren:",
        fixCommand: FIX_PERMISSIONS_COMMAND,
      },
      { status: 403 }
    );
  }
  if (control === "missing") {
    return NextResponse.json(
      { error: "In-App-Updates sind nicht eingerichtet (Control-Verzeichnis fehlt). Bitte per Shell aktualisieren." },
      { status: 501 }
    );
  }

  const status = getUpdateStatus();
  if (status.state === "requested" || status.state === "running") {
    return NextResponse.json({ error: "Es läuft bereits ein Update." }, { status: 409 });
  }
  try {
    requestUpdate();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update konnte nicht angefordert werden" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
