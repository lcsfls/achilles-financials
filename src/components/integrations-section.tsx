"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Landmark, CheckCircle2, AlertTriangle, ExternalLink, PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { IntegrationCard, type Requirement } from "@/components/integration-card";
import { useI18n } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/countries";
import { cn, fmtDateTime } from "@/lib/utils";

type Integrations = { integrations: Array<{ id: "enablebanking" | "fints"; enabled: boolean; configured: boolean }> };
type EbSettings = { ebConfigured: boolean; ebAppIdMasked: string | null; country: string; appUrl: string; appUrlSource: string; callbackUrl: string };
type FinTs = { url: string; blz: string; user: string; pinSet: boolean; productId: string; lastSync: string | null };

export function IntegrationsSection({ onChange }: { onChange?: () => void }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<Integrations | null>(null);
  const [eb, setEb] = useState<EbSettings | null>(null);
  const [fints, setFints] = useState<FinTs | null>(null);

  // Enable Banking
  const [appId, setAppId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [country, setCountry] = useState("DE");
  const [ebMsg, setEbMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // FinTS
  const [fUrl, setFUrl] = useState("");
  const [fBlz, setFBlz] = useState("");
  const [fUser, setFUser] = useState("");
  const [fPin, setFPin] = useState("");
  const [fProduct, setFProduct] = useState("");
  const [fMsg, setFMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [i, s, f] = await Promise.all([
      fetch("/api/integrations").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/fints").then((r) => r.json()),
    ]);
    setState(i);
    setEb(s);
    setAppUrl(s.appUrl ?? "");
    setCountry(s.country ?? "DE");
    setFints(f);
    setFUrl(f.url); setFBlz(f.blz); setFUser(f.user); setFProduct(f.productId);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (id: "enablebanking" | "fints", enabled: boolean) => {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    await load();
    onChange?.();
  };

  const saveEb = async () => {
    setBusy("eb");
    setEbMsg(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ebAppId: appId || undefined, ebPrivateKey: privateKey || undefined, appUrl, country }),
    });
    setBusy(null);
    if (!res.ok) { setEbMsg({ ok: false, text: t((await res.json()).error) }); return; }
    setAppId(""); setPrivateKey("");
    setEbMsg({ ok: true, text: t("Gespeichert") });
    load();
  };

  const saveFints = async () => {
    setBusy("fints");
    setFMsg(null);
    const res = await fetch("/api/fints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fUrl, blz: fBlz, user: fUser, pin: fPin || undefined, productId: fProduct }),
    });
    setBusy(null);
    if (!res.ok) { setFMsg({ ok: false, text: t((await res.json()).error) }); return; }
    setFPin("");
    setFMsg({ ok: true, text: t("Gespeichert") });
    load();
  };

  const testFints = async () => {
    setBusy("fints-test");
    setFMsg(null);
    const res = await fetch("/api/fints", { method: "PUT" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) { setFMsg({ ok: false, text: d.error }); return; }
    setFMsg({ ok: true, text: t("Verbindung steht — {n} Konten gefunden: {list}", { n: d.accounts.length, list: d.accounts.map((a: { name: string }) => a.name).join(", ") }) });
  };

  const syncFints = async () => {
    setBusy("fints-sync");
    setFMsg(null);
    const res = await fetch("/api/fints/sync", { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) { setFMsg({ ok: false, text: d.error }); return; }
    setFMsg({ ok: true, text: t("Synchronisiert: {a} Konten, {n} Transaktionen.", { a: d.accounts, n: d.transactions }) });
    load();
    onChange?.();
  };

  if (!state || !eb || !fints) return null;

  const ebEnabled = state.integrations.find((i) => i.id === "enablebanking")?.enabled ?? false;
  const ebConfigured = state.integrations.find((i) => i.id === "enablebanking")?.configured ?? false;
  const fEnabled = state.integrations.find((i) => i.id === "fints")?.enabled ?? false;
  const fConfigured = state.integrations.find((i) => i.id === "fints")?.configured ?? false;

  const EB_REQ: Requirement[] = [
    { kind: "need", text: t("Eine öffentlich erreichbare HTTPS-Domain. Enable Banking lehnt http:// und lokale IPs ab („scheme not supported“). Ein Reverse-Proxy mit echtem Zertifikat genügt — das Zertifikat muss dein Handy akzeptieren.") },
    { kind: "need", text: t("Eine veröffentlichte Datenschutzerklärung und AGB plus eine Datenschutz-Kontaktmail. Enable Banking prüft laufend, ob die Links erreichbar bleiben.") },
    { kind: "need", text: t("Ein kostenloser Account auf enablebanking.com und eine dort registrierte Anwendung (Application-ID + Private Key).") },
    { kind: "good", text: t("Dafür: 2.700+ Banken in 30 europäischen Ländern, auch Revolut, N26, Wise und bunq.") },
  ];

  const FINTS_REQ: Requirement[] = [
    { kind: "need", text: t("Nur deutsche Banken. Revolut, N26, Wise und bunq sind nicht erreichbar — die sind nicht deutsch lizenziert.") },
    { kind: "need", text: t("Eine Produktregistrierungsnummer der Deutschen Kreditwirtschaft. Kostenlos über fints.org, aber mit 10–15 Werktagen Bearbeitungszeit. Ohne sie lehnen die meisten Banken mit „3078 Software nicht als FinTS-Produkt registriert“ ab.") },
    { kind: "warn", text: t("Der interaktive TAN-Dialog ist noch nicht umgesetzt. Verlangt deine Bank beim Abruf eine TAN (üblich alle 90 Tage), schlägt der Sync fehl.") },
    { kind: "warn", text: t("Immer mehr Banken stellen FinTS zugunsten von PSD2 ein.") },
    { kind: "good", text: t("Dafür: kein Redirect, keine Domain, kein Aggregator — dein Server spricht direkt mit der Bank.") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <PlugZap className="h-4 w-4 text-muted-2" />
        <h2 className="text-sm font-medium text-muted">{t("Bankanbindungen")}</h2>
      </div>

      {/* Enable Banking */}
      <IntegrationCard
        icon={<Globe className="h-5 w-5" style={{ color: "#d4af37" }} strokeWidth={1.7} />}
        title="Enable Banking"
        subtitle={t("PSD2 · 2.700+ Banken in Europa · braucht HTTPS-Domain")}
        enabled={ebEnabled}
        configured={ebConfigured}
        requirements={EB_REQ}
        docsUrl="https://enablebanking.com"
        docsLabel="enablebanking.com"
        onToggle={(on) => toggle("enablebanking", on)}
      >
        <div className="space-y-1.5">
          <Label>{t("Öffentliche Adresse dieser Instanz")}</Label>
          <Input placeholder="https://achilles.deine-domain.de" value={appUrl} onChange={(e) => { setAppUrl(e.target.value); setEbMsg(null); }} />
        </div>

        <div className="glass-inset rounded-xl px-3 py-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-muted-2">{t("Redirect-URL für das Control Panel")}:</span>
            <code className="text-gold-bright">{eb.callbackUrl}</code>
          </div>
          {!eb.callbackUrl.startsWith("https://") && (
            <div className="mt-1.5 flex items-start gap-1.5 text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{t("Kein HTTPS — Enable Banking wird diese Redirect-URL in der Produktivumgebung ablehnen.")}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Application ID</Label>
          <Input placeholder={eb.ebConfigured ? `•••••••• (${eb.ebAppIdMasked})` : "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"} value={appId} onChange={(e) => setAppId(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("Private Key (.pem-Inhalt)")}</Label>
          <textarea
            rows={3}
            spellCheck={false}
            placeholder={eb.ebConfigured ? "•••••••• (gesetzt)" : "-----BEGIN PRIVATE KEY-----\n…"}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            className="flex w-full rounded-xl glass-inset px-4 py-3 font-mono text-[11px] text-foreground placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          />
        </div>
        <div className="space-y-1.5 sm:w-1/2">
          <Label>{t("Land deiner Bank")}</Label>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{lang === "de" ? c.de : c.en}</option>)}
          </Select>
        </div>

        {ebMsg && <Message ok={ebMsg.ok} text={ebMsg.text} />}
        <Button onClick={saveEb} disabled={busy !== null}>{busy === "eb" ? t("Speichern …") : t("Speichern")}</Button>
      </IntegrationCard>

      {/* FinTS */}
      <IntegrationCard
        icon={<Landmark className="h-5 w-5" style={{ color: "#38bdf8" }} strokeWidth={1.7} />}
        title="FinTS / HBCI"
        subtitle={t("Direkt zur Bank · nur Deutschland · braucht Produktregistrierung")}
        enabled={fEnabled}
        configured={fConfigured}
        requirements={FINTS_REQ}
        docsUrl="https://www.fints.org/de/hersteller/produktregistrierung"
        docsLabel={t("Produktregistrierung beantragen")}
        onToggle={(on) => toggle("fints", on)}
        accent="#38bdf8"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("Bankleitzahl (8 Ziffern)")}</Label>
            <Input inputMode="numeric" placeholder="12030000" value={fBlz} onChange={(e) => { setFBlz(e.target.value); setFMsg(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("FinTS-URL deiner Bank")}</Label>
            <Input placeholder="https://fints.deine-bank.de/fints" value={fUrl} onChange={(e) => { setFUrl(e.target.value); setFMsg(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Benutzerkennung")}</Label>
            <Input autoComplete="off" value={fUser} onChange={(e) => { setFUser(e.target.value); setFMsg(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Online-Banking-PIN")}</Label>
            <Input type="password" autoComplete="new-password" placeholder={fints.pinSet ? "•••••••• (gesetzt)" : ""} value={fPin} onChange={(e) => { setFPin(e.target.value); setFMsg(null); }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("Produktregistrierungsnummer")}</Label>
          <Input placeholder="z. B. 1234567890ABCDEF" value={fProduct} onChange={(e) => { setFProduct(e.target.value); setFMsg(null); }} />
          <p className="text-[11px] leading-relaxed text-muted-2">
            {t("Ohne diese Nummer lehnen die meisten Banken ab.")}{" "}
            <a href="https://www.fints.org/de/hersteller/produktregistrierung" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold-bright hover:underline">
              {t("Kostenlos beantragen")} <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-2">
          {t("PIN und Zugangsdaten liegen ausschließlich in deiner lokalen SQLite-Datenbank — sie verlassen deinen Server nur zur Bank selbst.")}
        </p>

        {fMsg && <Message ok={fMsg.ok} text={fMsg.text} />}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={saveFints} disabled={busy !== null}>{busy === "fints" ? t("Speichern …") : t("Speichern")}</Button>
          <Button variant="glass" onClick={testFints} disabled={busy !== null || !fConfigured}>
            {busy === "fints-test" ? t("Prüfe …") : t("Verbindung testen")}
          </Button>
          <Button variant="glass" onClick={syncFints} disabled={busy !== null || !fConfigured}>
            <RefreshCw className={cn("h-4 w-4", busy === "fints-sync" && "animate-spin")} />
            {busy === "fints-sync" ? t("Läuft …") : t("Jetzt syncen")}
          </Button>
          {fints.lastSync && (
            <span className="text-[11px] text-muted-2">{t("zuletzt {date}", { date: fmtDateTime(fints.lastSync) })}</span>
          )}
        </div>
      </IntegrationCard>
    </div>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
        ok ? "border-emerald-soft/25 bg-emerald-soft/8 text-emerald-soft" : "border-rose-soft/25 bg-rose-soft/8 text-rose-soft"
      )}
    >
      {ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      {text}
    </div>
  );
}
