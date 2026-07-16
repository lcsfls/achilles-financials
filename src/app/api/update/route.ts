import { NextResponse } from "next/server";
import {
  BRANCH, REPO, fetchBehind, fetchRemoteHead, getUpdateStatus, getVersion, requestUpdate, updatesAvailable,
} from "@/lib/version";

export const dynamic = "force-dynamic";

/** Versions- und Update-Status inkl. Prüfung gegen GitHub. */
export async function GET() {
  const version = getVersion();
  const status = getUpdateStatus();
  const canUpdate = updatesAvailable();

  const remote = await fetchRemoteHead();
  let behind: { count: number; commits: string[] } | null = null;
  if (remote && version.sha && remote.sha !== version.sha) {
    behind = await fetchBehind(version.sha, remote.sha);
  }

  const upToDate = Boolean(remote && version.sha && remote.sha === version.sha);

  return NextResponse.json({
    repo: REPO,
    branch: BRANCH,
    version,
    status,
    canUpdate,
    remote: remote ? { sha: remote.sha, shortSha: remote.sha.slice(0, 7), date: remote.date, message: remote.message } : null,
    behind,
    upToDate,
    // Fallback, wenn der Control-Kanal nicht gemountet ist
    shellCommand: `cd /opt/achilles-financials && ./deploy/update.sh`,
  });
}

/** Update anstoßen — der Host-Watcher übernimmt den eigentlichen Rebuild. */
export async function POST() {
  if (!updatesAvailable()) {
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
