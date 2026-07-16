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

/** Ist der Control-Kanal gemountet und beschreibbar? Nur dann kann die App updaten. */
export function updatesAvailable(): boolean {
  try {
    fs.accessSync(CONTROL_DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
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
  fs.writeFileSync(path.join(CONTROL_DIR, "update-requested"), new Date().toISOString());
  fs.writeFileSync(
    path.join(CONTROL_DIR, "update-status.json"),
    JSON.stringify({ state: "requested", startedAt: new Date().toISOString() } satisfies UpdateStatus)
  );
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
