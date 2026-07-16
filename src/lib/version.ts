import fs from "fs";
import path from "path";

/**
 * Update-Kanal zwischen App-Container und Host.
 *
 * Der Host bind-mountet ./control nach /control. Die App schreibt dort eine
 * Update-Anforderung; ein systemd-Path-Unit auf dem Host startet daraufhin
 * deploy/update.sh, das den Status zurückschreibt. So braucht die App weder
 * den Docker-Socket noch Git im Image.
 */
const CONTROL_DIR = process.env.CONTROL_DIR || "/control";

export const REPO = process.env.REPO_SLUG || "lcsfls/achilles-financials";
export const BRANCH = process.env.REPO_BRANCH || "main";

export type Version = { sha: string | null; shortSha: string | null; deployedAt: string | null; branch: string };
export type UpdateState = "idle" | "requested" | "running" | "success" | "error";
export type UpdateStatus = {
  state: UpdateState;
  startedAt?: string;
  finishedAt?: string;
  fromSha?: string;
  toSha?: string;
  message?: string;
  log?: string;
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR, file), "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Ist der Control-Kanal gemountet und wirklich beschreibbar?
 *
 * Das Verzeichnis allein zu prüfen genügt nicht: update.sh läuft als root und
 * hinterlässt root-eigene Dateien. Dann ist das Verzeichnis schreibbar, die
 * Statusdatei aber nicht — und der Schreibversuch scheitert erst beim Klick.
 */
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

/** Ein-Zeilen-Reparatur für den Rechtefall, passend zum Installationspfad. */
export const FIX_PERMISSIONS_COMMAND = "chown -R 1001:1001 /opt/achilles-financials/control";

/** Erklärt den Rechtefehler statt ihn roh durchzureichen. */
export class ControlWriteError extends Error {
  constructor(cause: NodeJS.ErrnoException) {
    super(
      cause.code === "EACCES" || cause.code === "EPERM"
        ? `Keine Schreibrechte im Control-Verzeichnis (${cause.path ?? CONTROL_DIR}). ` +
          `Die Dateien gehören root, die App läuft als uid 1001. Einmalig auf dem Host reparieren: ` +
          `chown -R 1001:1001 /opt/achilles-financials/control`
        : `Update konnte nicht angefordert werden: ${cause.message}`
    );
  }
}

export function getVersion(): Version {
  const v = readJson<{ sha?: string; deployedAt?: string; branch?: string }>("version.json");
  const sha = v?.sha ?? process.env.GIT_SHA ?? null;
  return {
    sha,
    shortSha: sha ? sha.slice(0, 7) : null,
    deployedAt: v?.deployedAt ?? null,
    branch: v?.branch ?? BRANCH,
  };
}

export function getUpdateStatus(): UpdateStatus {
  return readJson<UpdateStatus>("update-status.json") ?? { state: "idle" };
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

/** Neueste Commits auf dem Branch — ohne Token (60 Requests/h pro IP genügen). */
export async function fetchRemoteHead(): Promise<{ sha: string; date: string | null; message: string | null } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "achilles-financials" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      sha: data.sha,
      date: data.commit?.committer?.date ?? null,
      message: (data.commit?.message ?? "").split("\n")[0] || null,
    };
  } catch {
    return null;
  }
}

/** Wie viele Commits liegt die lokale Version zurück (+ deren Titel)? */
export async function fetchBehind(localSha: string, remoteSha: string): Promise<{ count: number; commits: string[] } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/compare/${localSha}...${remoteSha}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "achilles-financials" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      count: data.ahead_by ?? 0,
      commits: (data.commits ?? [])
        .map((c: { commit: { message: string } }) => c.commit.message.split("\n")[0])
        .reverse()
        .slice(0, 10),
    };
  } catch {
    return null;
  }
}
