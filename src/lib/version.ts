import fs from "fs";
import path from "path";

/**
 * Update-Kanal zwischen App-Container und Host.
 *
 * Der Host bind-mountet ./control nach /control. Die App schreibt dort eine
 * Update-Anforderung; ein systemd-Path-Unit auf dem Host startet daraufhin
 * deploy/update.sh, das den Status zurückschreibt. So braucht die App weder
 * den Docker-Socket noch Git im Image.
 *
 * Versionen: Maßgeblich sind Git-Tags (v1.2.3), nicht einzelne Commits — ein
 * Commit-Hash sagt niemandem, ob sich ein Update lohnt.
 */
const CONTROL_DIR = process.env.CONTROL_DIR || "/control";

export const REPO = process.env.REPO_SLUG || "lcsfls/achilles-financials";
export const BRANCH = process.env.REPO_BRANCH || "main";

export type Version = { version: string | null; sha: string | null; shortSha: string | null; deployedAt: string | null; branch: string };
export type UpdateState = "idle" | "requested" | "running" | "success" | "error";
export type UpdateStatus = {
  state: UpdateState;
  startedAt?: string;
  finishedAt?: string;
  fromSha?: string;
  toSha?: string;
  message?: string;
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR, file), "utf8")) as T;
  } catch {
    return null;
  }
}

export type ControlState = "ok" | "missing" | "readonly";

/**
 * Warum genau kann die App nicht updaten? "fehlt" und "keine Rechte" brauchen
 * völlig verschiedene Hilfestellungen — die Unterscheidung gehört hierher und
 * nicht in eine Sammelmeldung.
 */
export function controlState(): ControlState {
  if (!fs.existsSync(CONTROL_DIR)) return "missing";
  try {
    fs.accessSync(CONTROL_DIR, fs.constants.W_OK);
  } catch {
    return "readonly";
  }
  for (const file of ["update-status.json", "update-requested"]) {
    const p = path.join(CONTROL_DIR, file);
    try {
      fs.accessSync(p, fs.constants.W_OK);
    } catch (e) {
      // Nicht vorhanden ist in Ordnung — die legen wir an. Vorhanden und nicht
      // beschreibbar heißt: root hat sie angelegt.
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") return "readonly";
    }
  }
  return "ok";
}

export function updatesAvailable(): boolean {
  return controlState() === "ok";
}

/**
 * Reparatur für den Rechtefall — bewusst in der pct-exec-Form.
 * "Auf dem Host ausführen" war missverständlich: Gemeint ist die Proxmox-Shell,
 * nicht der Container. Von dort braucht es kein Container-Passwort.
 */
export const FIX_PERMISSIONS_COMMAND =
  "pct exec <CTID> -- chown -R 1001:1001 /opt/achilles-financials/control";

/** Erklärt den Rechtefehler statt ihn roh durchzureichen. */
export class ControlWriteError extends Error {
  constructor(cause: NodeJS.ErrnoException) {
    super(
      cause.code === "EACCES" || cause.code === "EPERM"
        ? `Keine Schreibrechte im Control-Verzeichnis (${cause.path ?? CONTROL_DIR}). ` +
          `Die Dateien gehören root, die App läuft als uid 1001. Einmalig in der Proxmox-Shell ` +
          `reparieren (kein Container-Passwort nötig): ${FIX_PERMISSIONS_COMMAND}`
        : `Update konnte nicht angefordert werden: ${cause.message}`
    );
  }
}

export function getVersion(): Version {
  const v = readJson<{ version?: string; sha?: string; deployedAt?: string; branch?: string }>("version.json");
  const sha = v?.sha ?? process.env.GIT_SHA ?? null;
  return {
    // APP_VERSION wird beim Image-Build aus package.json gesetzt und ist da,
    // auch wenn der Control-Kanal fehlt (z. B. plain Docker).
    version: v?.version ?? process.env.APP_VERSION ?? null,
    sha,
    shortSha: sha ? sha.slice(0, 7) : null,
    deployedAt: v?.deployedAt ?? null,
    branch: v?.branch ?? BRANCH,
  };
}

export function getUpdateStatus(): UpdateStatus {
  return readJson<UpdateStatus>("update-status.json") ?? { state: "idle" };
}

/**
 * Letzte Zeilen aus update.log — damit im Dialog steht, was der Build gerade
 * tut, statt nur "läuft". Docker-Build-Logs werden lang, deshalb nur der Tail.
 */
