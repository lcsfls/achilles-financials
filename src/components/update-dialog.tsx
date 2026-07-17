"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Terminal, PlugZap, Package, GitPullRequest, Hammer, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type UpdateInfo = {
  version: { version: string | null; shortSha: string | null };
  status: { state: "idle" | "requested" | "running" | "success" | "error"; message?: string };
  log: string | null;
  latest: { version: string; tag: string; notes: string | null } | null;
};

/** Grobe Phase aus dem Log ableiten — der Nutzer will wissen, wo es steht. */
type Phase = "waiting" | "fetching" | "building" | "restarting" | "done";

/**
 * Von hinten suchen: Das Log enthält immer auch den Anfang ("update gestartet"),
 * eine Suche über den ganzen Text bliebe deshalb ewig bei "fetching" hängen.
 * Die Marker stammen aus echter `docker compose up --build`-Ausgabe (BuildKit
 * nummeriert Schritte als "#5 [builder 3/6]", nicht als "=> [").
 */
function phaseFromLog(log: string | null, state: string): Phase {
  if (state === "success") return "done";
  if (!log) return "waiting";

  const lines = log.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].toLowerCase();
    if (/container\s+achilles|recreated|\bstarting\b|\bstarted\b|naming to/.test(l)) return "restarting";
    if (/^#\d+\s|\[builder|\[runner|=> \[|\bdone\b\s|exporting to image/.test(l)) return "building";
    if (/update gestartet|from github|fetch_head|head is now at/.test(l)) return "fetching";
  }
  return "waiting";
}

const PHASES: Array<{ key: Phase; label: string; icon: typeof Package }> = [
  { key: "fetching", label: "Version wird geladen", icon: GitPullRequest },
  { key: "building", label: "Container wird gebaut", icon: Hammer },
  { key: "restarting", label: "Neustart", icon: RotateCw },
  { key: "done", label: "Fertig", icon: CheckCircle2 },
];

