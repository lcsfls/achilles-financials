/**
 * Loan report as a self-contained HTML document.
 *
 * One string feeds both the on-screen preview and the printed page, so what is
 * previewed is exactly what comes out. Printing happens by writing this into an
 * iframe and printing that: trying to hide the rest of the app with print CSS
 * means guessing at the layout's DOM shape, and guessing wrong prints a blank
 * sheet — which is precisely what happened before.
 *
 * The document carries its own CSS and no Tailwind, so it does not depend on
 * the app's stylesheet reaching the iframe.
 */

import type { LoanState } from "./loans";
import type { ScheduleRow } from "./amortization";

export type ReportLoan = {
  id: number;
  direction: "lent" | "borrowed";
  counterparty: string;
  principal_eur: number;
  interest_pct: number;
  start_date: string;
  due_date: string | null;
  monthly_payment_eur: number | null;
  payments: Array<{ id: number; paid_on: string; amount_eur: number; note: string | null }>;
  state: LoanState;
  plan: { rows: ScheduleRow[]; totalInterest: number; months: number; payoffDate: string | null; neverPaysOff: boolean } | null;
};

export type ReportStrings = {
  titleLent: string; titleBorrowed: string;
  asOf: string; principal: string; rate: string; noInterest: string; start: string; due: string;
  agreedPayment: string; perMonth: string;
  currentState: string; paidTotal: string; ofWhichInterest: string;
  principalLeft: string; accruedInterest: string; outstanding: string;
  paymentsMade: string; noPayments: string; date: string; note: string; amount: string; total: string;
  schedule: string; scheduleIntro: string;
  no: string; dueCol: string; balance: string; payment: string; interest: string; principalCol: string; after: string;
  footer: string;
};

/**
 * Escape anything that reaches the markup.
 *
 * Counterparty names and payment notes are typed by the user and land in
 * innerHTML on both paths. Without this, a note containing a tag would be
 * parsed as markup rather than shown as text.
 */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
  *{ box-sizing: border-box; }
  body { margin: 0; font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #111; background: #fff; }
  .doc { max-width: 760px; margin: 0 auto; padding: 32px; }
  h1 { font-size: 21px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; }
  .sub { color: #666; margin: 0 0 4px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 0; text-align: left; }
  tbody tr { border-bottom: 1px solid #e5e5e5; }
  .facts td:first-child { color: #666; }
  .facts td:last-child, .num { text-align: right; font-variant-numeric: tabular-nums; }
  thead tr { border-bottom: 2px solid #111; }
  thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #444; }
  .plan { font-size: 11px; }
  .plan td, .plan th { padding: 4px 6px; }
  .plan td:not(:nth-child(2)), .plan th:not(:nth-child(2)) { text-align: right; }
  .plan td:first-child, .plan th:first-child { text-align: left; color: #777; }
  .sum td { font-weight: 600; border-bottom: none; }
  .foot { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd; color: #777; font-size: 11px; }
  @page { size: A4; margin: 16mm; }
  @media print {
    .doc { max-width: none; padding: 0; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
  }
`;

export function loanReportHtml({
  loan, s, fmtEUR, fmtDate, today,
}: {
  loan: ReportLoan;
  s: ReportStrings;
  fmtEUR: (v: number) => string;
  fmtDate: (v: string) => string;
  today: string;
}): string {
  const facts: Array<[string, string]> = [
    [s.principal, fmtEUR(loan.principal_eur)],
    [s.rate, loan.interest_pct ? `${loan.interest_pct} % p. a.` : s.noInterest],
    [s.start, fmtDate(loan.start_date)],
    [s.due, loan.due_date ? fmtDate(loan.due_date) : "—"],
    [s.agreedPayment, loan.monthly_payment_eur ? `${fmtEUR(loan.monthly_payment_eur)} / ${s.perMonth}` : "—"],
  ];
  const state: Array<[string, string]> = [
    [s.paidTotal, fmtEUR(loan.state.paid)],
    [s.ofWhichInterest, fmtEUR(loan.state.paidInterest)],
    [s.principalLeft, fmtEUR(loan.state.principalLeft)],
    [s.accruedInterest, fmtEUR(loan.state.interestDue)],
    [s.outstanding, fmtEUR(loan.state.outstanding)],
  ];
  const rows = (list: Array<[string, string]>) =>
    list.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");

  const payments = loan.payments.length
    ? `<table><thead><tr><th>${esc(s.date)}</th><th>${esc(s.note)}</th><th class="num">${esc(s.amount)}</th></tr></thead><tbody>
         ${loan.payments
           .map((p) => `<tr><td>${esc(fmtDate(p.paid_on))}</td><td>${esc(p.note || "—")}</td><td class="num">${esc(fmtEUR(p.amount_eur))}</td></tr>`)
           .join("")}
         <tr class="sum"><td colspan="2">${esc(s.total)}</td><td class="num">${esc(fmtEUR(loan.state.paid))}</td></tr>
       </tbody></table>`
    : `<p class="sub">${esc(s.noPayments)}</p>`;

  const plan =
    loan.plan && !loan.plan.neverPaysOff && loan.plan.rows.length
      ? `<h2>${esc(s.schedule)}</h2>
         <p class="sub">${esc(s.scheduleIntro)}</p>
         <table class="plan"><thead><tr>
           <th>${esc(s.no)}</th><th>${esc(s.dueCol)}</th><th>${esc(s.balance)}</th>
           <th>${esc(s.payment)}</th><th>${esc(s.interest)}</th><th>${esc(s.principalCol)}</th><th>${esc(s.after)}</th>
         </tr></thead><tbody>
           ${loan.plan.rows
             .map(
               (r) =>
                 `<tr><td>${r.n}</td><td>${esc(fmtDate(r.date))}</td><td>${esc(fmtEUR(r.opening))}</td>` +
                 `<td>${esc(fmtEUR(r.payment))}</td><td>${esc(fmtEUR(r.interest))}</td>` +
                 `<td>${esc(fmtEUR(r.principal))}</td><td>${esc(fmtEUR(r.closing))}</td></tr>`
             )
             .join("")}
         </tbody></table>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(loan.direction === "lent" ? s.titleLent : s.titleBorrowed)} — ${esc(loan.counterparty)}</title>
<style>${CSS}</style></head><body><div class="doc">
  <h1>${esc(loan.direction === "lent" ? s.titleLent : s.titleBorrowed)}</h1>
  <p class="sub">${esc(loan.counterparty)} · ${esc(s.asOf)} ${esc(fmtDate(today))}</p>
  <table class="facts"><tbody>${rows(facts)}</tbody></table>
  <h2>${esc(s.currentState)}</h2>
  <table class="facts"><tbody>${rows(state)}</tbody></table>
  <h2>${esc(s.paymentsMade)}</h2>
  ${payments}
  ${plan}
  <p class="foot">${esc(s.footer)}</p>
</div></body></html>`;
}
