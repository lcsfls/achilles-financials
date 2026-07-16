"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Sparkles, Database, KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [secretId, setSecretId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [country, setCountry] = useState("DE");
  const [startMode, setStartMode] = useState<"demo" | "empty">("demo");
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        country,
        gcSecretId: secretId || undefined,
        gcSecretKey: secretKey || undefined,
        setupDone: true,
      }),
    });
    if (startMode === "demo") await fetch("/api/demo", { method: "POST" });
    router.replace("/");
  };

  const STEPS = [t("Sprache"), "GoCardless", "Start"];

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="rise w-full max-w-xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e9cd6f] to-[#9a7a26] shadow-[0_16px_40px_-10px_rgba(212,175,55,0.6)]">
            <Shield className="h-8 w-8 text-[#1a1405]" strokeWidth={2} />
          </div>
          <div>
            <div className="font-display text-3xl gold-text">Achilles Financials</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-2">Private Wealth Dashboard</div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                  i < step ? "border-gold/40 bg-gold/20 text-gold-bright"
                    : i === step ? "border-gold bg-gold text-[#1a1405]"
                    : "border-white/15 text-muted-2"
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px w-10", i < step ? "bg-gold/50" : "bg-white/10")} />}
            </div>
          ))}
        </div>

        <div className="glass rounded-glass p-8">
          {/* Step 0: Sprache */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-center text-lg font-semibold">{t("Sprache wählen / Choose your language")}</h2>
              <div className="grid grid-cols-2 gap-4">
                {([["de", "Deutsch", "🇩🇪"], ["en", "English", "🇬🇧"]] as Array<[Lang, string, string]>).map(([code, label, flag]) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-6 text-center transition-all",
                      lang === code
                        ? "border-gold/50 bg-gold/10 shadow-[0_0_32px_-8px_rgba(212,175,55,0.5)]"
                        : "border-white/10 hover:border-white/25"
                    )}
                  >
                    <div className="text-3xl">{flag}</div>
                    <div className={cn("mt-2 text-sm font-medium", lang === code ? "text-gold-bright" : "text-muted")}>{label}</div>
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(1)}>{t("Weiter")}</Button>
            </div>
          )}

          {/* Step 1: GoCardless (optional) */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
                  <KeyRound className="h-5 w-5 text-gold" strokeWidth={1.7} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("Revolut-Verbindung (optional)")}</h2>
                  <p className="text-xs text-muted-2">{t("Secret ID & Key aus deinem GoCardless-Account (bankaccountdata.gocardless.com, kostenlos).")}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Secret ID</Label>
                  <Input placeholder="1c8d4c0e-…" value={secretId} onChange={(e) => setSecretId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Secret Key</Label>
                  <Input type="password" placeholder="Secret Key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
                </div>
                <div className="space-y-1.5">
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
              </div>
              <p className="text-[11px] leading-relaxed text-muted-2">
                {t("Du kannst das jederzeit später in den Einstellungen nachholen — oder Kontoauszüge per CSV importieren.")}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>{t("Zurück")}</Button>
                <Button className="flex-1" onClick={() => setStep(2)}>
                  {secretId && secretKey ? t("Weiter") : t("Überspringen")}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Start mode */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-center text-lg font-semibold">{t("Wie möchtest du starten?")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setStartMode("demo")}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-6 text-left transition-all",
                    startMode === "demo" ? "border-gold/50 bg-gold/10 shadow-[0_0_32px_-8px_rgba(212,175,55,0.5)]" : "border-white/10 hover:border-white/25"
                  )}
                >
                  <Sparkles className={cn("h-6 w-6", startMode === "demo" ? "text-gold" : "text-muted-2")} strokeWidth={1.6} />
                  <div className={cn("mt-3 text-sm font-medium", startMode === "demo" ? "text-gold-bright" : "text-foreground")}>{t("Mit Demo-Daten erkunden")}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-2">{t("Realistische Beispieldaten — jederzeit in den Einstellungen entfernbar.")}</div>
                </button>
                <button
                  onClick={() => setStartMode("empty")}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-6 text-left transition-all",
                    startMode === "empty" ? "border-gold/50 bg-gold/10 shadow-[0_0_32px_-8px_rgba(212,175,55,0.5)]" : "border-white/10 hover:border-white/25"
                  )}
                >
                  <Database className={cn("h-6 w-6", startMode === "empty" ? "text-gold" : "text-muted-2")} strokeWidth={1.6} />
                  <div className={cn("mt-3 text-sm font-medium", startMode === "empty" ? "text-gold-bright" : "text-foreground")}>{t("Leer starten")}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-2">{t("Direkt mit deinen echten Daten loslegen.")}</div>
                </button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={busy}>{t("Zurück")}</Button>
                <Button className="flex-1" onClick={finish} disabled={busy}>
                  {busy ? t("Einen Moment …") : t("Los geht's")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
