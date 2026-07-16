"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Layers, CalendarClock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn, fmtEUR, fmtEUR0, fmtNum, fmtDate } from "@/lib/utils";

type Row = {
  id: number; symbol: string; name: string | null; weight_pct: number; valueEur: number;
  quote: { price: number; currency: string; changePct: number | null; name: string | null; stale: boolean } | null;
};
type Data = {
  allocation: Row[]; totalWeight: number; balance: number;
  startDate: string | null; monthly: number; monthsSinceStart: number;
  contributedEstimate: number; gainEstimate: number | null;
};

const COLORS = ["#d4af37", "#38bdf8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#e879f9"];

/** Fondsaufteilung der Vorsorge: ETFs mit prozentualer Gewichtung + Einzahlungsbeginn. */
export function PensionAllocation({ onChange }: { onChange?: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [symbol, setSymbol] = useState("");
  const [weight, setWeight] = useState("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/pension/allocation").then((r) => r.json()).then((d: Data) => {
      setData(d);
      setStartDate(d.startDate ?? "");
    });
  useEffect(() => { load(); }, []);

  const add = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pension/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, weight_pct: parseFloat(weight.replace(",", ".")) }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setSymbol("");
    setWeight("");
    load();
    onChange?.();
  };

  const setWeightFor = async (id: number, value: number) => {
    setError(null);
    const res = await fetch("/api/pension/allocation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, weight_pct: value }),
    });
    if (!res.ok) { setError((await res.json()).error); return; }
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/pension/allocation?id=${id}`, { method: "DELETE" });
    load();
  };

  const saveStart = async (value: string) => {
    setStartDate(value);
    await fetch("/api/pension/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: value }),
    });
    load();
  };

  if (!data) return null;

  const remaining = Math.round((100 - data.totalWeight) * 10) / 10;
  const complete = Math.abs(data.totalWeight - 100) < 0.05;

  return (
    <Card className="rise rise-4">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-soft/10 border border-violet-soft/20">
            <Layers className="h-5 w-5 text-violet-soft" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Fondsaufteilung")}</CardTitle>
            <div className="text-xs text-muted-2">{t("Worin deine Vorsorge angelegt ist")}</div>
          </div>
        </div>
        <span className={cn("num text-xs font-semibold", complete ? "text-emerald-soft" : "text-amber-400")}>
          {fmtNum(data.totalWeight, 1)} %
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Einzahlungsbeginn */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" /> {t("Einzahlungen seit")}
            </Label>
            <Input type="date" value={startDate} onChange={(e) => saveStart(e.target.value)} />
          </div>
          {data.startDate && data.monthly > 0 && (
            <div className="glass-inset flex flex-col justify-center rounded-xl px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-2">
                {t("Eingezahlt (geschätzt)")}
              </div>
              <div className="num text-sm font-semibold">
                {fmtEUR0(data.contributedEstimate)}
                <span className="ml-1.5 text-[11px] font-normal text-muted-2">
                  {t("in {n} Monaten", { n: data.monthsSinceStart })}
                </span>
              </div>
              {data.gainEstimate !== null && (
                <div className="text-[11px]" style={{ color: data.gainEstimate >= 0 ? "#34d399" : "#fb7185" }}>
                  {data.gainEstimate >= 0 ? "+" : ""}{fmtEUR0(data.gainEstimate)} {t("Wertzuwachs")}
                </div>
              )}
            </div>
          )}
        </div>

        {data.allocation.length > 0 && (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.allocation} dataKey="weight_pct" nameKey="symbol" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                    {data.allocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase tracking-widest text-muted-2">{t("Guthaben")}</span>
                <span className="num text-sm font-semibold">{fmtEUR0(data.balance)}</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              {data.allocation.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.name || a.quote?.name || a.symbol}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-2">
                      <span>{a.symbol}</span>
                      {a.quote && (
                        <span style={{ color: (a.quote.changePct ?? 0) >= 0 ? "#34d399" : "#fb7185" }}>
                          {fmtNum(a.quote.price)} {a.quote.currency}
                          {a.quote.changePct !== null && ` (${a.quote.changePct >= 0 ? "+" : ""}${fmtNum(a.quote.changePct, 1)} %)`}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number" min={0.1} max={100} step={0.1}
                    defaultValue={a.weight_pct}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v && v !== a.weight_pct) setWeightFor(a.id, v);
                    }}
                    className="num w-16 rounded-lg glass-inset px-2 py-1 text-right text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                  />
                  <span className="text-[10px] text-muted-2">%</span>
                  <span className="num w-20 shrink-0 text-right text-xs font-medium">{fmtEUR0(a.valueEur)}</span>
                  <button
                    onClick={() => remove(a.id)}
                    className="rounded-lg p-1 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer"
                    title={t("Entfernen")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!complete && data.allocation.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-[11px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {remaining > 0
              ? t("Noch {n} % nicht zugeordnet.", { n: fmtNum(remaining, 1) })
              : t("Gewichtung übersteigt 100 %.")}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-soft/25 bg-rose-soft/8 px-3 py-2 text-[11px] text-rose-soft">{error}</div>
        )}

        {/* Fonds hinzufügen */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1 space-y-1.5">
            <Label>{t("ETF-Symbol (Yahoo-Format)")}</Label>
            <Input
              className="h-9 text-xs"
              placeholder="IWDA.AS"
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label>{t("Gewicht %")}</Label>
            <Input
              className="h-9 text-xs"
              inputMode="decimal"
              placeholder={remaining > 0 ? String(remaining).replace(".", ",") : "50"}
              value={weight}
              onChange={(e) => { setWeight(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <Button variant="glass" size="sm" disabled={busy || !symbol || !weight} onClick={add}>
            {busy ? t("Prüfe …") : <><Plus className="h-3.5 w-3.5" /> {t("Hinzufügen")}</>}
          </Button>
        </div>

        {data.allocation.length === 0 && (
          <p className="text-[11px] leading-relaxed text-muted-2">
            {t("Trage die Fonds deiner Vorsorge mit ihrer Gewichtung ein — der Anteil am Guthaben und die Live-Kurse erscheinen dann hier.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
