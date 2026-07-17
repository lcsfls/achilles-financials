"use client";

import { useEffect, useState } from "react";
import { KeyRound, Database, Sparkles, CheckCircle2, ExternalLink, Languages, RefreshCw, Download, GitBranch, AlertTriangle, Terminal, Lock, LogOut, Archive, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UpdateDialog } from "@/components/update-dialog";
import { IntegrationsSection } from "@/components/integrations-section";
import { useI18n, type Lang } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/countries";
import { cn, fmtDateTime } from "@/lib/utils";

type Settings = { ebConfigured: boolean; ebAppIdMasked: string | null; country: string; demoMode: boolean; language: string; authEnabled: boolean; authUser: string | null; appUrl: string; appUrlSource: "setting" | "env" | "request"; effectiveOrigin: string; callbackUrl: string };

type UpdateInfo = {
  repo: string;
  branch: string;
  version: { version: string | null; sha: string | null; shortSha: string | null; deployedAt: string | null; branch: string };
  status: { state: "idle" | "requested" | "running" | "success" | "error"; message?: string; finishedAt?: string; toSha?: string };
  log: string | null;
  canUpdate: boolean;
  control: "ok" | "missing" | "readonly";
  fixCommand: string | null;
  latest: { version: string; tag: string; notes: string | null; publishedAt: string | null } | null;
  updateAvailable: boolean | null;
  checkFailed: boolean;
  upToDate: boolean;
  releasesUrl: string;
  shellCommand: string;
};

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  const [upd, setUpd] = useState<UpdateInfo | null>(null);
  const [updError, setUpdError] = useState<string | null>(null);
  const [updFix, setUpdFix] = useState<string | null>(null);
  const [updDialog, setUpdDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [demoWarning, setDemoWarning] = useState(false);
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authCurrent, setAuthCurrent] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSaved, setAuthSaved] = useState(false);
  const [bakPass, setBakPass] = useState("");
  const [bakBusy, setBakBusy] = useState<string | null>(null);
  const [bakError, setBakError] = useState<string | null>(null);
  const [bakInfo, setBakInfo] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [demoCounts, setDemoCounts] = useState<{ accounts: number; netWorth: number } | null>(null);


  const load = () => fetch("/api/settings").then((r) => r.json()).then(setSettings);
  const loadUpdate = (refresh = false) =>
    fetch(`/api/update${refresh ? "?refresh=1" : ""}`).then((r) => r.json()).then(setUpd).catch(() => {});
  useEffect(() => { load(); loadUpdate(); }, []);

  // Während ein Update läuft, Status pollen — der Container startet dabei neu,
  // fehlgeschlagene Requests sind also erwartbar.
  const running = upd?.status.state === "requested" || upd?.status.state === "running";
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(loadUpdate, 4000);
    return () => clearInterval(iv);
  }, [running]);


  const saveAuth = async (disable = false) => {
    setBusy(true);
    setAuthError(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth: disable
          ? { disable: true, currentPassword: authCurrent }
          : { username: authUser, password: authPass, currentPassword: authCurrent },
      }),
    });
    setBusy(false);
    if (!res.ok) { setAuthError(t((await res.json()).error)); return; }
    setAuthPass("");
    setAuthCurrent("");
    setAuthSaved(true);
    setTimeout(() => setAuthSaved(false), 3000);
    load();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const downloadBackup = async () => {
    setBakBusy("backup");
    setBakError(null);
    setBakInfo(null);
    const res = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: bakPass }),
    });
    if (!res.ok) { setBakBusy(null); setBakError(t((await res.json()).error)); return; }

    const blob = await res.blob();
    const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "achilles.achillesbak";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    setBakBusy(null);
    setBakInfo(t("Backup heruntergeladen: {name}", { name }));
  };

  const doRestore = async () => {
    if (!restoreFile) return;
    if (!confirm(t("Wiederherstellen? Alle aktuellen Daten werden durch den Inhalt des Backups ersetzt — auch Login und Bank-Zugangsdaten."))) return;
    setBakBusy("restore");
    setBakError(null);
    setBakInfo(null);
    const form = new FormData();
    form.append("file", restoreFile);
    form.append("password", bakPass);
    const res = await fetch("/api/backup/restore", { method: "POST", body: form });
    setBakBusy(null);
    if (!res.ok) { setBakError(t((await res.json()).error)); return; }
    const d = await res.json();
    setBakInfo(t("Wiederhergestellt: {n} Tabellen. Seite wird neu geladen …", { n: d.tables }));
    setTimeout(() => window.location.reload(), 1500);
  };

  const toggleDemo = async (on: boolean) => {
    setBusy(true);
    await fetch("/api/demo", { method: on ? "POST" : "DELETE" });
    setBusy(false);
    setDemoWarning(false);
    load();
  };

  // Vor dem Warnhinweis nachsehen, was tatsächlich schon da ist — eine
  // konkrete Zahl wiegt schwerer als eine allgemeine Warnung.
  const openDemoWarning = async () => {
    setDemoCounts(null);
    setDemoWarning(true);
    const s = await fetch("/api/summary").then((r) => r.json()).catch(() => null);
    if (s) setDemoCounts({ accounts: (s.accounts ?? []).filter((a: { id: string }) => a.id !== "demo-main").length, netWorth: s.netWorth ?? 0 });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rise">
        <h1 className="font-display text-4xl gold-text">{t("Einstellungen")}</h1>
        <p className="mt-1 text-sm text-muted-2">{t("API-Zugänge, Sprache und Daten verwalten.")}</p>
      </div>

      {/* Language */}
      <Card className="rise rise-1">
        <CardHeader className="flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
            <Languages className="h-5 w-5 text-gold" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Sprache")}</CardTitle>
            <div className="text-xs text-muted-2">{t("Sprache der Oberfläche und Zahlenformate")}</div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3">
          {([["de", "Deutsch"], ["en", "English"]] as Array<[Lang, string]>).map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                lang === code
                  ? "border-gold/40 bg-gold/10 text-gold-bright shadow-[0_0_24px_-8px_rgba(212,175,55,0.4)]"
                  : "border-white/10 text-muted hover:border-white/20 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Login */}
      <Card className="rise rise-2">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-soft/10 border border-rose-soft/20">
              <Lock className="h-5 w-5 text-rose-soft" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Login")}</CardTitle>
              <div className="text-xs text-muted-2">{t("Schützt das Dashboard mit Benutzername und Passwort")}</div>
            </div>
          </div>
          {settings?.authEnabled
            ? <Badge color="#34d399"><CheckCircle2 className="h-3 w-3" /> {t("Aktiv")} ({settings.authUser})</Badge>
            : <Badge color="#fb7185">{t("Kein Schutz")}</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings?.authEnabled && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-xs leading-relaxed text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("Ohne Login kann jeder im Netzwerk deine Finanzdaten sehen und deine Bank-Zugangsdaten auslesen.")}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("Benutzername")}</Label>
              <Input
                autoComplete="username"
                placeholder={settings?.authUser ?? "achilles"}
                value={authUser}
                onChange={(e) => { setAuthUser(e.target.value); setAuthError(null); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{settings?.authEnabled ? t("Neues Passwort") : t("Passwort")}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("mindestens 8 Zeichen")}
                value={authPass}
                onChange={(e) => { setAuthPass(e.target.value); setAuthError(null); }}
              />
            </div>
          </div>

          {settings?.authEnabled && (
            <div className="space-y-1.5 sm:w-1/2">
              <Label>{t("Aktuelles Passwort")}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={authCurrent}
                onChange={(e) => { setAuthCurrent(e.target.value); setAuthError(null); }}
              />
            </div>
          )}

          {authError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-3 py-2.5 text-xs text-rose-soft">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {authError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => saveAuth(false)} disabled={busy || !authUser || !authPass}>
              {settings?.authEnabled ? t("Zugangsdaten ändern") : t("Login aktivieren")}
            </Button>
            {settings?.authEnabled && (
              <>
                <Button variant="destructive" onClick={() => saveAuth(true)} disabled={busy || !authCurrent}>
                  {t("Login deaktivieren")}
                </Button>
                <Button variant="ghost" onClick={logout}>
                  <LogOut className="h-4 w-4" /> {t("Abmelden")}
                </Button>
              </>
            )}
            {authSaved && <span className="flex items-center gap-1.5 text-sm text-emerald-soft"><CheckCircle2 className="h-4 w-4" /> {t("Gespeichert")}</span>}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-2">
            {t("Passkeys sind noch nicht umgesetzt — bis dahin schützt das Passwort. Für Zugriff von außerhalb des LAN gehört ohnehin ein Reverse-Proxy mit HTTPS davor.")}
          </p>
        </CardContent>
      </Card>

      <IntegrationsSection onChange={load} />

      <Card className="rise rise-3">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-soft/10 border border-violet-soft/20">
              <Sparkles className="h-5 w-5 text-violet-soft" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Demo-Modus")}</CardTitle>
              <div className="text-xs text-muted-2">{t("Realistische Beispieldaten zum Erkunden des Dashboards")}</div>
            </div>
          </div>
          {settings?.demoMode && <Badge color="#a78bfa">{t("Aktiv")}</Badge>}
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="glass" disabled={busy} onClick={openDemoWarning}>{t("Demo-Daten laden")}</Button>
          <Button variant="destructive" disabled={busy || !settings?.demoMode} onClick={() => toggleDemo(false)}>{t("Demo-Daten entfernen")}</Button>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card className="rise rise-4">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-soft/10 border border-emerald-soft/20">
              <Download className="h-5 w-5 text-emerald-soft" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Updates")}</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-2">
                <GitBranch className="h-3 w-3" />
                {upd?.repo ?? "…"} · {upd?.branch ?? ""}
              </div>
            </div>
          </div>
          {upd && (upd.checkFailed
            ? <Badge color="#94a3b8">{t("Prüfung fehlgeschlagen")}</Badge>
            : upd.upToDate
              ? <Badge color="#34d399"><CheckCircle2 className="h-3 w-3" /> {t("Aktuell")}</Badge>
              : upd.updateAvailable && upd.latest
                ? <Badge color="#fbbf24">{t("Version {v} verfügbar", { v: upd.latest.version })}</Badge>
                : null)}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Versionszeile */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-2">
            <span>
              {t("Installiert")}:{" "}
              <span className="num font-semibold text-foreground">
                {upd?.version.version ? `v${upd.version.version}` : t("unbekannt")}
              </span>
              {upd?.version.shortSha && <span className="num ml-1.5 opacity-60">({upd.version.shortSha})</span>}
              {upd?.version.deployedAt && ` · ${fmtDateTime(upd.version.deployedAt)}`}
            </span>
            {upd?.latest && (
              <span>
                {t("Neueste")}: <span className="num text-foreground">v{upd.latest.version}</span>
              </span>
            )}
            {upd && (
              <a href={upd.releasesUrl} target="_blank" rel="noreferrer" className="text-gold-bright hover:underline">
                {t("Alle Versionen →")}
              </a>
            )}
          </div>

          {/* Laufendes Update */}

          {/* Ergebnis des letzten Updates */}
          {!running && upd?.status.state === "success" && upd.status.message && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-soft/25 bg-emerald-soft/8 px-4 py-3 text-sm text-emerald-soft">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {upd.status.message}
            </div>
          )}
          {!running && upd?.status.state === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-4 py-3 text-sm text-rose-soft">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div>{t("Letztes Update fehlgeschlagen")}</div>
                {upd.status.message && <div className="mt-0.5 text-xs opacity-80">{upd.status.message}</div>}
              </div>
            </div>
          )}
          {upd?.checkFailed && (
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-2" />
              {t("Die Version auf GitHub konnte nicht geprüft werden — meist das Stundenlimit der GitHub-API (60 Anfragen ohne Token) oder fehlendes Internet. Später erneut versuchen.")}
            </div>
          )}

          {updError && (
            <div className="rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-4 py-3 text-sm text-rose-soft">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{updError}</span>
              </div>
              {updFix && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-black/40 px-3 py-2 text-[11px] text-gold-bright">
                    {updFix}
                  </code>
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(updFix)}>
                    {t("Kopieren")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Changelog */}
          {upd?.updateAvailable && upd.latest?.notes && (
            <div className="glass-inset rounded-xl p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-2">
                {t("Neu in v{v}", { v: upd.latest.version })}
              </div>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                {upd.latest.notes}
              </pre>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="glass" onClick={() => loadUpdate(true)} disabled={running}>
              <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} /> {t("Nach Updates suchen")}
            </Button>
            {upd?.canUpdate && upd.updateAvailable && upd.latest && (
              <Button onClick={() => setUpdDialog(true)} disabled={running}>
                <Download className="h-4 w-4" />
                {t("Auf v{v} aktualisieren", { v: upd.latest.version })}
              </Button>
            )}
            {running && (
              <Button variant="glass" onClick={() => setUpdDialog(true)}>
                <RefreshCw className="h-4 w-4 animate-spin" /> {t("Fortschritt anzeigen")}
              </Button>
            )}
          </div>

          {/* Fallback ohne Control-Kanal */}
          {upd && !upd.canUpdate && (
            <div className="glass-inset rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-2" />
                {upd.control === "readonly"
                  ? t("Keine Schreibrechte im Control-Verzeichnis — einmalig in der Proxmox-Shell ausführen (kein Container-Passwort nötig):")
                  : t("In-App-Updates sind hier nicht eingerichtet. Per Shell aktualisieren:")}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-black/40 px-3 py-2 text-[11px] text-gold-bright">
                  {upd.fixCommand ?? upd.shellCommand}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(upd.fixCommand ?? upd.shellCommand); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? t("Kopiert") : t("Kopieren")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup */}
      <Card className="rise rise-5">
        <CardHeader className="flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
            <Archive className="h-5 w-5 text-gold" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Backup")}</CardTitle>
            <div className="text-xs text-muted-2">{t("Verschlüsselte Sicherung aller Daten (.achillesbak)")}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-2">
            {t("Die Datei enthält alles: Konten, Buchungen, Bestände, Szenarien — und deinen Bank-Private-Key. Sie wird mit AES-256 aus deinem Passwort verschlüsselt. Ohne dieses Passwort ist sie nicht wiederherstellbar; es gibt keine Hintertür.")}
          </p>

          <div className="space-y-1.5 sm:w-2/3">
            <Label>{t("Backup-Passwort")}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={t("mindestens 8 Zeichen")}
              value={bakPass}
              onChange={(e) => { setBakPass(e.target.value); setBakError(null); }}
            />
          </div>

          {bakError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-3 py-2.5 text-xs text-rose-soft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {bakError}
            </div>
          )}
          {bakInfo && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-soft/25 bg-emerald-soft/8 px-3 py-2.5 text-xs text-emerald-soft">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {bakInfo}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={downloadBackup} disabled={bakBusy !== null || bakPass.length < 8}>
              <Download className="h-4 w-4" /> {bakBusy === "backup" ? t("Erstelle …") : t("Backup herunterladen")}
            </Button>
          </div>

          <div className="hairline" />

          <div>
            <div className="mb-2 text-sm font-medium">{t("Wiederherstellen")}</div>
            <div className="flex flex-wrap items-center gap-3">
              <label>
                <input
                  type="file"
                  accept=".achillesbak"
                  className="hidden"
                  onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); setBakError(null); }}
                />
                <span className="glass inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm transition-colors hover:border-white/20">
                  <Upload className="h-3.5 w-3.5" />
                  {restoreFile ? restoreFile.name : t("Datei auswählen")}
                </span>
              </label>
              <Button
                variant="destructive"
                onClick={doRestore}
                disabled={bakBusy !== null || !restoreFile || bakPass.length < 8}
              >
                {bakBusy === "restore" ? t("Stelle wieder her …") : t("Wiederherstellen")}
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
              {t("Ersetzt alle aktuellen Daten durch den Inhalt des Backups. Nutze oben dasselbe Passwort, mit dem die Datei erstellt wurde.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rise">
        <CardHeader className="flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-soft/10 border border-sky-soft/20">
            <Database className="h-5 w-5 text-sky-soft" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Daten & Hosting")}</CardTitle>
            <div className="text-xs text-muted-2">{t("Alles bleibt bei dir")}</div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted-2">
            {t("Alle Daten liegen in einer SQLite-Datenbank unter /data/achilles.db im Container-Volume. Für Backups genügt es, diese Datei zu sichern. Spotpreise und Wechselkurse kommen von gold-api.com, Yahoo Finance und frankfurter.app — es verlassen keine persönlichen Daten deinen Server.")}
          </p>
        </CardContent>
      </Card>

      <UpdateDialog
        open={updDialog}
        onOpenChange={setUpdDialog}
        info={upd}
        onStarted={loadUpdate}
        onFinished={loadUpdate}
      />

      {/* Warnung vor dem Laden von Demo-Daten */}
      <Dialog open={demoWarning} onOpenChange={setDemoWarning}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            {t("Demo-Daten laden?")}
          </DialogTitle>
          <DialogDescription>
            {t("Demo-Daten landen in derselben Datenbank wie deine echten Daten — nicht in einem getrennten Modus.")}
          </DialogDescription>

          <div className="mt-5 space-y-3">
            {demoCounts && demoCounts.accounts > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-4 py-3 text-sm text-rose-soft">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t("Du hast bereits {n} echtes Konto verbunden.", { n: demoCounts.accounts })}{" "}
                  {t("Die Demo-Buchungen mischen sich in deine Transaktionsliste und verfälschen Auswertungen wie Sparquote und Kategorien.")}
                </span>
              </div>
            )}

            <div className="glass-inset space-y-2 rounded-xl p-4 text-xs leading-relaxed">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-2">{t("Was passiert")}</div>
              <ul className="space-y-1.5 text-muted">
                <li className="flex gap-2"><span className="text-amber-400">·</span>{t("Ein Demo-Konto und rund 300 Buchungen aus 8 Monaten werden angelegt.")}</li>
                <li className="flex gap-2"><span className="text-amber-400">·</span>{t("Edelmetalle, Investments, Vorsorge und FIRE-Szenarien werden nur angelegt, wenn dort noch nichts steht — deine eigenen Einträge bleiben unangetastet.")}</li>
                <li className="flex gap-2"><span className="text-emerald-soft">·</span>{t("Alles Demo-Erzeugte ist markiert und lässt sich über „Demo-Daten entfernen“ rückstandsfrei löschen.")}</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDemoWarning(false)} disabled={busy}>
              {t("Abbrechen")}
            </Button>
            <Button className="flex-1" onClick={() => toggleDemo(true)} disabled={busy}>
              {busy ? t("Lade …") : t("Trotzdem laden")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
