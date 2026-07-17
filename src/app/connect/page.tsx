"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { QrCode, RefreshCw, CheckCircle2, AlertTriangle, Smartphone, Link2, FileUp, Search, Building2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { COUNTRIES, countryName } from "@/lib/countries";
import { apiJson, cn, fmtDateTime, fmtEUR } from "@/lib/utils";

type Status = {
  hasCreds: boolean; status: string | null; accounts: number;
  list?: Array<{ id: string; provider: string; name: string | null; iban: string | null; currency: string | null; balance: number; last_synced: string | null; txCount: number }>;
  aspsp: string | null; country: string; lastSync: string | null; linkedAt: string | null; error?: string;
};
type Aspsp = { name: string; country: string; logo?: string; beta?: boolean };

/**
 * Banken, die nicht unter dem Land ihrer IBAN geführt werden, sondern unter dem
 * Sitz der Lizenz. Revolut ist der prominenteste Fall: deutsche IBAN, aber die
 * Bank ist die litauische Revolut Bank UAB, Deutschland nur Zweigniederlassung.
 */
const LICENSED_ELSEWHERE: Array<{ match: RegExp; country: string }> = [
  { match: /revolut/i, country: "LT" },
  { match: /\bn26\b/i, country: "DE" },
  { match: /wise/i, country: "BE" },
  { match: /bunq/i, country: "NL" },
];

