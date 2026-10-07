import { db } from "./db";

export type Snapshot = { date: string; netWorth: number };

/**
 * Record today's net worth and return the stored history.
 *
 * Called from the summary endpoint, so the line grows by itself every day the
 * dashboard is opened. Re-opening on the same day overwrites that day's value —
 * the last reading of a day wins.
 */
export function recordAndLoad(netWorth: number, gross: number, liabilities: number, demo: boolean): Snapshot[] {
  const d = db();
  const today = new Date().toISOString().slice(0, 10);
  const flag = demo ? 1 : 0;

  if (demo) seedDemoHistory(netWorth, today);

  d.prepare(
    `INSERT INTO networth_snapshots (date, demo, net_worth, gross, liabilities) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, demo) DO UPDATE SET net_worth = excluded.net_worth, gross = excluded.gross, liabilities = excluded.liabilities`
  ).run(today, flag, netWorth, gross, liabilities);

  return (
    d
      .prepare("SELECT date, net_worth AS netWorth FROM networth_snapshots WHERE demo = ? AND date >= date('now', '-5 years') ORDER BY date")
      .all(flag) as Snapshot[]
  );
}

/**
 * A believable year of history for the demo, so the chart has something to
 * show on first look. Weekly points, a gentle upward drift with noise, ending
 * at today's demo net worth. Deterministic — the same demo looks the same
 * every time. Only written once; real data never gets synthetic history.
 */
function seedDemoHistory(current: number, today: string) {
  const d = db();
  const have = (d.prepare("SELECT COUNT(*) AS c FROM networth_snapshots WHERE demo = 1 AND date < ?").get(today) as { c: number }).c;
  if (have > 0) return;

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

  const weeks = 52;
  const start = current * 0.78;
  const ins = d.prepare("INSERT OR IGNORE INTO networth_snapshots (date, demo, net_worth, gross, liabilities) VALUES (?, 1, ?, ?, 0)");
  const tx = d.transaction(() => {
    let noise = 0;
    for (let w = weeks; w >= 1; w--) {
      const day = new Date(Date.now() - w * 7 * 86400_000).toISOString().slice(0, 10);
      const progress = (weeks - w) / weeks;
      noise = noise * 0.7 + rand() * 0.035;
      const v = (start + (current - start) * progress) * (1 + noise);
      ins.run(day, Math.round(v * 100) / 100, Math.round(v * 100) / 100);
    }
  });
  tx();
}
