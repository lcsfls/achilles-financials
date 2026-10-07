<script lang="ts" module>
  export type DetailItem = {
    id: number; symbol: string; label: string | null; added_at: string;
    quote: {
      name: string | null; price: number; prevClose: number | null; changePct: number | null;
      currency: string; priceEur: number | null; fetchedAt: string; stale: boolean;
    } | null;
    since: { pct: number; abs: number; currency: string } | null;
  };
</script>

<script lang="ts">
  import { TrendingUp, TrendingDown, CalendarPlus } from "@lucide/svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Segmented from "$lib/components/ui/Segmented.svelte";
  import AreaChart from "$lib/components/charts/AreaChart.svelte";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { cn, displayCurrency, fmtEUR, fmtNum, fmtPct, fmtDate, fmtDateTime } from "$lib/utils";

  type Point = { t: number; c: number };

  let { item, open = $bindable(false) }: { item: DetailItem | null; open?: boolean } = $props();

  /** Selectable ranges — the labels stay short so they fit on a phone. */
  const RANGES = [
    { key: "1d", de: "1T", en: "1D" },
    { key: "5d", de: "1W", en: "1W" },
    { key: "1mo", de: "1M", en: "1M" },
    { key: "6mo", de: "6M", en: "6M" },
    { key: "1y", de: "1J", en: "1Y" },
    { key: "5y", de: "5J", en: "5Y" },
  ];

  let range = $state("6mo");
  let points = $state<Point[] | null>(null);
  let failed = $state(false);

  // Reopening on another tile starts from the default range again.
  $effect(() => {
    if (open && item) range = "6mo";
  });

  $effect(() => {
    if (!open || !item) return;
    const symbol = item.symbol;
    const r = range;
    // A new symbol must not show the previous one's chart — reset before loading.
    points = null;
    failed = false;
    let cancelled = false;
    fetch(`/api/watchlist/history?symbol=${encodeURIComponent(symbol)}&range=${r}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => { if (!cancelled) points = d.points; })
      .catch(() => { if (!cancelled) failed = true; });
    return () => { cancelled = true; };
  });

  const q = $derived(item?.quote ?? null);
  const first = $derived(points?.[0]?.c);
  const last = $derived(points?.[points.length - 1]?.c);
  // Change over the *selected* range — not the daily change, which is separate.
  const rangePct = $derived(first && last ? ((last - first) / first) * 100 : null);
  const color = $derived((rangePct ?? 0) >= 0 ? "var(--pos)" : "var(--neg)");
  // Intraday ranges want a time, longer ones a date.
  const intraday = $derived(range === "1d" || range === "5d");
  const chartData = $derived(
    (points ?? []).map((p) => ({
      c: p.c,
      label: intraday
        ? new Date(p.t).toLocaleTimeString(prefs.locale, { hour: "2-digit", minute: "2-digit" })
        : new Date(p.t).toLocaleDateString(prefs.locale, { day: "2-digit", month: "short" }),
      full: fmtDateTime(new Date(p.t).toISOString()),
    }))
  );
</script>

<Dialog bind:open title={item ? item.label || q?.name || item.symbol : ""} description={item?.symbol} class="max-w-2xl">
  {#if item}
    {#if q}
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="num text-3xl font-semibold tracking-tight">
            {fmtNum(q.price)} <span class="text-base font-normal text-muted">{q.currency}</span>
          </div>
          {#if q.priceEur !== null && q.currency !== displayCurrency()}
            <div class="num mt-0.5 text-xs text-muted">{fmtEUR(q.priceEur)}</div>
          {/if}
        </div>
        {#if q.changePct !== null}
          <div
            class={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold", q.changePct >= 0 ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg")}
            title={t("Veränderung heute")}
          >
            {#if q.changePct >= 0}<TrendingUp class="size-4" />{:else}<TrendingDown class="size-4" />{/if}
            <span class="num">{fmtPct(q.changePct)}</span>
            <span class="text-[11px] font-normal opacity-75">{t("heute")}</span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <Segmented size="sm" bind:value={range} options={RANGES.map((r) => ({ value: r.key, label: prefs.lang === "de" ? r.de : r.en }))} />
      <!-- The range's own change, so the buttons mean something -->
      {#if rangePct !== null}
        <span class={cn("num ml-auto text-sm font-semibold", rangePct >= 0 ? "text-pos" : "text-neg")}>{fmtPct(rangePct)}</span>
      {/if}
    </div>

    <div class="mt-3">
      {#if points && points.length > 1}
        <AreaChart data={chartData} x="label" series={[{ key: "c", label: q?.currency ?? "", color }]} height={280} yFormat={(v) => fmtNum(v, 0)} valueFormat={(v) => fmtNum(v)} />
      {:else}
        <div class="flex h-[280px] items-center justify-center text-sm text-muted">
          {#if failed}{t("Kein Verlauf für diesen Zeitraum verfügbar.")}{:else}<span class="animate-pulse">{t("Lade Verlauf …")}</span>{/if}
        </div>
      {/if}
    </div>

    <!-- Facts that belong to the position, not the market -->
    <div class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
      <div>
        <div class="text-xs text-muted">{t("Auf der Watchlist seit")}</div>
        <div class="mt-0.5 flex items-center gap-1.5"><CalendarPlus class="size-3.5 text-faint" />{fmtDate(item.added_at)}</div>
      </div>
      <div>
        <div class="text-xs text-muted">{t("Seit Aufnahme")}</div>
        <div class="mt-0.5">
          {#if item.since}
            <span class={cn("num font-semibold", item.since.pct >= 0 ? "text-pos" : "text-neg")}>
              {fmtPct(item.since.pct)}
              <span class="ml-1 font-normal text-muted">({item.since.abs >= 0 ? "+" : ""}{fmtNum(item.since.abs)} {item.since.currency})</span>
            </span>
          {:else}
            <!-- Added before entry prices were recorded — say so rather than claim 0 % -->
            <span class="text-muted">{t("kein Einstandskurs erfasst")}</span>
          {/if}
        </div>
      </div>
      {#if q}
        <div>
          <div class="text-xs text-muted">{t("Kurs von")}</div>
          <div class="mt-0.5 text-ink-2">{fmtDateTime(q.fetchedAt)}{#if q.stale}<span class="ml-1 text-warn">{t("(veraltet)")}</span>{/if}</div>
        </div>
      {/if}
    </div>
  {/if}
</Dialog>