function ConnectInner() {
  const { t, lang } = useI18n();
  const params = useSearchParams();

  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<{ link: string; qrDataUrl: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [country, setCountry] = useState("DE");
  const [aspsps, setAspsps] = useState<Aspsp[] | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [aspspQuery, setAspspQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const loadStatus = useCallback(() => apiJson<Status>("/api/bank/status").then(setStatus), []);

  useEffect(() => {
    const linked = params.get("linked") === "1";
    const error = params.get("error");
    if (linked) setMessage({ kind: "ok", text: t("Bank verbunden! Starte jetzt die erste Synchronisierung.") });
    else if (error) setMessage({ kind: "err", text: error });
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (status?.country) setCountry(status.country); }, [status?.country]);

  const loadAspsps = useCallback(async (c: string) => {
    setBusy("aspsps");
    setAspsps(null);
    setMessage(null);
    const res = await fetch(`/api/bank/aspsps?country=${c}`);
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); return; }
    setAspsps(data.aspsps);
    setIsSandbox(Boolean(data.sandbox));
  }, []);

  const createQr = async (aspspName: string) => {
    setBusy("qr");
    setMessage(null);
    setSelected(aspspName);
    const res = await fetch("/api/bank/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspspName, country }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); setSelected(null); return; }
    setQr(data);
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
    const res = await fetch("/api/bank/sync", { method: "POST" });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { setMessage({ kind: "err", text: data.error }); return; }
    setMessage({ kind: "ok", text: t("Synchronisiert: {a} Konten, {n} Transaktionen.", { a: data.accounts, n: data.transactions }) });
    loadStatus();
  };

  const linked = Boolean(status?.linkedAt) && status?.status !== "EXPIRED";
  const filtered = (aspsps ?? []).filter((a) => a.name.toLowerCase().includes(aspspQuery.toLowerCase()));
  const noCreds = status !== null && !status.hasCreds;

  // Sichtbar begrenzen, damit tausend Banken den Browser nicht ausbremsen —
  // aber nie stillschweigend: wie viele ausgeblendet sind, steht darunter.
  const VISIBLE = 60;
  const shown = filtered.slice(0, VISIBLE);
  const hidden = filtered.length - shown.length;

  // Gesuchte Bank ist in einem anderen Land lizenziert? Dann dorthin lotsen,
  // statt den Nutzer eine leere Liste durchsuchen zu lassen.
  const elsewhere = aspspQuery.trim().length >= 3 && filtered.length === 0
    ? LICENSED_ELSEWHERE.find((e) => e.match.test(aspspQuery) && e.country !== country)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-4xl gold-text">{t("Bank verbinden")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-2">
          {t("Über die PSD2-Schnittstelle von Enable Banking — 2.700+ Banken in 30 europäischen Ländern. Du autorisierst den Zugriff direkt in deiner Banking-App. Achilles bekommt nur Lesezugriff auf Salden und Umsätze, niemals Zugriff auf Zahlungen.")}
        </p>
      </div>

      {message && (
        <div className={cn(
          "rise flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm",
          message.kind === "ok" ? "border-emerald-soft/25 bg-emerald-soft/8 text-emerald-soft" : "border-rose-soft/25 bg-rose-soft/8 text-rose-soft"
        )}>
          {message.kind === "ok" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          {message.text}
        </div>
      )}

      {noCreds && (
        <Card className="rise rise-1 border-amber-400/20 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="text-sm leading-relaxed text-muted">
              <span className="font-medium text-foreground">{t("Enable-Banking-Zugangsdaten fehlen.")}</span>{" "}
              {t("Lege einen Account auf enablebanking.com an, registriere im Control Panel eine Anwendung und hinterlege Application-ID und Private Key in den")}{" "}
              <Link href="/settings" className="text-gold-bright underline underline-offset-2">{t("Einstellungen")}</Link>.
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bankauswahl / QR */}
        <Card className="rise rise-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{qr ? t("QR-Code · Smartphone") : t("Bank wählen")}</CardTitle>
            {linked && status?.aspsp && <Badge color="#34d399">{status.aspsp}</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-8">
            {qr ? (
              <>
                <div className="rounded-3xl bg-gradient-to-b from-[#f7efdb] to-[#efe4c4] p-4 shadow-[0_24px_64px_-16px_rgba(212,175,55,0.35)]">
                  <Image src={qr.qrDataUrl} alt={t("QR-Code")} width={260} height={260} className="rounded-xl" unoptimized />
                </div>
                <div className="text-center text-xs leading-relaxed text-muted-2">
                  {selected && <div className="mb-1 font-medium text-foreground">{selected}</div>}
                  {t("Mit der Smartphone-Kamera scannen — der Link öffnet die Autorisierung, deine Banking-App übernimmt automatisch.")}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <a href={qr.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-gold-bright hover:underline">
                    <Link2 className="h-3.5 w-3.5" /> {t("Oder Link direkt auf diesem Gerät öffnen")}
                  </a>
                  <button onClick={() => { setQr(null); setSelected(null); }} className="cursor-pointer text-xs text-muted-2 hover:text-foreground">
                    {t("Andere Bank wählen")}
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("Land")}</Label>
                  <Select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setAspsps(null); setAspspQuery(""); }}
                    disabled={noCreds}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{lang === "de" ? c.de : c.en}</option>
                    ))}
                  </Select>
                </div>

                {aspsps === null ? (
                  <>
                    <div className="flex h-[180px] items-center justify-center rounded-2xl glass-inset">
                      <QrCode className="h-16 w-16 text-white/10" strokeWidth={0.8} />
                    </div>
                    <Button className="w-full" disabled={busy === "aspsps" || noCreds} onClick={() => loadAspsps(country)}>
                      <Building2 className="h-4 w-4" />
                      {busy === "aspsps" ? t("Lade Banken …") : t("Banken anzeigen")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                      <Input
                        className="pl-10"
                        placeholder={t("{n} Banken durchsuchen …", { n: aspsps.length })}
                        value={aspspQuery}
                        onChange={(e) => setAspspQuery(e.target.value)}
                      />
                    </div>
                    {isSandbox && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2.5 text-[11px] leading-relaxed text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {t("Diese Liste kommt aus der Sandbox-Umgebung — echte Banken wie Revolut fehlen dort. Registriere im Control Panel eine Anwendung in der Produktionsumgebung (Sandbox-Apps lassen sich nicht umstellen).")}
                      </div>
                    )}

                    <div className="max-h-[280px] space-y-1 overflow-y-auto">
                      {filtered.length === 0 && !elsewhere && (
                        <div className="py-6 text-center text-xs text-muted-2">{t("Keine Bank gefunden.")}</div>
                      )}
                      {elsewhere && (
                        <button
                          onClick={() => { setCountry(elsewhere.country); setAspsps(null); }}
                          className="flex w-full cursor-pointer items-start gap-2 rounded-xl border border-gold/25 bg-gold/8 px-3 py-3 text-left text-[11px] leading-relaxed text-gold-bright hover:bg-gold/12"
                        >
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            {t("Diese Bank ist in {country} lizenziert und dort gelistet — auch wenn deine IBAN aus einem anderen Land stammt. Zum Wechseln hier klicken.", {
                              country: countryName(elsewhere.country, lang),
                            })}
                          </span>
                        </button>
                      )}
                      {shown.map((a) => (
                        <button
                          key={`${a.country}-${a.name}`}
                          onClick={() => createQr(a.name)}
                          disabled={busy === "qr"}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {a.logo
                            ? <img src={a.logo} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
                            : <Building2 className="h-5 w-5 shrink-0 text-muted-2" />}
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                          {a.beta && <span className="shrink-0 text-[10px] text-muted-2">beta</span>}
                        </button>
                      ))}
                    </div>
                    {hidden > 0 && (
                      <div className="text-center text-[11px] text-muted-2">
                        {t("{n} weitere ausgeblendet — tippe oben, um zu suchen.", { n: hidden })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schritte / Sync / CSV */}
        <div className="space-y-4">
          <Card className="rise rise-3 p-6">
            <div className="space-y-5">
              {[
                { icon: Building2, title: t("1 · Bank wählen"), text: t("Land auswählen und deine Bank aus der Liste anklicken.") },
                { icon: Smartphone, title: t("2 · Mit dem Smartphone scannen"), text: t("In deiner Banking-App bestätigst du den Lesezugriff auf Salden und Transaktionen.") },
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

            {/* Die verknüpften Konten einzeln auflisten — eine Zahl allein sagt
                nicht, ob das richtige Konto dabei ist. */}
            {status?.list && status.list.length > 0 && (
              <>
                <div className="hairline my-4" />
                <div className="space-y-2">
                  {status.list.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{a.name || a.iban || a.id}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-2">
                          {/* IBAN gekürzt: zum Wiedererkennen reichen die letzten
                              Stellen, und sie steht damit nicht voll auf dem Schirm. */}
                          {a.iban && <span className="num">···{a.iban.slice(-6)}</span>}
                          <span>{t("{n} Buchungen", { n: a.txCount })}</span>
                          {a.last_synced && <span>· {fmtDateTime(a.last_synced)}</span>}
                        </div>
                      </div>
                      <div className="num shrink-0 text-sm font-semibold">{fmtEUR(a.balance)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="rise rise-5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-soft/10 border border-sky-soft/20">
                <FileUp className="h-5 w-5 text-sky-soft" strokeWidth={1.7} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t("Alternative: CSV-Import")}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-2">
                  {t("Ohne Bankanbindung: Kontoauszug als CSV aus deiner Banking-App exportieren und hier hochladen. Duplikate werden automatisch erkannt, manuelle Kategorien bleiben erhalten.")}
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
