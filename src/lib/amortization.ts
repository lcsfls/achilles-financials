/**
 * Amortisation schedule for a loan with a fixed monthly payment.
 *
 * Deliberately separate from loanState() in loans.ts: that one reports what
 * actually happened (the payments someone entered), this one projects what
 * will happen if the agreed rate is paid on time. Mixing the two would make it
 * impossible to tell a plan from a fact.
 *
 * Monthly periods, interest on the remaining balance, payment covers interest
 * first — the same order loanState() uses, so past and future line up.
 */

export type ScheduleRow = {
  /** 1-based period. */
  n: number;
  /** ISO date of this instalment. */
  date: string;
  /** Balance before the payment. */
  opening: number;
  payment: number;
  interest: number;
  principal: number;
  /** Balance after the payment. */
  closing: number;
};

export type Schedule = {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPaid: number;
  /** Date of the final instalment. */
  payoffDate: string | null;
  /** Whole months until the loan is repaid. */
  months: number;
  /**
   * Set when the rate does not even cover the first month's interest — the
   * balance would grow forever, so no schedule is produced.
   */
  neverPaysOff: boolean;
  /** Minimum rate that would clear the debt, present only when neverPaysOff. */
  minPayment: number | null;
};

/** Same day-of-month one month on, clamped so the 31st does not skip a month. */
function addMonth(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Hard stop so a rounding quirk can never spin forever. */
const MAX_PERIODS = 12 * 60;

export function schedule({
  balance,
  interestPct,
  monthlyPayment,
  startDate,
}: {
  balance: number;
  interestPct: number;
  monthlyPayment: number;
  startDate: string;
}): Schedule {
  const empty: Schedule = {
    rows: [], totalInterest: 0, totalPaid: 0, payoffDate: null,
    months: 0, neverPaysOff: false, minPayment: null,
  };
  if (!(balance > 0) || !(monthlyPayment > 0)) return empty;

  const monthlyRate = (interestPct || 0) / 100 / 12;
  const firstInterest = balance * monthlyRate;

  // A rate at or below the monthly interest never touches the principal.
  // Reporting a 60-year plan would be worse than refusing to draw one.
  if (monthlyPayment <= firstInterest) {
    return { ...empty, neverPaysOff: true, minPayment: round(firstInterest + 0.01) };
  }

  const rows: ScheduleRow[] = [];
  let open = balance;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let n = 1; open > 0 && n <= MAX_PERIODS; n++) {
    const interest = round(open * monthlyRate);
    // Final instalment is only what is left, not the full rate
    const payment = round(Math.min(monthlyPayment, open + interest));
    const principal = round(payment - interest);
    const closing = round(open - principal);

    rows.push({ n, date: addMonth(startDate, n), opening: round(open), payment, interest, principal, closing });
    totalInterest = round(totalInterest + interest);
    totalPaid = round(totalPaid + payment);
    open = closing;
  }

  return {
    rows,
    totalInterest,
    totalPaid,
    payoffDate: rows[rows.length - 1]?.date ?? null,
    months: rows.length,
    neverPaysOff: false,
    minPayment: null,
  };
}
