"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, PiggyBank, Shield, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { PensionAllocation } from "@/components/pension-allocation";
import { ChartTooltip } from "@/components/chart-tooltip";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR, fmtEUR0, fmtDate } from "@/lib/utils";
import type { ContractStats, Statement } from "@/lib/pension";

type Contract = {
  id: number; label: string; kind: "pension" | "life";
  provider: string | null; monthly_eur: number | null; note: string | null;
  statements: Statement[]; stats: ContractStats;
};
type Data = { contracts: Contract[]; totalBalance: number; totalContrib: number; totalReturn: number };

const EMPTY_STMT = { statement_date: new Date().toISOString().slice(0, 10), balance_eur: "", contribution_eur: "", note: "" };
const EMPTY_CONTRACT = { label: "", kind: "pension" as "pension" | "life", provider: "", monthly_eur: "" };

export default function PensionPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_STMT);
  const [contract, setContract] = useState(EMPTY_CONTRACT);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiJson<Data>("/api/pension").then((d) => {
        setData(d);
        // Keep the current selection if it still exists, otherwise take the first.
        setActiveId((prev) => (prev && d.contracts.some((c) => c.id === prev) ? prev : d.contracts[0]?.id ?? null));
      }),
    []
  );
  useEffect(() => { load(); }, [load]);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  const saveContract = async () => {
    setError(null);
    const payload = {
      label: contract.label.trim(),
      kind: contract.kind,
      provider: contract.provider,
      monthly_eur: contract.monthly_eur ? num(contract.monthly_eur) : null,
    };
    const res = await fetch("/api/pension", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing, ...payload } : { contract: payload }),
    });
    if (!res.ok) { setError(t((await res.json()).error || "Fehler beim Speichern")); return; }
    const body = await res.json();
    setContractOpen(false);
    setContract(EMPTY_CONTRACT);
    setEditing(null);
    await load();
    if (body.id) setActiveId(body.id);
  };

  const addStatement = async () => {
    if (!activeId) return;
    setError(null);
    const res = await fetch("/api/pension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: activeId,
        statement_date: form.statement_date,
        balance_eur: num(form.balance_eur),
        contribution_eur: form.contribution_eur ? num(form.contribution_eur) : null,
        note: form.note || null,
      }),
    });
    if (!res.ok) { setError(t((await res.json()).error || "Fehler beim Speichern")); return; }
    setStmtOpen(false);
    setForm(EMPTY_STMT);
    load();
  };

  const removeStatement = async (id: number) => {
    if (!confirm(t("Diesen Auszug wirklich löschen?"))) return;
    await fetch(`/api/pension?statement=${id}`, { method: "DELETE" });
    load();
  };

  const removeContract = async (c: Contract) => {
    if (!confirm(t("Vertrag samt allen Auszügen löschen?"))) return;
    await fetch(`/api/pension?contract=${c.id}`, { method: "DELETE" });
    load();
  };

  const openEdit = (c: Contract) => {
    setEditing(c.id);
    setContract({
      label: c.label,
      kind: c.kind,
      provider: c.provider ?? "",
      monthly_eur: c.monthly_eur ? String(c.monthly_eur).replace(".", ",") : "",
    });
    setContractOpen(true);
  };

  if (!data) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Vorsorge …")}</div>;
  }

  const active = data.contracts.find((c) => c.id === activeId) ?? null;
  const s = active?.stats ?? null;
  const chartData = (active?.statements ?? []).map((x) => ({ ...x, label: fmtDate(x.statement_date) }));

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Vorsorge")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {data.contracts.length === 0
              ? t("Renten- und Lebensversicherungen erfassen — die Stände fließen ins Gesamtvermögen und in den FIRE-Simulator ein.")
              : `${data.contracts.length === 1 ? t("1 Vertrag") : t("{n} Verträge", { n: data.contracts.length })} · ${fmtEUR0(data.totalBalance)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="glass" size="sm" onClick={() => setMethodOpen(true)}>
            <Info className="h-3.5 w-3.5" /> {t("Wie gerechnet wird")}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setContract(EMPTY_CONTRACT); setError(null); setContractOpen(true); }}>
            <Plus className="h-4 w-4" /> {t("Vertrag anlegen")}
          </Button>
        </div>
      </div>

      {data.contracts.length === 0 ? (
        <Card className="rise rise-1 flex flex-col items-center gap-4 p-14 text-center">
          <PiggyBank className="h-10 w-10 text-emerald-soft/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">
            {t("Noch kein Vertrag angelegt. Lege deine Altersvorsorge oder Lebensversicherung an und trage danach die Stände aus den Jahresauszügen ein.")}
          </p>
        </Card>
      ) : (
        <>
          {/* Contract switcher — several contracts run side by side */}
          <div className="rise rise-1 flex flex-wrap gap-2">
            {data.contracts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all",
                  c.id === activeId
                    ? "border-gold/40 bg-gold/10 text-gold-bright"
                    : "border-white/10 text-muted hover:border-white/20 hover:text-foreground"
                )}
              >
                {c.kind === "life" ? <Shield className="h-3.5 w-3.5" /> : <PiggyBank className="h-3.5 w-3.5" />}
                <span>{c.label}</span>
                <span className="num text-xs opacity-70">{fmtEUR0(c.stats.latestBalance)}</span>
              </button>
            ))}
          </div>

          {active && s && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="glass-hover rise rise-1 p-6">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Aktueller Stand")}</div>
                  <div className="num mt-2 text-2xl font-semibold">{fmtEUR0(s.latestBalance)}</div>
                  <div className="mt-1 text-xs text-muted-2">
                    {s.latestDate ? t("Auszug vom {date}", { date: fmtDate(s.latestDate) }) : t("noch kein Auszug erfasst")}
                  </div>
                </Card>
                <Card className="glass-hover rise rise-2 p-6">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Erfasste Beiträge")}</div>
                  <div className="num mt-2 text-2xl font-semibold">{fmtEUR0(s.totalContrib)}</div>
                  <div className="mt-1 text-xs text-muted-2">{t("Summe über {n} Auszüge", { n: active.statements.length })}</div>
                </Card>
                {/* The honest headline: the balance change minus the money paid in */}
                <Card className="glass-hover rise rise-3 p-6">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Wertzuwachs")}</div>
                  <div className="num mt-2 text-2xl font-semibold" style={{ color: s.netReturn >= 0 ? "#34d399" : "#fb7185" }}>
                    {s.netReturn >= 0 ? "+" : ""}{fmtEUR0(s.netReturn)}
                  </div>
                  <div className="mt-1 text-xs text-muted-2">
                    {s.netReturnPct !== null
                      ? t("{pct} auf eingesetztes Kapital", {
                          pct: `${s.netReturnPct >= 0 ? "+" : ""}${s.netReturnPct.toFixed(1).replace(".", ",")} %`,
                        })
                      : t("mindestens zwei Auszüge nötig")}
                  </div>
                </Card>
                <Card className="glass-hover rise rise-4 p-6">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Standänderung")}</div>
                  <div className="num mt-2 text-2xl font-semibold">{s.growth >= 0 ? "+" : ""}{fmtEUR0(s.growth)}</div>
                  {/* Naming the contributions inside it prevents reading this as a return */}
                  <div className="mt-1 text-xs text-muted-2">
                    {s.contribSince > 0
                      ? t("davon {amount} eigene Beiträge", { amount: fmtEUR0(s.contribSince) })
                      : s.firstDate
                        ? t("seit {date}", { date: fmtDate(s.firstDate) })
                        : "—"}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <Card className="rise rise-3 xl:col-span-3">
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{active.label}</CardTitle>
                      <div className="mt-0.5 text-xs text-muted-2">
                        {[
                          active.kind === "life" ? t("Lebensversicherung") : t("Altersvorsorge"),
                          active.provider,
                          active.monthly_eur ? t("{amount}/Monat", { amount: fmtEUR0(active.monthly_eur) }) : null,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="glass" size="sm" onClick={() => openEdit(active)}>{t("Bearbeiten")}</Button>
                      <Button variant="glass" size="sm" onClick={() => { setError(null); setStmtOpen(true); }}>
                        <Plus className="h-3.5 w-3.5" /> {t("Auszug")}
                      </Button>
                      <button
                        onClick={() => removeContract(active)}
                        className="rounded-lg p-2 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer"
                        title={t("Vertrag löschen")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {chartData.length < 2 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                        <PiggyBank className="h-10 w-10 text-gold/50" strokeWidth={1.2} />
                        <p className="max-w-xs text-sm text-muted-2">{t("Ab zwei erfassten Auszügen erscheint hier die Entwicklung deines Guthabens.")}</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                          <defs>
                            <linearGradient id="gPension" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} />
                          <YAxis axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                          <Tooltip
                            content={({ active: hovered, payload }) => {
                              const p = payload?.[0]?.payload as (Statement & { label: string }) | undefined;
                              return (
                                <ChartTooltip active={hovered && Boolean(p)} width={180} height={90}>
                                  <div className="mb-1 text-muted">{p?.label}</div>
                                  <div className="num text-sm font-semibold">{fmtEUR(p?.balance_eur ?? 0)}</div>
                                  {p?.contribution_eur != null && (
                                    <div className="mt-0.5 text-muted-2">{t("Beitrag: {amount}", { amount: fmtEUR(p.contribution_eur) })}</div>
                                  )}
                                </ChartTooltip>
                              );
                            }}
                          />
                          <Area type="monotone" dataKey="balance_eur" stroke="#34d399" strokeWidth={2.5} fill="url(#gPension)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rise rise-4 xl:col-span-2">
                  <CardHeader>
                    <CardTitle>{t("Alle Verträge")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.contracts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveId(c.id)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm">{c.label}</div>
                          <div className="text-xs text-muted-2">
                            {c.kind === "life" ? t("Lebensversicherung") : t("Altersvorsorge")}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="num text-sm font-medium">{fmtEUR0(c.stats.latestBalance)}</div>
                          <div className="num text-xs" style={{ color: c.stats.netReturn >= 0 ? "#34d399" : "#fb7185" }}>
                            {c.stats.netReturn >= 0 ? "+" : ""}{fmtEUR0(c.stats.netReturn)}
                          </div>
                        </div>
                      </button>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm">
                      <span className="text-muted-2">{t("Gesamt")}</span>
                      <span className="num font-semibold">{fmtEUR0(data.totalBalance)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <PensionAllocation onChange={load} />

              <Card className="rise rise-5 overflow-hidden">
                <CardHeader><CardTitle>{t("Kontoauszüge")}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {active.statements.length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-2">{t("Noch keine Auszüge erfasst.")}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-2">
                            <th className="px-6 py-3 font-medium">{t("Datum")}</th>
                            <th className="px-4 py-3 font-medium">{t("Stand")}</th>
                            <th className="px-4 py-3 font-medium">{t("Beitrag seit letztem")}</th>
                            <th className="px-4 py-3 font-medium">{t("Standänderung")}</th>
                            <th className="px-4 py-3 font-medium">{t("davon Wertzuwachs")}</th>
                            <th className="hidden px-4 py-3 font-medium md:table-cell">{t("Notiz")}</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {[...active.statements].reverse().map((x, idx, arr) => {
                            const prev = arr[idx + 1];
                            const delta = prev ? x.balance_eur - prev.balance_eur : null;
                            // This row's own return: the change minus what was paid in
                            const ret = delta === null ? null : delta - (x.contribution_eur ?? 0);
                            return (
                              <tr key={x.id} className="transition-colors hover:bg-white/[0.03]">
                                <td className="px-6 py-3.5">{fmtDate(x.statement_date)}</td>
                                <td className="num px-4 py-3.5 font-medium">{fmtEUR(x.balance_eur)}</td>
                                <td className="num px-4 py-3.5 text-muted">{x.contribution_eur != null ? fmtEUR(x.contribution_eur) : "—"}</td>
                                <td className="num px-4 py-3.5 text-muted">{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${fmtEUR(delta)}`}</td>
                                <td className="num px-4 py-3.5" style={{ color: ret === null ? undefined : ret >= 0 ? "#34d399" : "#fb7185" }}>
                                  {ret === null ? "—" : `${ret >= 0 ? "+" : ""}${fmtEUR(ret)}`}
                                </td>
                                <td className="hidden max-w-[220px] truncate px-4 py-3.5 text-xs text-muted-2 md:table-cell">{x.note || "—"}</td>
                                <td className="px-3 py-3.5">
                                  <button onClick={() => removeStatement(x.id)} className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer" title={t("Löschen")}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Vertrag anlegen / bearbeiten */}
      <Dialog open={contractOpen} onOpenChange={(o) => { setContractOpen(o); setError(null); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogTitle>{editing ? t("Vertrag bearbeiten") : t("Vertrag anlegen")}</DialogTitle>
          <DialogDescription>
            {t("Jeder Vertrag wird eigenständig geführt — betriebliche und private Altersvorsorge, Lebens- und Rentenversicherungen nebeneinander.")}
          </DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>{t("Bezeichnung")}</Label>
              <Input placeholder={t("z. B. Direktversicherung")} value={contract.label} onChange={(e) => setContract({ ...contract, label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Art")}</Label>
              <Select value={contract.kind} onChange={(e) => setContract({ ...contract, kind: e.target.value as "pension" | "life" })}>
                <option value="pension">{t("Altersvorsorge")}</option>
                <option value="life">{t("Lebensversicherung")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Anbieter / Versicherung")}</Label>
              <Input value={contract.provider} onChange={(e) => setContract({ ...contract, provider: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("Monatlicher Beitrag gesamt (€, AG + AN)")}</Label>
              <Input inputMode="decimal" placeholder="150,00" value={contract.monthly_eur} onChange={(e) => setContract({ ...contract, monthly_eur: e.target.value })} />
            </div>
          </div>
          {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
          <Button className="mt-6 w-full" onClick={saveContract}>{t("Speichern")}</Button>
        </DialogContent>
      </Dialog>

      {/* Auszug erfassen */}
      <Dialog open={stmtOpen} onOpenChange={(o) => { setStmtOpen(o); setError(null); }}>
        <DialogContent>
          <DialogTitle>{t("Kontoauszug erfassen")}</DialogTitle>
          <DialogDescription>
            {t("Datum und Stand vom Auszug übernehmen. Der Beitrag ist das, was seit dem letzten Auszug eingezahlt wurde — nur damit lässt sich der echte Wertzuwachs vom eigenen Geld trennen.")}
          </DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Datum des Auszugs")}</Label>
              <Input type="date" value={form.statement_date} onChange={(e) => setForm({ ...form, statement_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Stand / Guthaben (€)")}</Label>
              <Input inputMode="decimal" placeholder="12.480,55" value={form.balance_eur} onChange={(e) => setForm({ ...form, balance_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Beiträge seit letztem Auszug (€, optional)")}</Label>
              <Input inputMode="decimal" placeholder="1.200,00" value={form.contribution_eur} onChange={(e) => setForm({ ...form, contribution_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Notiz (optional)")}</Label>
              <Input placeholder={t("Jahresmitteilung")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
          <Button className="mt-6 w-full" onClick={addStatement}>{t("Speichern")}</Button>
        </DialogContent>
      </Dialog>

      {/* Rechenweg — beantwortet genau die Frage, ob das Tageswerte sind */}
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent>
          <DialogTitle>{t("Wie gerechnet wird")}</DialogTitle>
          <DialogDescription>
            {t("Alle Zahlen stammen aus den Auszügen, die du erfasst hast. Es sind keine Tageswerte, sondern Stände zu deinen Stichtagen.")}
          </DialogDescription>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
            <p>
              <strong className="text-foreground">{t("Standänderung")}</strong>
              {" — "}
              {t("die Differenz zwischen erstem und letztem Auszug. Sie enthält deine eigenen Einzahlungen.")}
            </p>
            <p>
              <strong className="text-foreground">{t("Wertzuwachs")}</strong>
              {" — "}
              {t("dieselbe Differenz, abzüglich der Beiträge seit dem ersten Auszug. Nur das hat der Vertrag tatsächlich erwirtschaftet.")}
            </p>
            <p>{t("Die Prozentangabe bezieht sich auf das eingesetzte Kapital (erster Stand plus spätere Einzahlungen). Bewusst keine zeitgewichtete Rendite: Jahresauszüge liegen zu weit auseinander, um eine solche ehrlich zu berechnen.")}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
