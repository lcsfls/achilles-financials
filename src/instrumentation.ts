/**
 * Server start-up hook — registers the background sync timer.
 *
 * The timer only *checks* every 15 minutes whether a run is due; the actual
 * interval comes from the setting and is floored at 6 hours (PSD2 permits four
 * unattended accesses per day). Checking often but acting rarely keeps the
 * schedule accurate after a container restart without ever calling the bank
 * more than allowed.
 */
export async function register() {
  // Node runtime only — the edge runtime has no timers or SQLite.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isDue, markAutoSync } = await import("./lib/autosync");
  const { syncAccounts } = await import("./lib/enablebanking");

  const CHECK_EVERY = 15 * 60_000;

  const tick = async () => {
    try {
      if (!isDue()) return;
      // Stamp *before* syncing: a failing bank must not retry every 15 minutes.
      markAutoSync();
      const r = await syncAccounts();
      console.log(`[achilles] auto-sync: ${r.accounts} accounts, ${r.transactions} transactions`);
    } catch (e) {
      console.warn("[achilles] auto-sync failed:", e instanceof Error ? e.message : e);
    }
  };

  // Not immediately on boot — let the app finish starting first.
  setTimeout(tick, 60_000);
  setInterval(tick, CHECK_EVERY).unref?.();
}
