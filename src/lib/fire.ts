/** Gemeinsame Definition der FIRE-Parameter für API und Oberfläche. */
export type AssetToggles = { cash: boolean; metals: boolean; investments: boolean; pension: boolean };

export type FireParams = {
  age: number;
  monthlySavings: number;
  annualReturnPct: number;
  inflationPct: number;
  withdrawalRatePct: number;
  monthlyExpenses: number;
  /** null = automatisch aus den gewählten Bausteinen */
  startNetWorth: number | null;
  include: AssetToggles;
};

export const DEFAULT_PARAMS: FireParams = {
  age: 30,
  monthlySavings: 1500,
  annualReturnPct: 6.5,
  inflationPct: 2.0,
  withdrawalRatePct: 3.5,
  monthlyExpenses: 2500,
  startNetWorth: null,
  include: { cash: true, metals: true, investments: true, pension: true },
};

export function normalizeParams(raw: unknown): FireParams {
  const p = (raw ?? {}) as Partial<FireParams>;
  return {
    ...DEFAULT_PARAMS,
    ...p,
    include: { ...DEFAULT_PARAMS.include, ...(p.include ?? {}) },
  };
}

export type Assets = { cash: number; metals: number; investments: number; pension: number };

/** Startkapital aus den angehakten Bausteinen. */
export function startCapital(params: FireParams, assets: Assets): number {
  if (params.startNetWorth !== null) return params.startNetWorth;
  let sum = 0;
  if (params.include.cash) sum += assets.cash;
  if (params.include.metals) sum += assets.metals;
  if (params.include.investments) sum += assets.investments;
  if (params.include.pension) sum += assets.pension;
  return sum;
}

export type Projection = {
  start: number;
  fireNumber: number;
  yearsToFire: number | null;
  fireAge: number | null;
  fireYear: number | null;
  progressPct: number;
  realAnnualPct: number;
  series: Array<{ year: number; age: number; value: number }>;
};

/**
 * Alles inflationsbereinigt in heutiger Kaufkraft: Die Realrendite trägt die
 * Verzinsung, die Sparrate bleibt konstant in heutigem Geld.
 */
export function project(params: FireParams, assets: Assets, nowYear: number): Projection {
  const start = startCapital(params, assets);
  const fireNumber = (params.monthlyExpenses * 12) / (params.withdrawalRatePct / 100);
  const realAnnual = (1 + params.annualReturnPct / 100) / (1 + params.inflationPct / 100) - 1;
  const monthlyR = Math.pow(1 + realAnnual, 1 / 12) - 1;

  const MAX_MONTHS = 12 * 60;
  let value = start;
  let fireMonth: number | null = value >= fireNumber ? 0 : null;
  const series: Projection["series"] = [{ year: 0, age: params.age, value: Math.round(value) }];

  for (let m = 1; m <= MAX_MONTHS; m++) {
    value = value * (1 + monthlyR) + params.monthlySavings;
    if (fireMonth === null && value >= fireNumber) fireMonth = m;
    if (m % 12 === 0) series.push({ year: m / 12, age: params.age + m / 12, value: Math.round(value) });
    if (fireMonth !== null && m >= fireMonth + 12 * 6 && m % 12 === 0 && series.length > 8) break;
  }

  const yearsToFire = fireMonth !== null ? fireMonth / 12 : null;
  return {
    start,
    fireNumber,
    yearsToFire,
    fireAge: yearsToFire !== null ? params.age + yearsToFire : null,
    fireYear: yearsToFire !== null ? Math.round(nowYear + yearsToFire) : null,
    progressPct: fireNumber > 0 ? Math.min(100, (start / fireNumber) * 100) : 0,
    realAnnualPct: realAnnual * 100,
    series,
  };
}