export function UpdateDialog({
  open, onOpenChange, info, onStarted, onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: UpdateInfo | null;
  onStarted?: () => void;
  onFinished?: () => void;
}) {
  const { t } = useI18n();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<UpdateInfo | null>(null);
  // Während des Rebuilds ist der Container weg — das ist erwartet, kein Fehler
  const [unreachable, setUnreachable] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const current = live ?? info;
  const state = current?.status.state ?? "idle";
  const running = state === "requested" || state === "running";
  const phase = phaseFromLog(current?.log ?? null, state);

  const poll = useCallback(async () => {
    try {
      // statusOnly: der Poll braucht kein GitHub und darf dessen Limit nicht leeren
      const res = await fetch("/api/update?statusOnly=1", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      // latest kommt beim Status-Poll nicht mit — vorhandenen Wert behalten
      setLive((prev) => ({ ...d, latest: d.latest ?? prev?.latest ?? info?.latest ?? null }));
      setUnreachable(false);
    } catch {
      // Verbindung weg = Container startet gerade neu. Erwartbar, nicht melden.
      setUnreachable(true);
    }
  }, []);

  useEffect(() => {
    if (!open || !running) return;
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [open, running, poll]);

  // Log mitscrollen, damit die aktuelle Zeile sichtbar bleibt
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [current?.log]);

  useEffect(() => {
    if (state === "success") onFinished?.();
  }, [state, onFinished]);

  const start = async () => {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/update", { method: "POST" });
    setStarting(false);
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    onStarted?.();
    poll();
  };

  const reset = () => { setLive(null); setError(null); setUnreachable(false); };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Während des Updates nicht wegklickbar — sonst verpasst man das Ergebnis
        if (!o && running) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        {/* Bestätigung */}
        {state === "idle" && (
          <>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-gold" />
              {current?.latest ? t("Auf v{v} aktualisieren", { v: current.latest.version }) : t("Update installieren")}
            </DialogTitle>
            <DialogDescription>
              {t("Der Container wird neu gebaut und startet neu. Deine Daten bleiben unberührt.")}
            </DialogDescription>

            <div className="mt-5 space-y-4">
              <div className="glass-inset flex items-center justify-center gap-4 rounded-xl p-4 text-sm">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Installiert")}</div>
                  <div className="num mt-0.5 font-semibold">v{current?.version.version ?? "?"}</div>
                </div>
                <div className="text-muted-2">→</div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Neu")}</div>
                  <div className="num mt-0.5 font-semibold text-gold-bright">v{current?.latest?.version ?? "?"}</div>
                </div>
              </div>

              {current?.latest?.notes && (
                <div className="glass-inset rounded-xl p-4">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-2">
                    {t("Neu in v{v}", { v: current.latest.version })}
                  </div>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                    {current.latest.notes}
                  </pre>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2.5 text-[11px] leading-relaxed text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("Der Build dauert einige Minuten. Das Dashboard ist zwischendurch kurz nicht erreichbar — dieses Fenster bleibt offen und zeigt den Fortschritt.")}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-3 py-2.5 text-xs text-rose-soft">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={starting}>
                {t("Abbrechen")}
              </Button>
              <Button className="flex-1" onClick={start} disabled={starting}>
                {starting ? t("Starte …") : t("Jetzt aktualisieren")}
              </Button>
            </div>
          </>
        )}

        {/* Läuft */}
        {running && (
          <>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-gold" />
              {t("Update läuft")}
            </DialogTitle>
            <DialogDescription>
              {t("Fenster offen lassen — bei laufendem Build ist das normal.")}
            </DialogDescription>

            <div className="mt-5 space-y-4">
              {/* Phasen */}
              <div className="space-y-2">
                {PHASES.filter((p) => p.key !== "done").map(({ key, label, icon: Icon }) => {
                  const order: Phase[] = ["waiting", "fetching", "building", "restarting", "done"];
                  const done = order.indexOf(phase) > order.indexOf(key);
                  const active = phase === key;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                        active ? "border-gold/35 bg-gold/8" : done ? "border-emerald-soft/25 bg-emerald-soft/5" : "border-white/8 opacity-50"
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-soft" />
                      ) : (
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "animate-pulse text-gold" : "text-muted-2")} strokeWidth={1.8} />
                      )}
                      <span className={cn("text-sm", active ? "text-gold-bright" : done ? "text-muted" : "text-muted-2")}>
                        {t(label)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {unreachable && (
                <div className="flex items-center gap-2 rounded-xl border border-sky-soft/25 bg-sky-soft/8 px-3 py-2.5 text-[11px] text-sky-soft">
                  <PlugZap className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                  {t("Container antwortet gerade nicht — er wird neu gestartet. Das Fenster verbindet sich automatisch wieder.")}
                </div>
              )}

              {current?.log && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-2">
                    <Terminal className="h-3 w-3" /> {t("Build-Ausgabe")}
                  </div>
                  <pre
                    ref={logRef}
                    className="glass-inset max-h-44 overflow-y-auto rounded-xl p-3 font-mono text-[10px] leading-relaxed text-muted-2"
                  >
                    {current.log}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {/* Fertig */}
        {state === "success" && (
          <>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-soft" />
              {t("Update abgeschlossen")}
            </DialogTitle>
            <DialogDescription>{current?.status.message}</DialogDescription>
            <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-emerald-soft/25 bg-emerald-soft/8 p-5">
              <Package className="h-5 w-5 text-emerald-soft" />
              <span className="num text-lg font-semibold text-emerald-soft">v{current?.version.version ?? "?"}</span>
            </div>
            <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
              <RotateCw className="h-4 w-4" /> {t("Seite neu laden")}
            </Button>
          </>
        )}

        {/* Fehlgeschlagen */}
        {state === "error" && (
          <>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-soft" />
              {t("Update fehlgeschlagen")}
            </DialogTitle>
            <DialogDescription>{current?.status.message}</DialogDescription>
            {current?.log && (
              <pre className="glass-inset mt-5 max-h-52 overflow-y-auto rounded-xl p-3 font-mono text-[10px] leading-relaxed text-muted-2">
                {current.log}
              </pre>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-2">
              {t("Die alte Version läuft weiter. Vollständiges Log auf dem Host unter control/update.log.")}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { reset(); onOpenChange(false); }}>
                {t("Schließen")}
              </Button>
              <Button className="flex-1" onClick={start} disabled={starting}>
                {t("Erneut versuchen")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
