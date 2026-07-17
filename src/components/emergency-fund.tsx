"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Pencil, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, fmtEUR, fmtEUR0, fmtNum } from "@/lib/utils";

type Data = {
  accounts: Array<{ id: string; name: string; balance: number; iban: string | null }>;
  accountId: string | null;
  target: number;
  balance: number;
  monthsOfExpenses: number;
};

/** Notgroschen: ein Konto zweckbinden, Ziel setzen, Fortschritt sehen. */
export function EmergencyFund({ monthlySpending, onChange }: { monthlySpending: number; onChange?: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [target, setTarget] = useState("");
  const [months, setMonths] = useState("3");
  const [busy, setBusy] = useState(false);

  const load = () =>
    apiJson<Data>("/api/emergency").then((d) => {
      setData(d);
      setAccountId(d.accountId ?? "");
      setTarget(d.target ? String(d.target).replace(".", ",") : "");
      setMonths(d.monthsOfExpenses ? String(d.monthsOfExpenses) : "3");
    });
  useEffect(() => { load(); }, []);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));

  const save = async () => {
    setBusy(true);
    await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: accountId || null,
        target: target ? num(target) : 0,
        monthsOfExpenses: Number(months) || 0,
      }),
    });
    setBusy(false);
    setOpen(false);
    load();
    onChange?.();
  };

  // Zielvorschlag aus den echten Ausgaben — meist aussagekräftiger als eine runde Zahl
  const suggested = monthlySpending > 0 ? Math.round(monthlySpending * (Number(months) || 3)) : 0;

  if (!data) return null;

  const configured = Boolean(data.accountId);
  const pct = data.target > 0 ? Math.min(100, (data.balance / data.target) * 100) : 0;
  const reached = data.target > 0 && data.balance >= data.target;
  const monthsCovered = monthlySpending > 0 ? data.balance / monthlySpending : null;

  return (
    <>
      <Card className="glass-hover rise rise-2">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-soft/10 border border-emerald-soft/20">
              <ShieldCheck className="h-5 w-5 text-emerald-soft" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Notgroschen")}</CardTitle>
              <div className="text-xs text-muted-2">
                {configured
                  ? data.accounts.find((a) => a.id === data.accountId)?.name
                  : t("Kein Konto zugewiesen")}
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/8 hover:text-foreground cursor-pointer"
            title={t("Einrichten")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <div className="py-2">
              <p className="text-sm leading-relaxed text-muted">
                {t("Weise ein Konto als Notgroschen zu. Es wird dann aus dem FIRE-Startkapital ausgenommen — zweckgebundenes Geld sollte nicht als investierbares Vermögen zählen.")}
              </p>
              <Button variant="glass" size="sm" className="mt-3" onClick={() => setOpen(true)}>
                {t("Notgroschen einrichten")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="num text-2xl font-semibold">{fmtEUR(data.balance)}</div>
                  {data.target > 0 && (
                    <div className="mt-0.5 text-xs text-muted-2">
                      {t("Ziel {amount}", { amount: fmtEUR0(data.target) })}
                      {!reached && ` · ${t("{amount} fehlen", { amount: fmtEUR0(data.target - data.balance) })}`}
                    </div>
                  )}
                </div>
                {reached && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-soft">
                    <CheckCircle2 className="h-4 w-4" /> {t("Ziel erreicht")}
                  </span>
                )}
              </div>

              {data.target > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: reached
                        ? "linear-gradient(90deg, #34d39990, #34d399)"
                        : "linear-gradient(90deg, #38bdf890, #38bdf8)",
                      boxShadow: reached ? "0 0 12px #34d39960" : "0 0 12px #38bdf860",
                    }}
                  />
                </div>
              )}

              {monthsCovered !== null && (
                <div className="mt-2 text-[11px] text-muted-2">
                  {t("Deckt {n} Monate deiner aktuellen Ausgaben", { n: fmtNum(monthsCovered, 1) })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("Notgroschen einrichten")}</DialogTitle>
          <DialogDescription>
            {t("Das gewählte Konto gilt als zweckgebunden und wird aus dem FIRE-Startkapital herausgerechnet.")}
          </DialogDescription>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Konto")}</Label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">{t("— keines —")}</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({fmtEUR0(a.balance)})</option>
                ))}
              </Select>
              {data.accounts.length === 0 && (
                <p className="text-[11px] text-amber-400">
                  {t("Noch keine Konten vorhanden — verbinde zuerst eine Bank oder importiere eine CSV.")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("Monatsausgaben abdecken")}</Label>
                <Select value={months} onChange={(e) => setMonths(e.target.value)}>
                  {[3, 4, 5, 6, 9, 12].map((m) => (
                    <option key={m} value={m}>{t("{n} Monate", { n: m })}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Zielbetrag (€)")}</Label>
                <Input inputMode="decimal" placeholder="10.000" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            </div>

            {suggested > 0 && (
              <button
                onClick={() => setTarget(String(suggested).replace(".", ","))}
                className="w-full cursor-pointer rounded-xl border border-gold/25 bg-gold/8 px-3 py-2.5 text-left text-[11px] text-gold-bright hover:bg-gold/12"
              >
                {t("Vorschlag aus deinen Ausgaben: {amount} ({n} × {monthly}) — übernehmen", {
                  amount: fmtEUR0(suggested),
                  n: months,
                  monthly: fmtEUR0(monthlySpending),
                })}
              </button>
            )}
          </div>
          <Button className="mt-6 w-full" onClick={save} disabled={busy}>
            {busy ? t("Speichern …") : t("Speichern")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
