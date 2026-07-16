"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, Wallet, PencilLine, Target, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn, fmtEUR, fmtEUR0, fmtNum } from "@/lib/utils";

type Data = {
  accounts: Array<{ id: string; name: string; balance: number; iban: string | null }>;
  accountId: string | null;
  manual: boolean;
  manualBalance: number;
  target: number;
  balance: number;
  configured: boolean;
  monthsOfExpenses: number;
};

export default function EmergencyPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [mode, setMode] = useState<"account" | "manual">("manual");
  const [accountId, setAccountId] = useState("");
  const [manualBalance, setManualBalance] = useState("");
  const [target, setTarget] = useState("");
  const [months, setMonths] = useState("3");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      fetch("/api/emergency").then((r) => r.json()),
      fetch("/api/summary").then((r) => r.json()).catch(() => null),
    ]);
    setData(d);
    setMode(d.accountId ? "account" : "manual");
    setAccountId(d.accountId ?? "");
    setManualBalance(d.manualBalance ? String(d.manualBalance).replace(".", ",") : "");
    setTarget(d.target ? String(d.target).replace(".", ",") : "");
    setMonths(d.monthsOfExpenses ? String(d.monthsOfExpenses) : "3");
    if (s) setMonthlySpending(s.stats?.avgSpent ?? s.thisMonth?.spent ?? 0);
  }, []);
  useEffect(() => { load(); }, [load]);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  const save = async () => {
    setBusy(true);
    await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: mode === "account" ? accountId || null : null,
        manualBalance: mode === "manual" ? num(manualBalance) : undefined,
        target: num(target),
        monthsOfExpenses: Number(months) || 0,
      }),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    load();
  };

  if (!data) return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Notgroschen …")}</div>;

  const suggested = monthlySpending > 0 ? Math.round(monthlySpending * (Number(months) || 3)) : 0;
  const pct = data.target > 0 ? Math.min(100, (data.balance / data.target) * 100) : 0;
  const reached = data.target > 0 && data.balance >= data.target;
  const monthsCovered = monthlySpending > 0 ? data.balance / monthlySpending : null;

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-4xl gold-text">{t("Notgroschen")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-2">
          {t("Zweckgebundene Rücklage für den Notfall. Sie wird aus dem FIRE-Startkapital herausgerechnet — dieses Geld soll nicht investiert werden.")}
        </p>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-hover rise rise-1 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Aktueller Stand")}</div>
          <div className="num mt-2 text-2xl font-semibold">{fmtEUR(data.balance)}</div>
          <div className="mt-1 text-xs text-muted-2">
            {data.accountId
              ? data.accounts.find((a) => a.id === data.accountId)?.name
              : data.manualBalance > 0 ? t("manuell gepflegt") : t("noch nichts erfasst")}
          </div>
        </Card>
        <Card className="glass-hover rise rise-2 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Ziel")}</div>
          <div className="num mt-2 text-2xl font-semibold">{data.target > 0 ? fmtEUR0(data.target) : "—"}</div>
          <div className="mt-1 text-xs" style={{ color: reached ? "#34d399" : undefined }}>
            {data.target > 0
              ? reached ? t("Ziel erreicht") : t("{amount} fehlen", { amount: fmtEUR0(data.target - data.balance) })
              : t("kein Ziel gesetzt")}
          </div>
        </Card>
        <Card className="glass-hover rise rise-3 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Reichweite")}</div>
          <div className="num mt-2 text-2xl font-semibold">
            {monthsCovered !== null ? t("{n} Monate", { n: fmtNum(monthsCovered, 1) }) : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-2">
            {monthsCovered !== null ? t("bei Ø {amount}/Monat", { amount: fmtEUR0(monthlySpending) }) : t("keine Ausgaben erfasst")}
          </div>
        </Card>
      </div>

      {data.target > 0 && (
        <Card className="rise rise-2 p-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">{t("Fortschritt")}</span>
            <span className="num font-semibold" style={{ color: reached ? "#34d399" : "#38bdf8" }}>{fmtNum(pct, 1)} %</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: reached ? "linear-gradient(90deg, #34d39990, #34d399)" : "linear-gradient(90deg, #38bdf890, #38bdf8)",
                boxShadow: reached ? "0 0 20px #34d39960" : "0 0 20px #38bdf860",
              }}
            />
          </div>
        </Card>
      )}

      {/* Einrichtung */}
      <Card className="rise rise-4">
        <CardHeader className="flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-soft/10 border border-emerald-soft/20">
            <ShieldCheck className="h-5 w-5 text-emerald-soft" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Einrichtung")}</CardTitle>
            <div className="text-xs text-muted-2">{t("Woher der Stand kommt und wie hoch das Ziel ist")}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Quelle */}
          <div>
            <div className="mb-2 text-sm text-muted">{t("Quelle des Stands")}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => setMode("manual")}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 text-left transition-all",
                  mode === "manual" ? "border-gold/40 bg-gold/8" : "border-white/10 hover:border-white/20"
                )}
              >
                <PencilLine className={cn("h-4 w-4", mode === "manual" ? "text-gold" : "text-muted-2")} strokeWidth={1.8} />
                <div className={cn("mt-2 text-sm font-medium", mode === "manual" ? "text-gold-bright" : "text-foreground")}>
                  {t("Betrag selbst eintragen")}
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-2">
                  {t("Für Rücklagen, die die App nicht sieht — Tagesgeld bei einer anderen Bank, Bargeld, Bausparer.")}
                </div>
              </button>
              <button
                onClick={() => setMode("account")}
                disabled={data.accounts.length === 0}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  mode === "account" ? "border-gold/40 bg-gold/8" : "border-white/10 hover:border-white/20"
                )}
              >
                <Wallet className={cn("h-4 w-4", mode === "account" ? "text-gold" : "text-muted-2")} strokeWidth={1.8} />
                <div className={cn("mt-2 text-sm font-medium", mode === "account" ? "text-gold-bright" : "text-foreground")}>
                  {t("Konto zuweisen")}
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-2">
                  {data.accounts.length === 0
                    ? t("Noch keine Konten vorhanden — verbinde zuerst eine Bank oder importiere eine CSV.")
                    : t("Der Stand kommt automatisch vom Konto und wird aus der Liquidität herausgerechnet.")}
                </div>
              </button>
            </div>
          </div>

          {mode === "account" ? (
            <div className="space-y-1.5">
              <Label>{t("Konto")}</Label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">{t("— keines —")}</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({fmtEUR0(a.balance)})</option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 sm:w-1/2">
              <Label>{t("Aktueller Stand (€)")}</Label>
              <Input inputMode="decimal" placeholder="10.000" value={manualBalance} onChange={(e) => setManualBalance(e.target.value)} />
            </div>
          )}

          {/* Ziel */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> {t("Monatsausgaben abdecken")}</Label>
              <Select value={months} onChange={(e) => setMonths(e.target.value)}>
                {[3, 4, 5, 6, 9, 12].map((m) => <option key={m} value={m}>{t("{n} Monate", { n: m })}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Target className="h-3 w-3" /> {t("Zielbetrag (€)")}</Label>
              <Input inputMode="decimal" placeholder="10.000" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>

          {suggested > 0 && (
            <button
              onClick={() => setTarget(String(suggested).replace(".", ","))}
              className="w-full cursor-pointer rounded-xl border border-gold/25 bg-gold/8 px-3 py-2.5 text-left text-[11px] text-gold-bright hover:bg-gold/12"
            >
              {t("Vorschlag aus deinen Ausgaben: {amount} ({n} × {monthly}) — übernehmen", {
                amount: fmtEUR0(suggested), n: months, monthly: fmtEUR0(monthlySpending),
              })}
            </button>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>{busy ? t("Speichern …") : t("Speichern")}</Button>
            {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-soft"><CheckCircle2 className="h-4 w-4" /> {t("Gespeichert")}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
