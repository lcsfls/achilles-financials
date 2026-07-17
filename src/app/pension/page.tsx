"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, PiggyBank, Building2, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { PensionAllocation } from "@/components/pension-allocation";
import { useI18n } from "@/lib/i18n";
import { apiJson, fmtEUR, fmtEUR0, fmtDate } from "@/lib/utils";

type Statement = { id: number; statement_date: string; balance_eur: number; contribution_eur: number | null; note: string | null };
type Data = {
  statements: Statement[]; latestBalance: number; latestDate: string | null;
  totalContrib: number; provider: string; monthlyContribution: number;
};

const EMPTY = { statement_date: new Date().toISOString().slice(0, 10), balance_eur: "", contribution_eur: "", note: "" };

export default function PensionPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [provider, setProvider] = useState("");
  const [monthly, setMonthly] = useState("");
  const [metaSaved, setMetaSaved] = useState(false);

  const load = () =>
    apiJson<Data>("/api/pension").then((d) => {
      setData(d);
      setProvider(d.provider);
      setMonthly(d.monthlyContribution ? String(d.monthlyContribution).replace(".", ",") : "");
    });
  useEffect(() => { load(); }, []);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));

  const submit = async () => {
    const res = await fetch("/api/pension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statement_date: form.statement_date,
        balance_eur: num(form.balance_eur),
        contribution_eur: form.contribution_eur ? num(form.contribution_eur) : null,
        note: form.note || null,
      }),
    });
    if (res.ok) { setOpen(false); setForm(EMPTY); load(); }
    else alert((await res.json()).error || t("Fehler beim Speichern"));
  };

  const saveMeta = async () => {
    await fetch("/api/pension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, monthlyContribution: monthly ? num(monthly) : 0 }),
    });
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2500);
  };

  const remove = async (id: number) => {
    if (!confirm(t("Diesen Auszug wirklich löschen?"))) return;
    await fetch(`/api/pension?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!data) return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Vorsorge …")}</div>;

  const first = data.statements[0];
  const growth = first && data.latestBalance > 0 ? data.latestBalance - first.balance_eur : 0;
  const chartData = data.statements.map((s) => ({ ...s, label: fmtDate(s.statement_date) }));

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Betriebliche Altersvorsorge")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {t("Stände aus deinen Kontoauszügen erfassen — der aktuelle Stand fließt ins Gesamtvermögen und in den FIRE-Simulator ein.")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> {t("Kontoauszug erfassen")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{t("Kontoauszug erfassen")}</DialogTitle>
            <DialogDescription>{t("Datum und Stand vom Auszug übernehmen; eingezahlter Beitrag seit dem letzten Auszug ist optional.")}</DialogDescription>
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
            <Button className="mt-6 w-full" onClick={submit}>{t("Speichern")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-hover rise rise-1 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Aktueller Stand")}</div>
          <div className="num mt-2 text-2xl font-semibold">{fmtEUR(data.latestBalance)}</div>
          <div className="mt-1 text-xs text-muted-2">{data.latestDate ? t("Auszug vom {date}", { date: fmtDate(data.latestDate) }) : t("noch kein Auszug erfasst")}</div>
        </Card>
        <Card className="glass-hover rise rise-2 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Erfasste Beiträge")}</div>
          <div className="num mt-2 text-2xl font-semibold">{fmtEUR0(data.totalContrib)}</div>
          <div className="mt-1 text-xs text-muted-2">{t("Summe über {n} Auszüge", { n: data.statements.length })}</div>
        </Card>
        <Card className="glass-hover rise rise-3 p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t("Entwicklung seit Beginn")}</div>
          <div className="num mt-2 text-2xl font-semibold" style={{ color: growth >= 0 ? "#34d399" : "#fb7185" }}>
            {growth >= 0 ? "+" : ""}{fmtEUR0(growth)}
          </div>
          <div className="mt-1 text-xs text-muted-2">{first ? t("seit {date}", { date: fmtDate(first.statement_date) }) : "—"}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Chart */}
        <Card className="rise rise-3 xl:col-span-3">
          <CardHeader><CardTitle>{t("Guthabenentwicklung")}</CardTitle></CardHeader>
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
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as Statement & { label: string };
                      return (
                        <div className="glass rounded-xl px-4 py-3 text-xs">
                          <div className="mb-1 text-muted">{p.label}</div>
                          <div className="num text-sm font-semibold">{fmtEUR(p.balance_eur)}</div>
                          {p.contribution_eur != null && <div className="mt-0.5 text-muted-2">{t("Beitrag: {amount}", { amount: fmtEUR(p.contribution_eur) })}</div>}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="balance_eur" stroke="#34d399" strokeWidth={2.5} fill="url(#gPension)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Vertrag / Meta */}
        <Card className="rise rise-4 xl:col-span-2">
          <CardHeader className="flex-row items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-soft/10 border border-emerald-soft/20">
              <Building2 className="h-5 w-5 text-emerald-soft" strokeWidth={1.7} />
            </div>
            <div>
              <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t("Vertragsdaten")}</CardTitle>
              <div className="text-xs text-muted-2">{t("Anbieter & laufender Beitrag")}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Anbieter / Versicherung")}</Label>
              <Input placeholder={t("z. B. Direktversicherung")} value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Monatlicher Beitrag gesamt (€, AG + AN)")}</Label>
              <Input inputMode="decimal" placeholder="150,00" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="glass" onClick={saveMeta}>{t("Speichern")}</Button>
              {metaSaved && <span className="flex items-center gap-1.5 text-sm text-emerald-soft"><CheckCircle2 className="h-4 w-4" /> {t("Gespeichert")}</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <PensionAllocation onChange={load} />

      {/* Statements table */}
      <Card className="rise rise-5 overflow-hidden">
        <CardHeader><CardTitle>{t("Kontoauszüge")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.statements.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-2">{t("Noch keine Auszüge erfasst.")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-2">
                  <th className="px-6 py-3 font-medium">{t("Datum")}</th>
                  <th className="px-4 py-3 font-medium">{t("Stand")}</th>
                  <th className="px-4 py-3 font-medium">{t("Beitrag seit letztem")}</th>
                  <th className="px-4 py-3 font-medium">{t("Δ zum Vorauszug")}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">{t("Notiz")}</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {[...data.statements].reverse().map((s, idx, arr) => {
                  const prev = arr[idx + 1];
                  const delta = prev ? s.balance_eur - prev.balance_eur : null;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-6 py-3.5">{fmtDate(s.statement_date)}</td>
                      <td className="num px-4 py-3.5 font-medium">{fmtEUR(s.balance_eur)}</td>
                      <td className="num px-4 py-3.5 text-muted">{s.contribution_eur != null ? fmtEUR(s.contribution_eur) : "—"}</td>
                      <td className="num px-4 py-3.5" style={{ color: delta === null ? undefined : delta >= 0 ? "#34d399" : "#fb7185" }}>
                        {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${fmtEUR(delta)}`}
                      </td>
                      <td className="hidden max-w-[220px] truncate px-4 py-3.5 text-xs text-muted-2 md:table-cell">{s.note || "—"}</td>
                      <td className="px-3 py-3.5">
                        <button onClick={() => remove(s.id)} className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer" title={t("Löschen")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
