"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Flame, Target, CalendarClock, Coins } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtEUR0, fmtNum } from "@/lib/utils";

type Params = {
  age: number;
  monthlySavings: number;
  annualReturnPct: number;
  inflationPct: number;
  withdrawalRatePct: number;
  monthlyExpenses: number;
  startNetWorth: number | null;
};

export default function FirePage() {
  const { t } = useI18n();
  const [params, setParams] = useState<Params | null>(null);
  const [autoNetWorth, setAutoNetWorth] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SLIDERS: Array<{
    key: keyof Params; label: string; min: number; max: number; step: number;
    fmt: (v: number) => string;
  }> = [
    { key: "age", label: t("Aktuelles Alter"), min: 18, max: 70, step: 1, fmt: (v) => t("{n} Jahre", { n: v }) },
    { key: "monthlySavings", label: t("Sparrate / Monat"), min: 0, max: 10000, step: 50, fmt: (v) => fmtEUR0(v) },
    { key: "monthlyExpenses", label: t("Wunsch-Ausgaben im Ruhestand / Monat (heutige Kaufkraft)"), min: 500, max: 15000, step: 100, fmt: (v) => fmtEUR0(v) },
    { key: "annualReturnPct", label: t("Erwartete Rendite p. a."), min: 0, max: 12, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "inflationPct", label: t("Inflation p. a."), min: 0, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "withdrawalRatePct", label: t("Entnahmerate (SWR)"), min: 2, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
  ];

  useEffect(() => {
    Promise.all([
      fetch("/api/fire").then((r) => r.json()),
      fetch("/api/summary").then((r) => r.json()),
    ]).then(([f, s]) => {
      setAutoNetWorth(s.netWorth ?? 0);
      setParams(f.params);
    });
  }, []);

  const update = (patch: Partial<Params>) => {
    setParams((p) => {
      const next = { ...p!, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/api/fire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      }, 600);
      return next;
    });
  };

  const sim = useMemo(() => {
    if (!params) return null;
    const start = params.startNetWorth ?? autoNetWorth;
    const fireNumber = (params.monthlyExpenses * 12) / (params.withdrawalRatePct / 100);
    // Realrendite (inflationsbereinigt) — alles in heutiger Kaufkraft
    const realAnnual = (1 + params.annualReturnPct / 100) / (1 + params.inflationPct / 100) - 1;
    const monthlyR = Math.pow(1 + realAnnual, 1 / 12) - 1;

    const MAX_MONTHS = 12 * 60;
    let value = start;
    let fireMonth: number | null = value >= fireNumber ? 0 : null;
    const series: Array<{ year: number; age: number; value: number }> = [{ year: 0, age: params.age, value }];

    for (let m = 1; m <= MAX_MONTHS; m++) {
      value = value * (1 + monthlyR) + params.monthlySavings;
      if (fireMonth === null && value >= fireNumber) fireMonth = m;
      if (m % 12 === 0) series.push({ year: m / 12, age: params.age + m / 12, value: Math.round(value) });
      if (fireMonth !== null && m >= fireMonth + 12 * 6 && m % 12 === 0 && series.length > 8) break;
    }

    const yearsToFire = fireMonth !== null ? fireMonth / 12 : null;
    return {
      start,
      fireNumber,
      yearsToFire,
      fireAge: yearsToFire !== null ? params.age + yearsToFire : null,
      fireDate: fireMonth !== null ? new Date(Date.now() + fireMonth * 30.44 * 24 * 3600 * 1000) : null,
      progressPct: fireNumber > 0 ? Math.min(100, (start / fireNumber) * 100) : 0,
      series,
      realAnnual: realAnnual * 100,
    };
  }, [params, autoNetWorth]);

  if (!params || !sim) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Simulator …")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="font-display text-4xl gold-text">{t("FIRE-Simulator")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-2">
          {t("Financial Independence, Retire Early — alle Werte inflationsbereinigt in heutiger Kaufkraft (Realrendite {pct} % p. a.).", { pct: fmtNum(sim.realAnnual, 1) })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Target, label: t("FIRE-Zahl"), value: fmtEUR0(sim.fireNumber), sub: t("bei {pct} % Entnahme", { pct: fmtNum(params.withdrawalRatePct, 1) }), accent: "#d4af37" },
          {
            icon: Flame, label: t("Zeit bis FIRE"),
            value: sim.yearsToFire === null ? t("> 60 J.") : sim.yearsToFire === 0 ? t("Erreicht 🎉") : t("{n} Jahre", { n: fmtNum(sim.yearsToFire, 1) }),
            sub: sim.fireAge !== null && sim.yearsToFire !== 0 ? t("mit {age} Jahren ({year})", { age: Math.round(sim.fireAge), year: sim.fireDate!.getFullYear() }) : "",
            accent: "#fb923c",
          },
          { icon: Coins, label: t("Startkapital"), value: fmtEUR0(sim.start), sub: params.startNetWorth === null ? t("automatisch aus Portfolio") : t("manuell gesetzt"), accent: "#38bdf8" },
          { icon: CalendarClock, label: t("Fortschritt"), value: `${fmtNum(sim.progressPct, 1)} %`, sub: t("{amount} fehlen", { amount: fmtEUR0(Math.max(0, sim.fireNumber - sim.start)) }), accent: "#a78bfa" },
        ].map(({ icon: Icon, label, value, sub, accent }, i) => (
          <Card key={label} className={`glass-hover rise rise-${i + 1} p-6`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{label}</div>
                <div className="num mt-2 text-2xl font-semibold tracking-tight">{value}</div>
                <div className="mt-1 text-xs text-muted-2">{sub}</div>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
                <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.8} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      <Card className="rise rise-2 p-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">{t("Weg zur finanziellen Freiheit")}</span>
          <span className="num font-semibold">{fmtEUR0(sim.start)} / {fmtEUR0(sim.fireNumber)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${sim.progressPct}%`,
              background: "linear-gradient(90deg, #b8912e, #d4af37, #f5e199)",
              boxShadow: "0 0 20px rgba(212,175,55,0.5)",
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Sliders */}
        <Card className="rise rise-3 xl:col-span-2">
          <CardHeader><CardTitle>{t("Parameter")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {SLIDERS.map(({ key, label, min, max, step, fmt }) => (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="num font-semibold text-gold-bright">{fmt(params[key] as number)}</span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={params[key] as number}
                  onChange={(e) => update({ [key]: Number(e.target.value) } as Partial<Params>)}
                  className="w-full accent-[#d4af37] cursor-pointer"
                />
              </div>
            ))}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">{t("Startkapital überschreiben")}</span>
                <button
                  className="text-xs text-gold-bright hover:underline cursor-pointer"
                  onClick={() => update({ startNetWorth: params.startNetWorth === null ? Math.round(autoNetWorth) : null })}
                >
                  {params.startNetWorth === null ? t("manuell setzen") : t("auf automatisch zurück")}
                </button>
              </div>
              {params.startNetWorth !== null && (
                <input
                  type="range" min={0} max={2000000} step={5000}
                  value={params.startNetWorth}
                  onChange={(e) => update({ startNetWorth: Number(e.target.value) })}
                  className="w-full accent-[#d4af37] cursor-pointer"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Projection chart */}
        <Card className="rise rise-4 xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("Vermögensprojektion (real)")}</CardTitle>
            <div className="flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4af37]" /> {t("Portfolio")}</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#fb923c]" /> {t("FIRE-Zahl")}</span>
            </div>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sim.series} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="gFire" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="age" axisLine={false} tickLine={false} dy={8} tickFormatter={(v: number) => t("{n} J.", { n: Math.round(v) })} />
                <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => v >= 1_000_000 ? `${fmtNum(v / 1_000_000, 1)} M` : `${Math.round(v / 1000)}k`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { age: number; value: number };
                    return (
                      <div className="glass rounded-xl px-4 py-3 text-xs">
                        <div className="mb-1 text-muted">{t("Alter {age}", { age: Math.round(p.age) })}</div>
                        <div className="num text-sm font-semibold">{fmtEUR0(p.value)}</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={sim.fireNumber} stroke="#fb923c" strokeDasharray="6 4" strokeWidth={1.5} />
                {sim.fireAge !== null && sim.yearsToFire !== 0 && (
                  <ReferenceLine x={Math.round(sim.fireAge)} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                )}
                <Area type="monotone" dataKey="value" stroke="#d4af37" strokeWidth={2.5} fill="url(#gFire)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <p className="rise rise-5 text-[11px] leading-relaxed text-muted-2">
        {t("Modell: konstante Realrendite, monatliche Sparrate in heutiger Kaufkraft, FIRE-Zahl = Jahresausgaben ÷ Entnahmerate. Keine Steuern/Abgeltungsteuer, keine Sequence-of-Returns-Risiken — als Orientierung gedacht, nicht als Anlageberatung.")}
      </p>
    </div>
  );
}
