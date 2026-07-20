/**
 * Pension and life-insurance contracts.
 *
 * The figure that matters is not how much the balance grew — that includes the
 * money you paid in. A balance rising by €2,000 while you contributed €1,800 is
 * a €200 return, not a €2,000 one. So growth and contributions are reported
 * apart, and the return is what remains.
 */

export type Statement = {
  id: number;
  statement_date: string;
  balance_eur: number;
  /** Contributions since the previous statement. */
  contribution_eur: number | null;
  note: string | null;
};

export type ContractStats = {
  latestBalance: number;
  latestDate: string | null;
  firstBalance: number;
  firstDate: string | null;
  /** Balance change from the first statement to the latest. */
  growth: number;
  /** Contributions paid within that window — i.e. after the first statement. */
  contribSince: number;
  /** Growth minus contributions: what the money actually earned. */
  netReturn: number;
  /**
   * Return on the capital that was working: the starting balance plus what was
   * paid in since. A simple money-weighted approximation — not a time-weighted
   * return, because statement dates are too sparse to compute one honestly.
   */
  netReturnPct: number | null;
  /** Every contribution ever recorded, including the first statement's. */
  totalContrib: number;
};

export function contractStats(statements: Statement[]): ContractStats {
  const sorted = [...statements].sort((a, b) => a.statement_date.localeCompare(b.statement_date));
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  const totalContrib = sorted.reduce((s, r) => s + (r.contribution_eur ?? 0), 0);
  // The first statement's contribution produced its opening balance, so it sits
  // outside the measured window.
  const contribSince = sorted.slice(1).reduce((s, r) => s + (r.contribution_eur ?? 0), 0);

  const firstBalance = first?.balance_eur ?? 0;
  const latestBalance = last?.balance_eur ?? 0;
  const growth = sorted.length > 1 ? latestBalance - firstBalance : 0;
  const netReturn = growth - contribSince;

  const invested = firstBalance + contribSince;
  return {
    latestBalance,
    latestDate: last?.statement_date ?? null,
    firstBalance,
    firstDate: first?.statement_date ?? null,
    growth,
    contribSince,
    netReturn,
    // Only meaningful with at least two statements and capital at work
    netReturnPct: sorted.length > 1 && invested > 0 ? (netReturn / invested) * 100 : null,
    totalContrib,
  };
}
