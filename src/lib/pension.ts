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

  /*
   * The line items a German statement prints. Every one optional: a bare
   * balance is still a valid statement, and most people will not type all of
   * this in. When they do, the year becomes fully explainable.
   */
  prev_balance_eur: number | null;
  fund_performance_eur: number | null;
  earned_returns_eur: number | null;
  acquisition_costs_eur: number | null;
  admin_costs_eur: number | null;
  /** Contributions since inception, as printed on the statement. */
  total_paid_eur: number | null;
};

export type Waterfall = {
  prevBalance: number;
  contribution: number;
  fundPerformance: number;
  earnedReturns: number;
  acquisitionCosts: number;
  adminCosts: number;
  costsTotal: number;
  /** Gross gain before costs. */
  grossGain: number;
  /** What is left after the insurer took its share. */
  netGain: number;
  /** prev + contribution + gains - costs, i.e. what the balance should be. */
  computed: number;
  /** computed - actual balance. Non-zero means a line item is off. */
  difference: number;
  /** True when the difference is large enough to be a real mistake. */
  mismatch: boolean;
  /** Share of the year's contribution eaten by costs, 0..1, null if no contribution. */
  costRatio: number | null;
};

/**
 * Reconstruct a statement's year from its line items.
 *
 * Returns null unless a previous balance and at least one movement are present
 * — a half-filled form should show nothing rather than a waterfall built from
 * assumed zeros.
 */
export function waterfall(s: Statement): Waterfall | null {
  const has = (v: number | null) => v !== null && v !== undefined;
  const movements = [s.fund_performance_eur, s.earned_returns_eur, s.acquisition_costs_eur, s.admin_costs_eur];
  if (!has(s.prev_balance_eur) || !movements.some(has)) return null;

  const prevBalance = s.prev_balance_eur ?? 0;
  const contribution = s.contribution_eur ?? 0;
  const fundPerformance = s.fund_performance_eur ?? 0;
  const earnedReturns = s.earned_returns_eur ?? 0;
  // Costs are entered as positive amounts — they are printed as deductions,
  // and asking for a minus sign invites getting the direction wrong.
  const acquisitionCosts = Math.abs(s.acquisition_costs_eur ?? 0);
  const adminCosts = Math.abs(s.admin_costs_eur ?? 0);

  const costsTotal = acquisitionCosts + adminCosts;
  const grossGain = fundPerformance + earnedReturns;
  const computed = prevBalance + contribution + grossGain - costsTotal;
  const difference = computed - s.balance_eur;

  return {
    prevBalance, contribution, fundPerformance, earnedReturns,
    acquisitionCosts, adminCosts, costsTotal,
    grossGain,
    netGain: grossGain - costsTotal,
    computed,
    difference,
    // Tolerant on purpose: statements round to the cent and some insurers
    // fold small items into a line we do not ask for. Only flag a gap big
    // enough to be a typo rather than rounding.
    mismatch: Math.abs(difference) > Math.max(1, s.balance_eur * 0.005),
    costRatio: contribution > 0 ? costsTotal / contribution : null,
  };
}

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
  /** Contributions since inception — printed figure if available, else our sum. */
  totalContrib: number;
  /** True when totalContrib came from the statement rather than our own sum. */
  contribFromStatement: boolean;
};

export function contractStats(statements: Statement[]): ContractStats {
  const sorted = [...statements].sort((a, b) => a.statement_date.localeCompare(b.statement_date));
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;

  // Prefer the lifetime figure printed on the newest statement that has one:
  // our own sum only reaches back to the first statement that was entered,
  // which understates a contract someone started tracking late.
  const printed = [...sorted].reverse().find((r) => r.total_paid_eur != null)?.total_paid_eur ?? null;
  const summed = sorted.reduce((s, r) => s + (r.contribution_eur ?? 0), 0);
  const totalContrib = printed ?? summed;
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
    contribFromStatement: printed !== null,
  };
}
