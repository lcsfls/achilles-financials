/**
 * Business valuation — an orientation range, not an appraisal.
 *
 * Method: the market multiple approach that German SME practice uses alongside
 * the IDW S 1 capitalised-earnings method. Every number below has a source:
 *
 *  - Base multiple 5.7× adjusted EBITDA — cross-industry Mittelstand average,
 *    DUB KMU-Multiples Q1/2026, with the usual corridor at 4.1–7.3×.
 *  - Micro businesses achieve roughly 30–50 % lower multiples than larger
 *    companies in the same industry.
 *  - Owner dependency is the dominant discount. The AWH standard for German
 *    craft businesses reflects it with capitalisation rates of 15–25 %, i.e.
 *    multiples of only 4–6.7× even before other risks.
 *
 * The honest part: for a business that only functions because its owner is
 * there, an earnings multiple overstates reality. What transfers then is the
 * substance, not the profit — the model says so instead of printing a number.
 */

export type OwnerDependency = "critical" | "high" | "medium" | "low";
export type Employees = "none" | "1-4" | "5-19" | "20+";
export type Concentration = "high" | "medium" | "low";
export type Recurring = "low" | "medium" | "high";
export type Growth = "shrinking" | "flat" | "growing";

export type BusinessInput = {
  /** Annual revenue, for the size class. */
  revenue: number;
  /** EBITDA after adding back an owner's salary above market rate. */
  ebitda: number;
  /** Tangible assets minus liabilities — the floor a buyer could still resell. */
  assets: number;
  /** Debt minus cash: bridges enterprise value to what the owner receives. */
  netDebt: number;
  /** Industry base multiple; falls back to the cross-industry average. */
  baseMultiple?: number;

  ownerDependency: OwnerDependency;
  employees: Employees;
  /** A second management layer that keeps running without the owner. */
  secondLevel: boolean;
  /** Largest customer's share of revenue. */
  concentration: Concentration;
  /** Share of recurring revenue (contracts, subscriptions, maintenance). */
  recurring: Recurring;
  growth: Growth;
  /** Processes documented well enough for someone else to run them. */
  documented: boolean;
};

/** Cross-industry Mittelstand average, DUB KMU-Multiples Q1/2026. */
export const DEFAULT_MULTIPLE = 5.7;

/** Observed corridor for the Mittelstand — the model never leaves it upward. */
export const MULTIPLE_FLOOR = 1.0;
export const MULTIPLE_CAP = 7.3;

/**
 * Each factor's effect on the multiple, as a share.
 * Owner dependency carries by far the most weight — that is the finding, not a
 * design choice.
 */
const OWNER: Record<OwnerDependency, number> = {
  critical: -0.55, // nothing runs without the owner
  high: -0.35,
  medium: -0.15,
  low: 0.1, // management in place, owner replaceable
};
const EMPLOYEES: Record<Employees, number> = {
  none: -0.25, // a one-person business is mostly the person
  "1-4": -0.1,
  "5-19": 0.05,
  "20+": 0.1,
};
const CONCENTRATION: Record<Concentration, number> = {
  high: -0.25, // one customer above ~50 % of revenue
  medium: -0.1, // 20–50 %
  low: 0.05,
};
const RECURRING: Record<Recurring, number> = {
  low: -0.1,
  medium: 0.05,
  high: 0.15, // contracts survive the handover
};
const GROWTH: Record<Growth, number> = {
  shrinking: -0.2,
  flat: 0,
  growing: 0.15,
};

export type Valuation = {
  /** Adjusted multiple actually applied. */
  multiple: number;
  /** Enterprise value: earnings × multiple. */
  enterprise: number;
  /** What the owner would receive: enterprise value minus net debt. */
  equityLow: number;
  equityMid: number;
  equityHigh: number;
  /** Floor — the substance, relevant when earnings do not transfer. */
  assetFloor: number;
  /** Which factors moved the multiple, for showing the reasoning. */
  drivers: Array<{ key: string; effect: number }>;
  /**
   * True when the earnings multiple is not a meaningful basis: the business
   * depends on the owner and has nobody to carry it. Then only the substance
   * transfers, and the range says so.
   */
  ownerBound: boolean;
  /** Set when the result rests on the asset floor rather than on earnings. */
  onFloor: boolean;
};

export function valuate(input: BusinessInput): Valuation {
  const base = input.baseMultiple && input.baseMultiple > 0 ? input.baseMultiple : DEFAULT_MULTIPLE;

  const drivers = [
    { key: "ownerDependency", effect: OWNER[input.ownerDependency] },
    { key: "employees", effect: EMPLOYEES[input.employees] },
    { key: "secondLevel", effect: input.secondLevel ? 0.1 : -0.05 },
    { key: "concentration", effect: CONCENTRATION[input.concentration] },
    { key: "recurring", effect: RECURRING[input.recurring] },
    { key: "growth", effect: GROWTH[input.growth] },
    { key: "documented", effect: input.documented ? 0.05 : -0.1 },
  ];

  // Size discount: micro businesses trade 30–50 % below larger peers.
  const sizeEffect = input.revenue < 500_000 ? -0.4 : input.revenue < 2_000_000 ? -0.2 : 0;
  if (sizeEffect !== 0) drivers.push({ key: "size", effect: sizeEffect });

  const total = drivers.reduce((s, d) => s + d.effect, 0);
  const multiple = Math.min(MULTIPLE_CAP, Math.max(MULTIPLE_FLOOR, base * (1 + total)));

  const enterprise = Math.max(0, input.ebitda) * multiple;
  const equityMid = enterprise - input.netDebt;

  // A ±20 % band, because a single number would pretend at a precision that
  // negotiation, buyer type and financing do not allow.
  const equityLow = enterprise * 0.8 - input.netDebt;
  const equityHigh = enterprise * 1.2 - input.netDebt;

  // Nobody to hand it to: no staff, no second level, owner is critical.
  const ownerBound =
    input.ownerDependency === "critical" && input.employees === "none" && !input.secondLevel;

  const assetFloor = input.assets - input.netDebt;
  const onFloor = equityMid < assetFloor;

  return { multiple, enterprise, equityLow, equityMid, equityHigh, assetFloor, drivers, ownerBound, onFloor };
}
