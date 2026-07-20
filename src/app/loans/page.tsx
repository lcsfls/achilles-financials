"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, HandCoins, ArrowUpRight, ArrowDownLeft, Landmark, User, CheckCircle2, RotateCcw, CalendarClock, FileDown, AlertTriangle, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { type ScheduleRow } from "@/lib/amortization";
import { LoanReportDialog } from "@/components/loan-report-dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR, fmtEUR0, fmtDate, fmtPct } from "@/lib/utils";
import type { Loan, LoanState, Payment } from "@/lib/loans";

type Plan = {
  rows: ScheduleRow[]; totalInterest: number; totalPaid: number;
  payoffDate: string | null; months: number; neverPaysOff: boolean; minPayment: number | null;
};
type Row = Loan & { payments: Payment[]; state: LoanState; plan: Plan | null };
type Data = { loans: Row[]; totals: { lent: number; borrowed: number } };

const EMPTY = {
  direction: "lent" as "lent" | "borrowed",
  counterparty: "",
  kind: "private" as "private" | "bank",
  principal_eur: "",
  interest_pct: "",
  monthly_payment_eur: "",
  start_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  note: "",
};

export default function LoansPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<"all" | "lent" | "borrowed">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [pay, setPay] = useState({ amount_eur: "", paid_on: new Date().toISOString().slice(0, 10), note: "" });
  const [payError, setPayError] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<Row | null>(null);
  const [reportFor, setReportFor] = useState<Row | null>(null);
  // id of the loan being edited; null means the dialog creates a new one
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(() => apiJson<Data>("/api/loans").then(setData), []);
  useEffect(() => { load(); }, [load]);

  // Deutsche Eingabe: 1.234,56 → 1234.56
  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  const submit = async () => {
    setError(null);
    const payload = {
      ...form,
      principal_eur: num(form.principal_eur),
      interest_pct: form.interest_pct ? num(form.interest_pct) : 0,
      monthly_payment_eur: form.monthly_payment_eur ? num(form.monthly_payment_eur) : null,
      due_date: form.due_date || null,
    };
    const res = await fetch("/api/loans", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    load();
  };

  const openEdit = (l: Row) => {
    setEditingId(l.id);
    setError(null);
    setForm({
      direction: l.direction,
      counterparty: l.counterparty,
      kind: l.kind,
      principal_eur: String(l.principal_eur).replace(".", ","),
      interest_pct: l.interest_pct ? String(l.interest_pct).replace(".", ",") : "",
      monthly_payment_eur: l.monthly_payment_eur ? String(l.monthly_payment_eur).replace(".", ",") : "",
      start_date: l.start_date,
      due_date: l.due_date ?? "",
      note: l.note ?? "",
    });
    setOpen(true);
  };

  const addPayment = async () => {
    if (!payFor) return;
    setPayError(null);
    const res = await fetch("/api/loans/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loan_id: payFor.id, amount_eur: num(pay.amount_eur), paid_on: pay.paid_on, note: pay.note }),
    });
    if (!res.ok) { setPayError(t((await res.json()).error)); return; }
    setPay({ amount_eur: "", paid_on: new Date().toISOString().slice(0, 10), note: "" });
    const fresh = await fetch("/api/loans").then((r) => r.json());
    setData(fresh);
    setPayFor(fresh.loans.find((l: Row) => l.id === payFor.id) ?? null);
  };

  const removePayment = async (id: number) => {
    await fetch(`/api/loans/payments?id=${id}`, { method: "DELETE" });
    const fresh = await fetch("/api/loans").then((r) => r.json());
    setData(fresh);
    setPayFor(fresh.loans.find((l: Row) => l.id === payFor?.id) ?? null);
  };

  const toggleClosed = async (l: Row) => {
    await fetch("/api/loans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, closed: !l.closed }),
    });
    load();
  };

  const remove = async (l: Row) => {
    if (!confirm(t("Kredit „{name}“ mit allen Zahlungen löschen?", { name: l.counterparty }))) return;
    await fetch(`/api/loans?id=${l.id}`, { method: "DELETE" });
    load();
  };

  if (!data) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Kredite …")}</div>;
  }

  const shown = data.loans.filter((l) => filter === "all" || l.direction === filter);

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Kredite")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {t("Verliehenes und Aufgenommenes — Zahlungen von Hand erfasst.")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); if (!o) { setEditingId(null); setForm(EMPTY); } }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              <Plus className="h-4 w-4" /> {t("Kredit erfassen")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{editingId ? t("Kredit bearbeiten") : t("Kredit erfassen")}</DialogTitle>
            <DialogDescription>
              {t("Zinsen laufen taggenau auf den jeweiligen Restbetrag. Eine Zahlung tilgt erst die aufgelaufenen Zinsen, dann das Kapital. Ohne Zinssatz wird nur getilgt.")}
            </DialogDescription>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Richtung")}</Label>
                <div className="flex gap-2">
                  {([["lent", t("Ich habe verliehen")], ["borrowed", t("Ich habe aufgenommen")]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setForm({ ...form, direction: v })}
                      className={cn(
                        "flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition-all",
                        form.direction === v
                          ? "border-gold/40 bg-gold/10 text-gold-bright"
                          : "border-white/10 text-muted hover:border-white/20"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{form.direction === "lent" ? t("An wen") : t("Bei wem")}</Label>
                <Input
                  placeholder={form.direction === "lent" ? "Max Mustermann" : "Sparkasse"}
                  value={form.counterparty}
                  onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Art")}</Label>
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "private" | "bank" })}>
                  <option value="private">{t("Privat")}</option>
                  <option value="bank">{t("Bank")}</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Summe (€)")}</Label>
                <Input inputMode="decimal" placeholder="2.500" value={form.principal_eur} onChange={(e) => setForm({ ...form, principal_eur: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Zinssatz % p. a. (leer = zinslos)")}</Label>
                <Input inputMode="decimal" placeholder="0" value={form.interest_pct} onChange={(e) => setForm({ ...form, interest_pct: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Monatliche Rate (€, optional)")}</Label>
                <Input inputMode="decimal" placeholder="200" value={form.monthly_payment_eur} onChange={(e) => setForm({ ...form, monthly_payment_eur: e.target.value })} />
                <p className="text-[11px] text-muted-2">{t("Nur mit Rate lässt sich ein Tilgungsplan vorausberechnen.")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Beginn")}</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Fällig bis (optional)")}</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Notiz (optional)")}</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
            <Button className="mt-6 w-full" onClick={submit}>{t("Speichern")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Getrennt ausgewiesen: eine Forderung und eine Schuld zu saldieren
          würde zwei verschiedene Dinge zu einer nichtssagenden Zahl machen. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { icon: ArrowUpRight, label: t("Verliehen · offen"), value: data.totals.lent, accent: "#34d399" },
          { icon: ArrowDownLeft, label: t("Aufgenommen · offen"), value: data.totals.borrowed, accent: "#fb7185" },
        ].map(({ icon: Icon, label, value, accent }, i) => (
          <Card key={label} className={cn("glass-hover rise p-6", `rise-${i + 1}`)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{label}</div>
                <div className="num mt-2 text-2xl font-semibold tracking-tight">{fmtEUR(value)}</div>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
                <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.8} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="rise rise-2 flex gap-2">
        {([["all", t("Alle")], ["lent", t("Verliehen")], ["borrowed", t("Aufgenommen")]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              "cursor-pointer rounded-xl border px-4 py-2 text-sm transition-all",
              filter === v ? "border-gold/40 bg-gold/10 text-gold-bright" : "border-white/10 text-muted hover:border-white/20"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="rise rise-3 flex flex-col items-center gap-4 p-14 text-center">
          <HandCoins className="h-10 w-10 text-gold/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">
            {t("Noch nichts erfasst. Trage einen Kredit ein, den du vergeben oder aufgenommen hast — mit oder ohne Zinsen.")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
          {shown.map((l, i) => {
            const lent = l.direction === "lent";
            const accent = lent ? "#34d399" : "#fb7185";
            const overdue = l.due_date && !l.closed && l.state.outstanding > 0 && l.due_date < new Date().toISOString().slice(0, 10);

            return (
              <Card key={l.id} className={cn("glass-hover rise group p-5", `rise-${(i % 5) + 1}`, l.closed && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {l.kind === "bank" ? <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-2" /> : <User className="h-3.5 w-3.5 shrink-0 text-muted-2" />}
                      <span className="truncate text-sm font-semibold">{l.counterparty}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge color={accent}>{lent ? t("verliehen") : t("aufgenommen")}</Badge>
                      {l.interest_pct > 0
                        ? <Badge color="#a78bfa">{fmtPct(l.interest_pct).replace("+", "")} p. a.</Badge>
                        : <Badge color="#6b7280">{t("zinslos")}</Badge>}
                      {l.closed === 1 && <Badge color="#6b7280">{t("abgeschlossen")}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => openEdit(l)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100 cursor-pointer"
                      title={t("Bearbeiten")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleClosed(l)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100 cursor-pointer"
                      title={l.closed ? t("Wieder öffnen") : t("Abschließen")}
                    >
                      {l.closed ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => remove(l)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-rose-soft/10 hover:text-rose-soft group-hover:opacity-100 cursor-pointer"
                      title={t("Löschen")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Offen")}</div>
                    <div className="num text-2xl font-semibold tracking-tight" style={{ color: accent }}>
                      {fmtEUR(l.state.outstanding)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-2">
                    <div>{t("von {amount}", { amount: fmtEUR0(l.principal_eur) })}</div>
                    {l.state.interestTotal > 0.005 && (
                      <div className="mt-0.5">{t("+{amount} Zinsen", { amount: fmtEUR(l.state.interestTotal) })}</div>
                    )}
                  </div>
                </div>

                {/* Tilgungsfortschritt */}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${l.state.progress * 100}%`, background: accent }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-2">
                  <span>{t("{amount} getilgt", { amount: fmtEUR0(l.principal_eur - l.state.principalLeft) })}</span>
                  <span className="num">{Math.round(l.state.progress * 100)} %</span>
                </div>

                {l.state.overpaid > 0.005 && (
                  <div className="mt-2 text-[11px] text-amber-400">
                    {t("{amount} mehr gezahlt als geschuldet", { amount: fmtEUR(l.state.overpaid) })}
                  </div>
                )}

                <div className="hairline my-3" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 text-[11px] text-muted-2">
                    <span>{t("seit {date}", { date: fmtDate(l.start_date) })}</span>
                    {l.due_date && (
                      <span className={cn("flex items-center gap-1", overdue && "text-rose-soft")}>
                        <CalendarClock className="h-3 w-3" />
                        {t("fällig {date}", { date: fmtDate(l.due_date) })}
                        {overdue && ` · ${t("überfällig")}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="glass" size="sm" onClick={() => { setPayFor(l); setPayError(null); }}>
                      {l.payments.length === 1 ? t("1 Zahlung") : t("{n} Zahlungen", { n: l.payments.length })}
                    </Button>
                    <button
                      onClick={() => setReportFor(l)}
                      className="cursor-pointer rounded-lg p-2 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
                      title={t("Als PDF exportieren")}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Schedule summary — the full table lives in the export */}
                {l.plan && !l.closed && (
                  l.plan.neverPaysOff ? (
                    <div className="mt-3 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t("Die Rate deckt nicht einmal die Zinsen — die Schuld würde wachsen. Nötig wären mindestens {amount}/Monat.", { amount: fmtEUR(l.plan.minPayment ?? 0) })}</span>
                    </div>
                  ) : l.plan.months > 0 ? (
                    <button
                      onClick={() => setPlanFor(l)}
                      className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-[11px] transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="text-muted-2">
                        {t("Bei {rate}/Monat schuldenfrei in {months} Monaten", {
                          rate: fmtEUR0(l.monthly_payment_eur ?? 0),
                          months: String(l.plan.months),
                        })}
                      </span>
                      <span className="shrink-0 text-muted">{t("Tilgungsplan")} →</span>
                    </button>
                  ) : null
                )}
              </Card>
            );
          })}
        </div>
      )}

      <LoanReportDialog loan={reportFor} onClose={() => setReportFor(null)} />

      {/* Tilgungsplan */}
      <Dialog open={Boolean(planFor)} onOpenChange={(o) => { if (!o) setPlanFor(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{t("Tilgungsplan · {name}", { name: planFor?.counterparty ?? "" })}</DialogTitle>
          <DialogDescription>
            {planFor && t("Vorausberechnet ab heute auf {outstanding} Restschuld bei {rate} monatlich. Kein Kontoauszug — was tatsächlich gezahlt wurde, steht unter Zahlungen.", {
              outstanding: fmtEUR(planFor.state.outstanding),
              rate: fmtEUR(planFor.monthly_payment_eur ?? 0),
            })}
          </DialogDescription>

          {planFor?.plan && (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: t("Laufzeit"), value: t("{n} Monate", { n: planFor.plan.months }) },
                  { label: t("Zinsen gesamt"), value: fmtEUR(planFor.plan.totalInterest) },
                  { label: t("Letzte Rate"), value: planFor.plan.payoffDate ? fmtDate(planFor.plan.payoffDate) : "—" },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-white/[0.06] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-2">{k.label}</div>
                    <div className="num mt-1 text-sm font-medium">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0c0e14] text-left text-[10px] uppercase tracking-wider text-muted-2">
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2.5 font-medium">{t("Nr.")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("Fällig")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("Rate")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("Zinsen")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("Tilgung")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("Danach offen")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {planFor.plan.rows.map((r) => (
                      <tr key={r.n} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-3 py-2 text-muted-2">{r.n}</td>
                        <td className="px-3 py-2">{fmtDate(r.date)}</td>
                        <td className="num px-3 py-2 text-right">{fmtEUR(r.payment)}</td>
                        <td className="num px-3 py-2 text-right text-rose-soft/80">{fmtEUR(r.interest)}</td>
                        <td className="num px-3 py-2 text-right text-emerald-soft/90">{fmtEUR(r.principal)}</td>
                        <td className="num px-3 py-2 text-right text-muted">{fmtEUR(r.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button variant="glass" className="mt-4 w-full" onClick={() => { setReportFor(planFor); setPlanFor(null); }}>
                <FileDown className="h-4 w-4" /> {t("Als PDF exportieren")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Zahlungen */}
      <Dialog open={Boolean(payFor)} onOpenChange={(o) => { if (!o) setPayFor(null); }}>
        <DialogContent>
          <DialogTitle>{t("Zahlungen · {name}", { name: payFor?.counterparty ?? "" })}</DialogTitle>
          <DialogDescription>
            {payFor && payFor.interest_pct > 0
              ? t("Jede Zahlung deckt zuerst die bis dahin aufgelaufenen Zinsen, der Rest tilgt das Kapital.")
              : t("Zinslos — jede Zahlung tilgt vollständig das Kapital.")}
          </DialogDescription>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[110px] flex-1 space-y-1.5">
              <Label>{t("Betrag (€)")}</Label>
              <Input inputMode="decimal" placeholder="250" value={pay.amount_eur} onChange={(e) => setPay({ ...pay, amount_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Am")}</Label>
              <Input type="date" value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} />
            </div>
            <Button onClick={addPayment}><Plus className="h-4 w-4" /> {t("Erfassen")}</Button>
          </div>
          {payError && <div className="mt-2 text-xs text-rose-soft">{payError}</div>}

          {payFor && payFor.payments.length > 0 && (
            <>
              <div className="hairline my-4" />
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {[...payFor.payments].reverse().map((p) => (
                  <div key={p.id} className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-3 py-2 text-xs">
                    <span className="text-muted-2">{fmtDate(p.paid_on)}</span>
                    <div className="flex items-center gap-2">
                      <span className="num font-semibold">{fmtEUR(p.amount_eur)}</span>
                      <button
                        onClick={() => removePayment(p.id)}
                        className="rounded p-1 text-muted-2 opacity-0 transition-all hover:text-rose-soft group-hover:opacity-100 cursor-pointer"
                        title={t("Löschen")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {payFor.state.paidInterest > 0.005 && (
                <div className="mt-3 flex justify-between text-[11px] text-muted-2">
                  <span>{t("davon Zinsen bezahlt")}</span>
                  <span className="num">{fmtEUR(payFor.state.paidInterest)}</span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