export function getUpdateLog(lines = 40): string | null {
  try {
    const raw = fs.readFileSync(path.join(CONTROL_DIR, "update.log"), "utf8");
    return raw.split("\n").filter(Boolean).slice(-lines).join("\n") || null;
  } catch {
    return null;
  }
}

export function requestUpdate(): void {
  try {
    fs.writeFileSync(
      path.join(CONTROL_DIR, "update-status.json"),
      JSON.stringify({ state: "requested", startedAt: new Date().toISOString() } satisfies UpdateStatus)
    );
    // Flag zuletzt: Der Watcher startet, sobald es existiert — der Status soll
    // dann schon stimmen.
    fs.writeFileSync(path.join(CONTROL_DIR, "update-requested"), new Date().toISOString());
  } catch (e) {
    throw new ControlWriteError(e as NodeJS.ErrnoException);
  }
}

/* ---------- Versionsvergleich über Tags ---------- */

export type Semver = { major: number; minor: number; patch: number };

export function parseSemver(input: string | null | undefined): Semver | null {
  if (!input) return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(input.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemver(a: Semver, b: Semver): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export type Release = { version: string; tag: string; sha: string; notes: string | null; publishedAt: string | null };

/**
 * GitHub erlaubt ohne Token 60 Anfragen pro Stunde und IP. Der Update-Dialog
 * pollt im Sekundentakt — ohne Cache wäre das Limit nach zwei Minuten leer und
 * die Versionsprüfung für den Rest der Stunde tot.
 */
let releaseCache: { at: number; value: Release | null } | null = null;
const RELEASE_TTL_MS = 10 * 60 * 1000;

/**
 * Neueste veröffentlichte Version — die höchste aus Releases UND Tags.
 *
 * Beide Quellen zählen gleichberechtigt, weil ein Tag auch ohne zugehörige
 * GitHub-Release eine veröffentlichte Version ist. Notes gibt es dann keine,
 * die Version ist aber vorhanden und installierbar.
 */
export async function fetchLatestRelease(force = false): Promise<Release | null> {
  if (!force && releaseCache && Date.now() - releaseCache.at < RELEASE_TTL_MS) {
    return releaseCache.value;
  }
  const value = await fetchLatestReleaseUncached();
  // Auch ein Fehlschlag wird gecacht — sonst rennt jeder Poll erneut ins Limit.
  releaseCache = { at: Date.now(), value };
  return value;
}

async function fetchLatestReleaseUncached(): Promise<Release | null> {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "achilles-financials" };

  const [release, tag] = await Promise.all([fetchLatestGithubRelease(headers), fetchHighestTag(headers)]);

  // Die höhere Version gewinnt, gleich aus welcher Quelle.
  //
  // Vorher galt releases/latest bedingungslos: Wurde eine Version nur getaggt,
  // ohne auf GitHub eine Release anzulegen, meldete die App die ältere Release
  // als "neueste" — und damit "alles aktuell". Der Update-Button verschwand,
  // obwohl neuere Tags längst da waren.
  if (release && tag) {
    const rv = parseSemver(release.version);
    const tv = parseSemver(tag.version);
    if (rv && tv) return compareSemver(tv, rv) > 0 ? tag : release;
  }
  return release ?? tag;
}

async function fetchLatestGithubRelease(headers: Record<string, string>): Promise<Release | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    const version = String(d.tag_name ?? "").replace(/^v/, "");
    if (!parseSemver(version)) return null;
    return {
      version,
      tag: d.tag_name,
      sha: d.target_commitish ?? "",
      notes: d.body || null,
      publishedAt: d.published_at ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchHighestTag(headers: Record<string, string>): Promise<Release | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/tags?per_page=100`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const tags = (await res.json()) as Array<{ name: string; commit: { sha: string } }>;
    const sorted = tags
      .map((t) => ({ tag: t.name, sha: t.commit.sha, sv: parseSemver(t.name) }))
      .filter((t): t is { tag: string; sha: string; sv: Semver } => t.sv !== null)
      .sort((a, b) => compareSemver(b.sv, a.sv));
    if (sorted.length === 0) return null;
    return { version: sorted[0].tag.replace(/^v/, ""), tag: sorted[0].tag, sha: sorted[0].sha, notes: null, publishedAt: null };
  } catch {
    return null;
  }
}
