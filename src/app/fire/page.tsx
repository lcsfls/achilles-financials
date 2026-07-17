"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Flame, Target, Coins, Plus, Trash2, SlidersHorizontal, Pencil, Wallet, Gem, TrendingUp, PiggyBank, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartTooltip } from "@/components/chart-tooltip";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_PARAMS, project, startCapital, type Assets, type FireParams } from "@/lib/fire";
import { apiJson, cn, fmtEUR, fmtEUR0, fmtNum } from "@/lib/utils";

type Scenario = { id: number; name: string; createdAt: string; params: FireParams };

const COLORS = ["#d4af37", "#38bdf8", "#a78bfa", "#34d399", "#fb923c", "#f472b6"];

export default function FirePage() {
  const { t } = useI18n();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [assets, setAssets] = useState<Assets>({ cash: 0, metals: 0, investments: 0, pension: 0 });
  const [emergency, setEmergency] = useState<{ balance: number; accountName: string } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [draft, setDraft] = useState<FireParams>(DEFAULT_PARAMS);
  const [draftName, setDraftName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [f, s] = await Promise.all([
      apiJson<{ scenarios: Scenario[] }>("/api/fire"),
      apiJson<{ assets?: Assets; emergency?: { balance: number; accountName: string } | null }>("/api/summary"),
    ]);
    setAssets(s.assets ?? { cash: 0, metals: 0, investments: 0, pension: 0 });
    setEmergency(s.emergency ? { balance: s.emergency.balance, accountName: s.emergency.accountName } : null);
    setScenarios(f.scenarios);
    setActiveId((prev) => prev ?? f.scenarios[0]?.id ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (s: Scenario) => { setEditing(s); setDraft(s.params); setDraftName(s.name); setIsNew(false); };
  const openNew = () => {
    const base = scenarios?.find((s) => s.id === activeId)?.params ?? DEFAULT_PARAMS;
    setEditing({ id: -1, name: "", createdAt: "", params: base });
    setDraft(base);
    setDraftName("");
    setIsNew(true);
  };

  const save = async () => {
    setBusy(true);
    if (isNew) {
      const res = await fetch("/api/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName || t("Neues Szenario"), params: draft }),
      });
      const d = await res.json();
      if (res.ok) setActiveId(d.id);
    } else {
      await fetch("/api/fire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing!.id, name: draftName, params: draft }),
      });
    }
    setBusy(false);
    setEditing(null);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("Szenario wirklich löschen?"))) return;
    const res = await fetch(`/api/fire?id=${id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error); return; }
    if (activeId === id) setActiveId(null);
    load();
  };

  // Live-Vorschau im Modal
  const previewProjection = useMemo(
    () => (editing ? project(draft, assets, new Date().getFullYear()) : null),
    [editing, draft, assets]
  );

  const projections = useMemo(() => {
    const year = new Date().getFullYear();
    return (scenarios ?? []).map((s) => ({ scenario: s, p: project(s.params, assets, year) }));
  }, [scenarios, assets]);

  const active = projections.find((x) => x.scenario.id === activeId) ?? projections[0];

  const ASSET_ROWS: Array<{ key: keyof Assets; label: string; icon: typeof Wallet; color: string }> = [
    { key: "cash", label: t("Liquidität"), icon: Wallet, color: "#38bdf8" },
    { key: "investments", label: t("Investments"), icon: TrendingUp, color: "#a78bfa" },
    { key: "metals", label: t("Edelmetalle"), icon: Gem, color: "#d4af37" },
    { key: "pension", label: t("Altersvorsorge"), icon: PiggyBank, color: "#34d399" },
  ];

  const SLIDERS: Array<{ key: keyof FireParams; label: string; min: number; max: number; step: number; fmt: (v: number) => string }> = [
    { key: "age", label: t("Aktuelles Alter"), min: 18, max: 70, step: 1, fmt: (v) => t("{n} Jahre", { n: v }) },
    { key: "monthlySavings", label: t("Sparrate / Monat"), min: 0, max: 10000, step: 50, fmt: (v) => fmtEUR0(v) },
    { key: "monthlyExpenses", label: t("Wunsch-Ausgaben im Ruhestand / Monat (heutige Kaufkraft)"), min: 500, max: 15000, step: 100, fmt: (v) => fmtEUR0(v) },
    { key: "annualReturnPct", label: t("Erwartete Rendite p. a."), min: 0, max: 12, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "inflationPct", label: t("Inflation p. a."), min: 0, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "withdrawalRatePct", label: t("Entnahmerate (SWR)"), min: 2, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
  ];

  if (!scenarios) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Simulator …")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("FIRE-Simulator")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-2">
            {t("Financial Independence, Retire Early — alle Werte inflationsbereinigt in heutiger Kaufkraft.")}
          </p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> {t("Szenario anlegen")}</Button>
      </div>

      {/* Vermögensbausteine */}
      <Card className="rise rise-1">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("Startkapital")}</CardTitle>
          {emergency && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-soft" />
              {t("Notgroschen ({amount}) ist ausgenommen", { amount: fmtEUR0(emergency.balance) })}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ASSET_ROWS.map(({ key, label, icon: Icon, color }) => {
              const on = active?.scenario.params.include[key] ?? true;
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border px-4 py-3 transition-opacity",
                    on ? "border-white/12 bg-white/[0.04]" : "border-white/5 opacity-40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color }} strokeWidth={1.8} />
                    <span className="text-[11px] uppercase tracking-wider text-muted-2">{label}</span>
                  </div>
                  <div className="num mt-1.5 text-lg font-semibold">{fmtEUR0(assets[key])}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-2">
            {t("Welche Bausteine zählen, legst du je Szenario fest — über „Bearbeiten“.")}
          </p>
        </CardContent>
      </Card>

      {/* Szenarien */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {projections.map(({ scenario, p }, i) => {
          const color = COLORS[i % COLORS.length];
          const isActive = scenario.id === activeId;
          return (
            <Card
              key={scenario.id}
              className={cn("rise glass-hover cursor-pointer p-5 transition-all", isActive && "border-gold/40")}
              style={isActive ? { boxShadow: `0 0 32px -12px ${color}80` } : undefined}
              onClick={() => setActiveId(scenario.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-sm font-semibold">{scenario.name}</span>
                  </div>
                  <div className="num mt-2 text-2xl font-semibold tracking-tight">
                    {p.yearsToFire === null ? t("> 60 J.") : p.yearsToFire === 0 ? t("Erreicht 🎉") : t("{n} Jahre", { n: fmtNum(p.yearsToFire, 1) })}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-2">
                    {p.fireAge !== null && p.yearsToFire !== 0
                      ? t("mit {age} Jahren ({year})", { age: Math.round(p.fireAge), year: p.fireYear! })
                      : t("FIRE-Zahl {amount}", { amount: fmtEUR0(p.fireNumber) })}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(scenario); }}
                    className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/8 hover:text-foreground cursor-pointer"
                    title={t("Bearbeiten")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(scenario.id); }}
                    className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer"
                    title={t("Löschen")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Fortschritt je Szenario */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-2">
                  <span className="num">{fmtEUR0(p.start)} / {fmtEUR0(p.fireNumber)}</span>
                  <span className="num font-semibold" style={{ color }}>{fmtNum(p.progressPct, 1)} %</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p.progressPct}%`, background: `linear-gradient(90deg, ${color}90, ${color})`, boxShadow: `0 0 12px ${color}60` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-2">
                  <span>{fmtEUR0(scenario.params.monthlySavings)}/{t("Mon.")}</span>
                  <span>{fmtNum(scenario.params.annualReturnPct, 1)} % {t("Rendite")}</span>
                  <span>{fmtNum(scenario.params.withdrawalRatePct, 1)} % SWR</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Kennzahlen des aktiven Szenarios */}
      {active && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Target, label: t("FIRE-Zahl"), value: fmtEUR0(active.p.fireNumber), sub: t("bei {pct} % Entnahme", { pct: fmtNum(active.scenario.params.withdrawalRatePct, 1) }), accent: "#d4af37" },
            { icon: Coins, label: t("Startkapital"), value: fmtEUR0(active.p.start), sub: active.scenario.params.startNetWorth === null ? t("aus gewählten Bausteinen") : t("manuell gesetzt"), accent: "#38bdf8" },
            { icon: Flame, label: t("Fortschritt"), value: `${fmtNum(active.p.progressPct, 1)} %`, sub: t("{amount} fehlen", { amount: fmtEUR0(Math.max(0, active.p.fireNumber - active.p.start)) }), accent: "#fb923c" },
            { icon: SlidersHorizontal, label: t("Realrendite"), value: `${fmtNum(active.p.realAnnualPct, 1)} %`, sub: t("nach Inflation"), accent: "#a78bfa" },
          ].map(({ icon: Icon, label, value, sub, accent }) => (
            <Card key={label} className="glass-hover rise p-6">
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
      )}

      {/* Vergleich aller Szenarien */}
      <Card className="rise rise-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("Vermögensprojektion (real)")}</CardTitle>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted">
            {projections.map(({ scenario }, i) => (
              <span key={scenario.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {scenario.name}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                {projections.map(({ scenario }, i) => (
                  <linearGradient key={scenario.id} id={`gF${scenario.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="age" type="number" domain={["dataMin", "dataMax"]}
                axisLine={false} tickLine={false} dy={8}
                tickFormatter={(v: number) => t("{n} J.", { n: Math.round(v) })}
                allowDuplicatedCategory={false}
              />
              <YAxis
                axisLine={false} tickLine={false} width={64}
                tickFormatter={(v: number) => (v >= 1_000_000 ? `${fmtNum(v / 1_000_000, 1)} M` : `${Math.round(v / 1000)}k`)}
              />
              <Tooltip
                content={({ active: a, payload }) => {
                  return (
                    <ChartTooltip active={a && Boolean(payload?.length)} width={230}>
                      <div className="mb-1 text-muted">{t("Alter {age}", { age: Math.round(payload?.[0]?.payload?.age ?? 0) })}</div>
                      {(payload ?? []).map((pl) => (
                        <div key={String(pl.name)} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: pl.stroke }} />
                            {pl.name}
                          </span>
                          <span className="num font-semibold">{fmtEUR0(Number(pl.value))}</span>
                        </div>
                      ))}
                    </ChartTooltip>
                  );
                }}
              />
              {active && <ReferenceLine y={active.p.fireNumber} stroke="#fb923c" strokeDasharray="6 4" strokeWidth={1.5} />}
              {projections.map(({ scenario, p }, i) => (
                <Area
                  key={scenario.id}
                  data={p.series}
                  dataKey="value"
                  name={scenario.name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={scenario.id === activeId ? 2.5 : 1.5}
                  strokeOpacity={scenario.id === activeId ? 1 : 0.45}
                  fill={scenario.id === activeId ? `url(#gF${scenario.id})` : "transparent"}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="rise rise-5 text-[11px] leading-relaxed text-muted-2">
        {t("Modell: konstante Realrendite, monatliche Sparrate in heutiger Kaufkraft, FIRE-Zahl = Jahresausgaben ÷ Entnahmerate. Keine Steuern/Abgeltungsteuer, keine Sequence-of-Returns-Risiken — als Orientierung gedacht, nicht als Anlageberatung.")}
      </p>

      {/* Rechner im Modal */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogTitle>{isNew ? t("Szenario anlegen") : t("Szenario bearbeiten")}</DialogTitle>
          <DialogDescription>{t("Parameter anpassen — die Vorschau rechnet live mit.")}</DialogDescription>

          <div className="mt-5 space-y-5">
            <div className="space-y-1.5">
              <Label>{t("Name")}</Label>
              <Input
                autoFocus={isNew}
                placeholder={t("z. B. Optimistisch, Sparsam, Basis")}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </div>

            {previewProjection && (
              <div className="glass-inset grid grid-cols-3 gap-3 rounded-xl p-4">
                {[
                  { l: t("FIRE-Zahl"), v: fmtEUR0(previewProjection.fireNumber) },
                  {
                    l: t("Zeit bis FIRE"),
                    v: previewProjection.yearsToFire === null ? t("> 60 J.")
                      : previewProjection.yearsToFire === 0 ? t("Erreicht 🎉")
                      : t("{n} Jahre", { n: fmtNum(previewProjection.yearsToFire, 1) }),
                  },
                  { l: t("Fortschritt"), v: `${fmtNum(previewProjection.progressPct, 1)} %` },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-2">{l}</div>
                    <div className="num mt-0.5 text-sm font-semibold text-gold-bright">{v}</div>
                  </div>
                ))}
              </div>
            )}

            {SLIDERS.map(({ key, label, min, max, step, fmt }) => (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="num font-semibold text-gold-bright">{fmt(draft[key] as number)}</span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={draft[key] as number}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                  className="w-full accent-[#d4af37] cursor-pointer"
                />
              </div>
            ))}

            <div>
              <div className="mb-2 text-sm text-muted">{t("Welches Vermögen zählt ins Startkapital?")}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ASSET_ROWS.map(({ key, label, icon: Icon, color }) => {
                  const on = draft.include[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setDraft({ ...draft, include: { ...draft.include, [key]: !on } })}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-all",
                        on ? "border-gold/35 bg-gold/8" : "border-white/10 text-muted-2 hover:border-white/20"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: on ? color : undefined }} strokeWidth={1.8} />
                        {label}
                      </span>
                      <span className="num">{fmtEUR0(assets[key])}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-2">{t("Summe Startkapital")}</span>
                <span className="num font-semibold text-gold-bright">
                  {fmtEUR(startCapital({ ...draft, startNetWorth: null }, assets))}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">{t("Startkapital überschreiben")}</span>
                <button
                  className="text-xs text-gold-bright hover:underline cursor-pointer"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      startNetWorth: draft.startNetWorth === null
                        ? Math.round(startCapital({ ...draft, startNetWorth: null }, assets))
                        : null,
                    })
                  }
                >
                  {draft.startNetWorth === null ? t("manuell setzen") : t("auf automatisch zurück")}
                </button>
              </div>
              {draft.startNetWorth !== null && (
                <input
                  type="range" min={0} max={2000000} step={5000}
                  value={draft.startNetWorth}
                  onChange={(e) => setDraft({ ...draft, startNetWorth: Number(e.target.value) })}
                  className="w-full accent-[#d4af37] cursor-pointer"
                />
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(null)} disabled={busy}>{t("Abbrechen")}</Button>
            <Button className="flex-1" onClick={save} disabled={busy}>{busy ? t("Speichern …") : t("Speichern")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
