"use client";

import { useEffect, useState } from "react";
import { KeyRound, Database, Sparkles, CheckCircle2, ExternalLink, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n, type Lang } from "@/lib/i18n";

type Settings = { gcConfigured: boolean; gcSecretIdMasked: string | null; country: string; demoMode: boolean; language: string };

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [secretId, setSecretId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [country, setCountry] = useState("DE");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/settings").then((r) => r.json()).then((s) => { setSettings(s); setCountry(s.country); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gcSecretId: secretId || undefined,
        gcSecretKey: secretKey || undefined,
        country,
      }),
    });
    setBusy(false);
    setSecretId("");
    setSecretKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  };

  const toggleDemo = async (on: boolean) => {
    setBusy(true);
    await fetch("/api/demo", { method: on ? "POST" : "DELETE" });
    setBusy(false);
    load();
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

      <Card className="rise rise-2">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <KeyRound className="h-5 w-5 text-gold" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">GoCardless Bank Account Data</CardTitle>
              <div className="text-xs text-muted-2">{t("PSD2-Schnittstelle für die Revolut-Verbindung")}</div>
            </div>
          </div>
          {settings?.gcConfigured
            ? <Badge color="#34d399"><CheckCircle2 className="h-3 w-3" /> {t("Konfiguriert")} {settings.gcSecretIdMasked && `(${settings.gcSecretIdMasked})`}</Badge>
            : <Badge color="#fbbf24">{t("Nicht konfiguriert")}</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-2">
            {t("Kostenlosen Account anlegen unter")}{" "}
            <a href="https://bankaccountdata.gocardless.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold-bright hover:underline">
              bankaccountdata.gocardless.com <ExternalLink className="h-3 w-3" />
            </a>
            , {t("dann unter Developers → User Secrets ein Secret-Paar erstellen und hier einfügen. Die Schlüssel werden ausschließlich lokal in deiner SQLite-Datenbank gespeichert.")}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Secret ID</Label>
              <Input placeholder={settings?.gcConfigured ? "••••••••" : "1c8d4c0e-…"} value={secretId} onChange={(e) => setSecretId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Secret Key</Label>
              <Input type="password" placeholder={settings?.gcConfigured ? "••••••••" : "Secret Key"} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5 sm:w-1/2">
            <Label>{t("Land des Revolut-Kontos")}</Label>
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="DE">{t("Deutschland")}</option>
              <option value="AT">{t("Österreich")}</option>
              <option value="FR">{t("Frankreich")}</option>
              <option value="ES">{t("Spanien")}</option>
              <option value="IT">{t("Italien")}</option>
              <option value="NL">{t("Niederlande")}</option>
              <option value="IE">{t("Irland")}</option>
              <option value="LT">{t("Litauen")}</option>
              <option value="GB">{t("Großbritannien")}</option>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={busy}>{t("Speichern")}</Button>
            {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-soft"><CheckCircle2 className="h-4 w-4" /> {t("Gespeichert")}</span>}
          </div>
        </CardContent>
      </Card>

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
          <Button variant="glass" disabled={busy} onClick={() => toggleDemo(true)}>{t("Demo-Daten laden")}</Button>
          <Button variant="destructive" disabled={busy || !settings?.demoMode} onClick={() => toggleDemo(false)}>{t("Demo-Daten entfernen")}</Button>
        </CardContent>
      </Card>

      <Card className="rise rise-4">
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
    </div>
  );
}
