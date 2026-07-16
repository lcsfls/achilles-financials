"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Wallet, Gem, TrendingUp, ArrowDownRight, QrCode, Sparkles, RefreshCw, PiggyBank } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS } from "@/lib/categorize";
import { EmergencyFund } from "@/components/emergency-fund";
import { useI18n } from "@/lib/i18n";
import { cn, fmtEUR, fmtEUR0, fmtDate, fmtPct } from "@/lib/utils";

type Summary = {
  accounts: Array<{ id: string; name: string; balance: number; iban: string | null; last_synced: string | null }>;
  cashTotal: number;
  monthly: Array<{ month: string; spent: number; earned: number }>;
  thisMonthCats: Array<{ category: string; total: number; count: number }>;
  thisMonth: { spent: number; earned: number };
  lastMonthSpent: number;
  recent: Array<{ id: string; booking_date: string; amount: number; merchant: string | null; description: string | null; category: string }>;
  metals: { totalValue: number; totalCost: number; holdings: Array<{ metal: string; name: string; color: string; totalGrams: number; currentValue: number | null; totalCost: number }> };
  investments: { value: number; cost: number; count: number };
  pension: { value: number; lastDate: string | null };
  emergency: { accountId: string; accountName: string; balance: number; target: number; pct: number | null } | null;
  netWorth: number;
  demoMode: boolean;
  lastSync: string | null;
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 text-xs">
      <div className="mb-1.5 font-medium text-muted">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-semibold">{fmtEUR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => fetch("/api/summary").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const monthShort = (m: number) =>
    new Date(2000, m, 1).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { month: "short" });

  if (loading || !data) {
    return <div className="flex h-[70vh] items-center justify-center text-muted-2 text-sm animate-pulse">{t("Portfolio wird geladen …")}</div>;
  }

  const empty = data.accounts.length === 0 && data.metals.holdings.length === 0;

  if (empty) {
    return (
      <div className="flex h-[75vh] flex-col items-center justify-center text-center">
        <div className="rise glass flex max-w-md flex-col items-center gap-5 rounded-glass p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e9cd6f] to-[#9a7a26] shadow-[0_16px_40px_-10px_rgba(212,175,55,0.6)]">
            <Sparkles className="h-7 w-7 text-[#1a1405]" />
          </div>
          <h1 className="font-display text-3xl gold-text">{t("Willkommen bei Achilles")}</h1>
          <p className="text-sm leading-relaxed text-muted">
            {t("Verbinde dein Konto per QR-Code oder starte mit Demo-Daten, um das Dashboard zu erkunden.")}
          </p>
          <div className="flex gap-3">
            <Link href="/connect"><Button><QrCode className="h-4 w-4" /> {t("Konto verbinden")}</Button></Link>
            <Button variant="glass" onClick={async () => { setLoading(true); await fetch("/api/demo", { method: "POST" }); load(); }}>
              {t("Demo-Daten laden")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const spendDelta = data.lastMonthSpent > 0 ? ((data.thisMonth.spent - data.lastMonthSpent) / data.lastMonthSpent) * 100 : 0;
  const metalsPL = data.metals.totalValue - data.metals.totalCost;
  const invPL = data.investments.value - data.investments.cost;

  const monthlyData = data.monthly.map((m) => ({
    ...m,
    label: monthShort(Number(m.month.slice(5)) - 1),
  }));

  const donutData = data.thisMonthCats.slice(0, 7);
  const donutRest = data.thisMonthCats.slice(7).reduce((s, c) => s + c.total, 0);
  if (donutRest > 0) donutData.push({ category: "Weitere", total: donutRest, count: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted-2">{t("Gesamtvermögen")}</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num font-display text-5xl font-semibold gold-text sm:text-6xl">{fmtEUR0(data.netWorth)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.demoMode && <Badge color="#a78bfa">{t("Demo-Modus")}</Badge>}
          {data.lastSync && <span className="text-xs text-muted-2">{t("Sync: {date}", { date: fmtDate(data.lastSync) })}</span>}
          <Button variant="glass" size="sm" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("Aktualisieren")}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {[
          {
            icon: Wallet, label: t("Liquidität"), value: fmtEUR(data.cashTotal),
            sub: data.accounts.length === 1 ? t("1 Konto") : t("{n} Konten", { n: data.accounts.length }), accent: "#38bdf8", delay: "rise-1",
          },
          {
            icon: ArrowDownRight, label: t("Ausgaben diesen Monat"), value: fmtEUR(data.thisMonth.spent),
            sub: t("{pct} vs. Vormonat", { pct: fmtPct(spendDelta) }), accent: spendDelta > 0 ? "#fb7185" : "#34d399", delay: "rise-2",
            subColor: spendDelta > 0 ? "#fb7185" : "#34d399",
          },
          {
            icon: Gem, label: t("Edelmetalle"), value: fmtEUR(data.metals.totalValue),
            sub: t("{amount} unrealisiert", { amount: `${metalsPL >= 0 ? "+" : ""}${fmtEUR(metalsPL)}` }), accent: "#d4af37", delay: "rise-3",
            subColor: metalsPL >= 0 ? "#34d399" : "#fb7185",
          },
          {
            icon: TrendingUp, label: t("Investments"), value: fmtEUR(data.investments.value),
            sub: t("{amount} unrealisiert", { amount: `${invPL >= 0 ? "+" : ""}${fmtEUR(invPL)}` }), accent: "#a78bfa", delay: "rise-4",
            subColor: invPL >= 0 ? "#34d399" : "#fb7185",
          },
          {
            icon: PiggyBank, label: t("Altersvorsorge"), value: fmtEUR(data.pension.value),
            sub: data.pension.lastDate ? t("Auszug vom {date}", { date: fmtDate(data.pension.lastDate) }) : t("noch kein Auszug erfasst"),
            accent: "#34d399", delay: "rise-5",
          },
        ].map(({ icon: Icon, label, value, sub, accent, delay, subColor }) => (
          <Card key={label} className={cn("glass-hover rise p-6", delay)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{label}</div>
                <div className="num mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                <div className="mt-1 text-xs" style={{ color: subColor ?? "var(--color-muted-2)" }}>{sub}</div>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
                <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.8} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="rise rise-3 xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Cashflow · letzte Monate")}</CardTitle>
            <div className="flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4af37]" /> {t("Einnahmen")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#fb7185]" /> {t("Ausgaben")}</span>
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="gEarn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} />
                <YAxis axisLine={false} tickLine={false} width={54} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="earned" name={t("Einnahmen")} stroke="#d4af37" strokeWidth={2} fill="url(#gEarn)" />
                <Area type="monotone" dataKey="spent" name={t("Ausgaben")} stroke="#fb7185" strokeWidth={2} fill="url(#gSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rise rise-4 xl:col-span-2">
          <CardHeader><CardTitle>{t("Ausgaben nach Kategorie · {month}", { month: monthShort(new Date().getMonth()) })}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="relative h-[190px] w-[190px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="total" nameKey="category" innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                      {donutData.map((c) => (
                        <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? "#6b7280"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest text-muted-2">{t("Gesamt")}</span>
                  <span className="num text-lg font-semibold">{fmtEUR0(data.thisMonth.spent)}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {donutData.slice(0, 6).map((c) => (
                  <div key={c.category} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[c.category] ?? "#6b7280" }} />
                      <span className="truncate">{t(c.category)}</span>
                    </span>
                    <span className="num font-medium">{fmtEUR0(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="rise rise-4 xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Letzte Transaktionen")}</CardTitle>
            <Link href="/transactions" className="text-xs text-gold-bright hover:underline">{t("Alle ansehen →")}</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recent.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{tx.merchant || tx.description || "—"}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-2">
                    {fmtDate(tx.booking_date)}
                    <Badge color={CATEGORY_COLORS[tx.category] ?? "#6b7280"}>{t(tx.category)}</Badge>
                  </div>
                </div>
                <span className={cn("num shrink-0 text-sm font-semibold", tx.amount > 0 ? "text-emerald-soft" : "text-foreground")}>
                  {tx.amount > 0 ? "+" : ""}{fmtEUR(tx.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
        <EmergencyFund monthlySpending={data.thisMonth.spent} onChange={load} />
        <Card className="rise rise-5">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Edelmetall-Allokation")}</CardTitle>
            <Link href="/metals" className="text-xs text-gold-bright hover:underline">{t("Details →")}</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.metals.holdings.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-2">{t("Noch keine Edelmetalle erfasst.")}</p>
            )}
            {data.metals.holdings.map((h) => {
              const pct = data.metals.totalValue > 0 && h.currentValue ? (h.currentValue / data.metals.totalValue) * 100 : 0;
              const pl = (h.currentValue ?? 0) - h.totalCost;
              return (
                <div key={h.metal}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: h.color, boxShadow: `0 0 12px ${h.color}80` }} />
                      {t(h.name)}
                      <span className="text-xs text-muted-2">{h.totalGrams.toLocaleString(lang === "de" ? "de-DE" : "en-US")} g</span>
                    </span>
                    <span className="num font-semibold">{h.currentValue !== null ? fmtEUR0(h.currentValue) : "—"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${h.color}90, ${h.color})` }} />
                  </div>
                  <div className="mt-1 text-right text-[11px]" style={{ color: pl >= 0 ? "#34d399" : "#fb7185" }}>
                    {pl >= 0 ? "+" : ""}{fmtEUR0(pl)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
