"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { QrCode, RefreshCw, CheckCircle2, AlertTriangle, Smartphone, ShieldCheck, Link2, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { cn, fmtDateTime } from "@/lib/utils";

type Status = { hasCreds: boolean; status: string | null; accounts: number; lastSync: string | null; error?: string };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  CR: { label: "Erstellt — warte auf Autorisierung", color: "#fbbf24" },
  GC: { label: "Autorisierung läuft", color: "#fbbf24" },
  UA: { label: "Autorisierung läuft", color: "#fbbf24" },
  GA: { label: "Zugriff wird gewährt", color: "#fbbf24" },
  SA: { label: "Konten werden ausgewählt", color: "#fbbf24" },
  LN: { label: "Verbunden", color: "#34d399" },
  EX: { label: "Abgelaufen — bitte neu verbinden", color: "#fb7185" },
  RJ: { label: "Abgelehnt", color: "#fb7185" },
};

function ConnectInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const justLinked = params.get("linked") === "1";

  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<{ link: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    justLinked ? { kind: "ok", text: "Revolut wurde autorisiert! Starte jetzt die erste Synchronisierung." } : null
  );

  const loadStatus = useCallback(() => fetch("/api/revolut/status").then((r) => r.json()).then(setStatus), []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Während der QR-Code angezeigt wird: Status alle 5 s pollen
  useEffect(() => {
    if (!qr) return;
    const iv = setInterval(loadStatus, 5000);
    return () => clearInterval(iv);
  }, [qr, loadStatus]);

  const createQr = async () => {
    setBusy("qr");
    setMessage(null);
    const res = await fetch("/api/revolut/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); return; }
    setQr(data);
    loadStatus();
  };

  const importCsv = async (file: File) => {
    setBusy("csv");
    setMessage(null);
    const csv = await file.text();
    const res = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); return; }
    setMessage({ kind: "ok", text: t("CSV importiert: {n} Transaktionen ({s} übersprungen).", { n: data.imported, s: data.skipped }) });
  };

  const sync = async () => {
    setBusy("sync");
    setMessage(null);
    const res = await fetch("/api/revolut/sync", { method: "POST" });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); return; }
    setMessage({ kind: "ok", text: t("Synchronisiert: {a} Konten, {n} Transaktionen.", { a: data.accounts, n: data.transactions }) });
    loadStatus();
  };

  const linked = status?.status === "LN";
  const st = status?.status ? STATUS_LABEL[status.status] : null;

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-4xl gold-text">{t("Revolut verbinden")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-2">
          {t("Die Verbindung läuft über die PSD2-Banking-Schnittstelle von GoCardless — du autorisierst den Zugriff direkt in deiner Revolut-App. Achilles erhält nur Lesezugriff auf Salden und Umsätze, niemals Zugriff auf Zahlungen.")}
        </p>
      </div>

      {message && (
        <div className={cn(
          "rise flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm",
          message.kind === "ok" ? "border-emerald-soft/25 bg-emerald-soft/8 text-emerald-soft" : "border-rose-soft/25 bg-rose-soft/8 text-rose-soft"
        )}>
          {message.kind === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          {t(message.text)}
        </div>
      )}

      {status && !status.hasCreds && (
        <Card className="rise rise-1 border-amber-400/20 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="text-sm leading-relaxed text-muted">
              <span className="font-medium text-foreground">{t("GoCardless-Zugangsdaten fehlen.")}</span>{" "}
              {t("Lege dir unter")}{" "}
              <span className="text-gold-bright">bankaccountdata.gocardless.com</span>{" "}
              {t("einen kostenlosen Account an, erstelle unter „Developers → User Secrets“ ein Secret-Paar und hinterlege es in den")}{" "}
              <Link href="/settings" className="text-gold-bright underline underline-offset-2">{t("Einstellungen")}</Link>.
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* QR card */}
        <Card className="rise rise-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("QR-Code · Smartphone")}</CardTitle>
            {st && <Badge color={st.color}>{t(st.label)}</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-8">
            {qr ? (
              <>
                <div className="rounded-3xl bg-gradient-to-b from-[#f7efdb] to-[#efe4c4] p-4 shadow-[0_24px_64px_-16px_rgba(212,175,55,0.35)]">
                  <Image src={qr.qrDataUrl} alt="Revolut QR-Code" width={260} height={260} className="rounded-xl" unoptimized />
                </div>
                <div className="text-center text-xs leading-relaxed text-muted-2">
                  {t("Mit der Smartphone-Kamera scannen — der Link öffnet die Autorisierung, die Revolut-App übernimmt automatisch.")}
                </div>
                <a href={qr.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-gold-bright hover:underline">
                  <Link2 className="h-3.5 w-3.5" /> {t("Oder Link direkt auf diesem Gerät öffnen")}
                </a>
              </>
            ) : (
              <>
                <div className="flex h-[260px] w-[260px] items-center justify-center rounded-3xl glass-inset">
                  <QrCode className="h-20 w-20 text-white/10" strokeWidth={0.8} />
                </div>
                <Button onClick={createQr} disabled={busy === "qr" || (status !== null && !status.hasCreds)} className="w-full max-w-[260px]">
                  {busy === "qr" ? t("QR-Code wird erstellt …") : linked ? t("Neu verbinden") : t("QR-Code erzeugen")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Steps / sync card */}
        <div className="space-y-4">
          <Card className="rise rise-3 p-6">
            <div className="space-y-5">
              {[
                { icon: ShieldCheck, title: t("1 · QR-Code erzeugen"), text: t("Achilles erstellt eine sichere Verbindungsanfrage (Requisition) bei GoCardless.") },
                { icon: Smartphone, title: t("2 · Mit dem Smartphone scannen"), text: t("In der Revolut-App bestätigst du den Lesezugriff auf Salden und Transaktionen (gültig 180 Tage).") },
                { icon: RefreshCw, title: t("3 · Synchronisieren"), text: t("Achilles lädt bis zu 12 Monate Umsatzhistorie und kategorisiert alles automatisch.") },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.7} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted-2">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rise rise-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{t("Synchronisierung")}</div>
                <div className="mt-0.5 text-xs text-muted-2">
                  {status?.accounts ? t("{n} Konten verknüpft", { n: status.accounts }) : t("Noch keine Konten verknüpft")}
                  {status?.lastSync && ` · ${t("zuletzt {date}", { date: fmtDateTime(status.lastSync) })}`}
                </div>
              </div>
              <Button variant="glass" onClick={sync} disabled={busy === "sync" || !linked}>
                <RefreshCw className={cn("h-4 w-4", busy === "sync" && "animate-spin")} />
                {busy === "sync" ? t("Läuft …") : t("Jetzt syncen")}
              </Button>
            </div>
          </Card>

          <Card className="rise rise-5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-soft/10 border border-sky-soft/20">
                <FileUp className="h-5 w-5 text-sky-soft" strokeWidth={1.7} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t("Alternative ohne GoCardless: CSV-Import")}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-2">
                  {t("In der Revolut-App: Konto → Auszug → CSV exportieren und hier hochladen. Duplikate werden automatisch erkannt, manuelle Kategorien bleiben erhalten.")}
                </p>
                <label className="mt-3 inline-block">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={busy === "csv"}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }}
                  />
                  <span className="glass inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm transition-colors hover:border-white/20">
                    <FileUp className="h-3.5 w-3.5" />
                    {busy === "csv" ? t("Importiere …") : t("CSV-Datei auswählen")}
                  </span>
                </label>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">…</div>}>
      <ConnectInner />
    </Suspense>
  );
}
