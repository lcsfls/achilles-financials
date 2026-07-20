"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { apiJson, fmtEUR, fmtDate } from "@/lib/utils";
import { type ScheduleRow } from "@/lib/amortization";
import type { LoanState } from "@/lib/loans";

/**
 * Printable loan report.
 *
 * A plain page with print styles rather than a generated PDF: the browser's
 * own "save as PDF" produces a real, selectable-text document on every
 * platform, and it keeps a PDF library out of a self-hosted image.
 */

type Loan = {
  id: number; direction: "lent" | "borrowed"; counterparty: string; kind: string;
  principal_eur: number; interest_pct: number; start_date: string; due_date: string | null;
  note: string | null; closed: number; monthly_payment_eur: number | null;
  payments: Array<{ id: number; paid_on: string; amount_eur: number; note: string | null }>;
  state: LoanState;
  plan: { rows: ScheduleRow[]; totalInterest: number; totalPaid: number; payoffDate: string | null; months: number; neverPaysOff: boolean; minPayment: number | null } | null;
};

function Report() {
  const { t } = useI18n();
  const id = Number(useSearchParams().get("id"));
  const [loan, setLoan] = useState<Loan | null>(null);
  const [printedOn, setPrintedOn] = useState("");

  useEffect(() => {
    apiJson<{ loans: Loan[] }>("/api/loans").then((d) => {
      setLoan(d.loans.find((l) => l.id === id) ?? null);
      setPrintedOn(new Date().toISOString().slice(0, 10));
    });
  }, [id]);

  if (!loan) return <div className="p-10 text-sm">{t("Lade …")}</div>;

  const s = loan.state;
  const lent = loan.direction === "lent";

  return (
    <div className="print-doc mx-auto max-w-3xl bg-white p-10 text-black">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          /* The app chrome is navigation, not part of the document */
          body > *:not(.print-root) { display: none !important; }
          .print-doc { max-width: none; padding: 0; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-neutral-100 p-3 text-sm">
        <span>{t("Im Druckdialog „Als PDF sichern“ wählen.")}</span>
        <button onClick={() => window.print()} className="cursor-pointer rounded-md bg-black px-3 py-1.5 text-white">
          {t("Drucken")}
        </button>
      </div>

      <h1 className="text-2xl font-bold">{lent ? t("Darlehen — verliehen") : t("Darlehen — aufgenommen")}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {loan.counterparty} · {t("Stand")} {fmtDate(printedOn)}
      </p>

      <table className="mt-6 w-full text-sm">
        <tbody>
          {[
            [t("Ursprüngliche Summe"), fmtEUR(loan.principal_eur)],
            [t("Zinssatz"), loan.interest_pct ? `${loan.interest_pct} % p. a.` : t("zinslos")],
            [t("Beginn"), fmtDate(loan.start_date)],
            [t("Fällig am"), loan.due_date ? fmtDate(loan.due_date) : "—"],
            [t("Vereinbarte Rate"), loan.monthly_payment_eur ? `${fmtEUR(loan.monthly_payment_eur)} / ${t("Monat")}` : "—"],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-neutral-200">
              <td className="py-2 text-neutral-600">{k}</td>
              <td className="py-2 text-right font-medium">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8 text-lg font-semibold">{t("Aktueller Stand")}</h2>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {[
            [t("Gezahlt insgesamt"), fmtEUR(s.paid)],
            [t("davon Zinsen"), fmtEUR(s.paidInterest)],
            [t("Offenes Kapital"), fmtEUR(s.principalLeft)],
            [t("Aufgelaufene Zinsen"), fmtEUR(s.interestDue)],
            [t("Offen gesamt"), fmtEUR(s.outstanding)],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-neutral-200">
              <td className="py-2 text-neutral-600">{k}</td>
              <td className="py-2 text-right font-medium">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8 text-lg font-semibold">{t("Geleistete Zahlungen")}</h2>
      {loan.payments.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">{t("Noch keine Zahlungen erfasst.")}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2">{t("Datum")}</th>
              <th className="py-2">{t("Notiz")}</th>
              <th className="py-2 text-right">{t("Betrag")}</th>
            </tr>
          </thead>
          <tbody>
            {loan.payments.map((p) => (
              <tr key={p.id} className="border-b border-neutral-200">
                <td className="py-1.5">{fmtDate(p.paid_on)}</td>
                <td className="py-1.5 text-neutral-600">{p.note || "—"}</td>
                <td className="py-1.5 text-right">{fmtEUR(p.amount_eur)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2" colSpan={2}>{t("Summe")}</td>
              <td className="py-2 text-right">{fmtEUR(s.paid)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {loan.plan && !loan.plan.neverPaysOff && loan.plan.rows.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{t("Tilgungsplan")}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {t("Vorausberechnet ab heute bei {rate} monatlich — {months} Raten, {interest} Zinsen, letzte Rate {date}.", {
              rate: fmtEUR(loan.monthly_payment_eur ?? 0),
              months: String(loan.plan.months),
              interest: fmtEUR(loan.plan.totalInterest),
              date: loan.plan.payoffDate ? fmtDate(loan.plan.payoffDate) : "—",
            })}
          </p>
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2">{t("Nr.")}</th>
                <th className="py-2">{t("Fällig")}</th>
                <th className="py-2 text-right">{t("Restschuld")}</th>
                <th className="py-2 text-right">{t("Rate")}</th>
                <th className="py-2 text-right">{t("Zinsen")}</th>
                <th className="py-2 text-right">{t("Tilgung")}</th>
                <th className="py-2 text-right">{t("Danach offen")}</th>
              </tr>
            </thead>
            <tbody>
              {loan.plan.rows.map((r) => (
                <tr key={r.n} className="border-b border-neutral-200">
                  <td className="py-1">{r.n}</td>
                  <td className="py-1">{fmtDate(r.date)}</td>
                  <td className="py-1 text-right">{fmtEUR(r.opening)}</td>
                  <td className="py-1 text-right">{fmtEUR(r.payment)}</td>
                  <td className="py-1 text-right">{fmtEUR(r.interest)}</td>
                  <td className="py-1 text-right">{fmtEUR(r.principal)}</td>
                  <td className="py-1 text-right">{fmtEUR(r.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="mt-8 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
        {t("Erstellt mit Achilles Financials am {date}. Der Tilgungsplan ist eine Vorausberechnung, keine Forderungsaufstellung.", { date: fmtDate(printedOn) })}
      </p>
    </div>
  );
}

export default function LoanPrintPage() {
  return (
    <div className="print-root">
      <Suspense fallback={null}>
        <Report />
      </Suspense>
    </div>
  );
}
