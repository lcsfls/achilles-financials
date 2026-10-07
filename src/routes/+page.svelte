<script lang="ts">
  import { onMount } from "svelte";
  import {
    Wallet, Gem, TrendingUp, PiggyBank, Home, Briefcase, HandCoins, QrCode, Sparkles, RefreshCw,
    ArrowUpRight, ArrowDownRight, ChevronRight,
  } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Segmented from "$lib/components/ui/Segmented.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import AreaChart from "$lib/components/charts/AreaChart.svelte";
  import BarChart from "$lib/components/charts/BarChart.svelte";
  import Donut from "$lib/components/charts/Donut.svelte";
  import Legend from "$lib/components/charts/Legend.svelte";
  import EmergencyFund from "$lib/components/EmergencyFund.svelte";
  import { CATEGORY_COLORS, CATEGORY_EMOJI } from "$lib/categorize";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtNum, fmtUSD0, fmtDate, fmtPct } from "$lib/utils";

  type Summary = {
    accounts: Array<{ id: string; name: string; balance: number; iban: string | null; last_synced: string | null }>;
    cashTotal: number;
    monthly: Array<{ month: string; spent: number; earned: number }>;
    thisMonthCats: Array<{ category: string; total: number; count: number }>;
    thisMonth: { spent: number; earned: number };
    lastMonthSpent: number;
    recent: Array<{ id: string; booking_date: string; amount: number; merchant: string | null; description: string | null; category: string }>;
    metals: { totalValue: number; totalCost: number; holdings: Array<{ metal: string; name: string; color: string; totalGrams: number; currentValue: number | null; totalCost: number }> };
    investments: { value: number; cost: number; count: number };
    pension: { value: number; lastDate: string | null };
    stats: {
      savingsRatePct: number | null;
      cashflow: number;
      avgSpent: number | null;
      fixedCosts: number;
      largestExpense: { merchant: string | null; description: string | null; amount: number } | null;
      topCategory: { category: string; total: number } | null;
      txCount: number;
    };
    netWorth: number;
    history: Array<{ date: string; netWorth: number }>;
    allocation: { gross: number; liabilities: number; items: Array<{ key: string; value: number; pct: number }> };
    demoMode: boolean;
    lastSync: string | null;
  };

  /** Colour, label, icon and page per asset class — the same hues the section pages use. */
  const ALLOC: Record<string, { color: string; label: string; icon: typeof Wallet; href: string }> = {
    cash: { color: "#2f6fed", label: "Liquidität", icon: Wallet, href: "/transactions" },
    investments: { color: "#7950f2", label: "Investments", icon: TrendingUp, href: "/investments" },
    metals: { color: "#c49a1a", label: "Edelmetalle", icon: Gem, href: "/metals" },
    pension: { color: "#12a150", label: "Altersvorsorge", icon: PiggyBank, href: "/pension" },
    property: { color: "#f08c00", label: "Immobilien", icon: Home, href: "/realestate" },
    lent: { color: "#15aabf", label: "Verliehen", icon: HandCoins, href: "/loans" },
    business: { color: "#e64980", label: "Unternehmen", icon: Briefcase, href: "/business" },
  };

  let data = $state<Summary | null>(null);
  let loading = $state(true);
  let range = $state("1y");

  const load = () => apiJson<Summary>("/api/summary").then((d) => (data = d)).finally(() => (loading = false));
  onMount(load);

  const monthShort = (m: number) => new Date(2000, m, 1).toLocaleDateString(prefs.locale, { month: "short" });

  const empty = $derived(data ? data.accounts.length === 0 && data.metals.holdings.length === 0 : false);

  const RANGES = $derived([
    { value: "1m", label: "1M" },
    { value: "3m", label: "3M" },
    { value: "6m", label: "6M" },
    { value: "1y", label: prefs.lang === "de" ? "1J" : "1Y" },
    { value: "all", label: t("Alle") },
  ]);
  const DAYS: Record<string, number> = { "1m": 31, "3m": 92, "6m": 183, "1y": 366, all: 100000 };

  const history = $derived.by(() => {
    if (!data) return [];
    const cutoff = new Date(Date.now() - DAYS[range] * 86400_000).toISOString().slice(0, 10);
    return data.history
      .filter((h) => h.date >= cutoff)
      .map((h) => ({ ...h, label: new Date(h.date).toLocaleDateString(prefs.locale, { day: "numeric", month: "short" }) }));
  });
  const histChange = $derived(history.length > 1 ? history[history.length - 1].netWorth - history[0].netWorth : null);
  const histChangePct = $derived(
    histChange !== null && history[0].netWorth !== 0 ? (histChange / Math.abs(history[0].netWorth)) * 100 : null
  );

  const spendDelta = $derived(data && data.lastMonthSpent > 0 ? ((data.thisMonth.spent - data.lastMonthSpent) / data.lastMonthSpent) * 100 : 0);

  const monthlyData = $derived(
    (data?.monthly ?? []).map((m) => ({
      ...m,
      net: m.earned - m.spent,
      label: monthShort(Number(m.month.slice(5)) - 1),
    }))
  );

  const donutData = $derived.by(() => {
    if (!data) return [];
    const top = data.thisMonthCats.slice(0, 7).map((c) => ({ ...c }));
    const rest = data.thisMonthCats.slice(7).reduce((s, c) => s + c.total, 0);
    if (rest > 0) top.push({ category: "Weitere", total: rest, count: 0 });
    return top;
  });

  /** Unrealised P/L per asset class, where there is one. */
  const plFor = (key: string) => {
    if (!data) return null;
    if (key === "metals") return data.metals.totalValue - data.metals.totalCost;
    if (key === "investments") return data.investments.value - data.investments.cost;
    return null;
  };

  async function loadDemo() {
    loading = true;
    await fetch("/api/demo", { method: "POST" });
    await load();
  }

  const signed = (n: number, f = fmtEUR0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f(Math.abs(n))}`;
</script>

<svelte:head><title>{t("Übersicht")} · Achilles</title></svelte:head>

{#if loading || !data}
  <Loading rows={2} />
{:else if empty}
  <Card class="rise mx-auto mt-10 max-w-lg">
    <EmptyState
      icon={Sparkles}
      title={t("Willkommen bei Achilles")}
      text={t("Verbinde dein Konto per QR-Code oder starte mit Demo-Daten, um das Dashboard zu erkunden.")}
    >
      <Button href="/connect"><QrCode /> {t("Konto verbinden")}</Button>
      <Button variant="secondary" onclick={loadDemo}>{t("Demo-Daten laden")}</Button>
    </EmptyState>
  </Card>
{:else}
  <div class="rise space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">{t("Übersicht")}</h1>
      <div class="flex items-center gap-2">
        {#if data.demoMode}<Badge tone="info">{t("Demo-Modus")}</Badge>{/if}
        {#if data.lastSync}<span class="hidden text-xs text-muted sm:inline">{t("Sync: {date}", { date: fmtDate(data.lastSync) })}</span>{/if}
        <Button variant="secondary" size="sm" onclick={() => { loading = true; load(); }}>
          <RefreshCw /> {t("Aktualisieren")}
        </Button>
      </div>
    </div>

    <!-- Net worth + assets -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3 3xl:grid-cols-4">
      <Card class="xl:col-span-2 3xl:col-span-3">
        <div class="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
          <div>
            <div class="text-[13px] font-medium text-muted">{t("Gesamtvermögen")}</div>
            <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="num text-[34px] font-semibold leading-none tracking-tight">{fmtEUR0(data.netWorth)}</span>
              {#if fmtUSD0(data.netWorth)}<span class="num text-sm text-faint">{fmtUSD0(data.netWorth)}</span>{/if}
            </div>
            {#if histChange !== null}
              <div class={cn("mt-2 flex items-center gap-1 text-[13px] font-medium", histChange >= 0 ? "text-pos" : "text-neg")}>
                {#if histChange >= 0}<ArrowUpRight class="size-4" />{:else}<ArrowDownRight class="size-4" />{/if}
                <span class="num">{signed(histChange)}</span>
                {#if histChangePct !== null}<span class="num">({fmtPct(histChangePct)})</span>{/if}
                <span class="font-normal text-muted">· {RANGES.find((r) => r.value === range)?.label}</span>
              </div>
            {/if}
          </div>
          <Segmented size="sm" bind:value={range} options={RANGES} />
        </div>
        <div class="px-3 pt-2 pb-3">
          {#if history.length > 1}
            <AreaChart
              data={history}
              x="label"
              series={[{ key: "netWorth", label: t("Gesamtvermögen"), color: "var(--info)" }]}
              height={250}
              valueFormat={fmtEUR0}
            />
          {:else}
            <div class="flex h-[250px] flex-col items-center justify-center gap-1 text-center">
              <span class="text-sm text-muted">{t("Der Verlauf beginnt heute.")}</span>
              <span class="max-w-xs text-xs text-faint">{t("Achilles hält dein Vermögen jeden Tag fest, an dem du die Übersicht öffnest.")}</span>
            </div>
          {/if}
        </div>
      </Card>

      <Card class="flex flex-col">
        <CardHeader title={t("Vermögensaufteilung")} subtitle={t("Gesamt {amount}", { amount: fmtEUR0(data.allocation.gross) })} />
        <div class="px-5">
          <!-- one stacked bar: the whole picture at a glance -->
          <div class="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            {#each data.allocation.items as a (a.key)}
              <div style="width: {a.pct}%; background: {ALLOC[a.key]?.color ?? 'var(--faint)'}" title="{t(ALLOC[a.key]?.label ?? a.key)} · {fmtNum(a.pct, 1)} %"></div>
            {/each}
          </div>
        </div>
        <div class="flex-1 px-2 pt-3 pb-3">
          {#each data.allocation.items as a (a.key)}
            {@const meta = ALLOC[a.key]}
            {@const pl = plFor(a.key)}
            <a href={meta?.href ?? "/"} class="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" style="background: color-mix(in srgb, {meta?.color} 13%, transparent); color: {meta?.color}">
                {#if meta}<meta.icon class="size-4" />{/if}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-medium text-ink">{t(meta?.label ?? a.key)}</span>
                <span class="block text-[11px] text-muted">
                  {fmtNum(a.pct, 1)} %{#if pl !== null}<span class={pl >= 0 ? "text-pos" : "text-neg"}> · {signed(pl)}</span>{/if}
                </span>
              </span>
              <span class="num text-[13px] font-semibold">{fmtEUR0(a.value)}</span>
              <ChevronRight class="size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          {/each}
          {#if data.allocation.liabilities > 0}
            <!-- Debt is not a slice of what you own — shown as the step down to net worth. -->
            <div class="mx-3 mt-2 space-y-1.5 border-t border-line pt-3 text-[13px]">
              <div class="flex justify-between"><span class="text-muted">{t("abzüglich Schulden")}</span><span class="num font-medium text-neg">−{fmtEUR0(data.allocation.liabilities)}</span></div>
              <div class="flex justify-between"><span class="font-medium">{t("Gesamtvermögen")}</span><span class="num font-semibold">{fmtEUR0(data.netWorth)}</span></div>
            </div>
          {/if}
        </div>
      </Card>
    </div>

    <!-- This month -->
    <Card>
      <CardHeader title={t("Dieser Monat")} subtitle={new Date().toLocaleDateString(prefs.locale, { month: "long", year: "numeric" })}>
        {#snippet actions()}
          <Button variant="ghost" size="sm" href="/transactions">{t("Transaktionen")} <ChevronRight /></Button>
        {/snippet}
      </CardHeader>
      <div class="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl border-t border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {#each [
          { label: t("Einnahmen"), value: fmtEUR0(data.thisMonth.earned), sub: t("diesen Monat"), tone: "pos" },
          { label: t("Ausgaben"), value: fmtEUR0(data.thisMonth.spent), sub: t("{pct} vs. Vormonat", { pct: fmtPct(spendDelta) }), subTone: spendDelta > 0 ? "neg" : "pos" },
          { label: t("Cashflow"), value: signed(data.stats.cashflow), sub: t("Einnahmen − Ausgaben"), tone: data.stats.cashflow >= 0 ? "pos" : "neg" },
          { label: t("Sparquote"), value: data.stats.savingsRatePct !== null ? `${Math.round(data.stats.savingsRatePct)} %` : "—", sub: data.stats.savingsRatePct !== null ? t("von den Einnahmen") : t("keine Einnahmen erfasst") },
          { label: t("Fixkosten"), value: fmtEUR0(data.stats.fixedCosts), sub: t("Wohnen & Abos") },
          { label: t("Ø Ausgaben"), value: data.stats.avgSpent !== null ? fmtEUR0(data.stats.avgSpent) : "—", sub: data.stats.avgSpent !== null ? t("6-Monats-Schnitt") : t("noch kein voller Monat") },
        ] as k (k.label)}
          <div class="bg-surface px-5 py-4">
            <div class="text-xs font-medium text-muted">{k.label}</div>
            <div class={cn("num mt-1 text-lg font-semibold tracking-tight", k.tone === "pos" && "text-pos", k.tone === "neg" && "text-neg")}>{k.value}</div>
            <div class={cn("mt-0.5 truncate text-[11px]", k.subTone === "neg" ? "text-neg" : k.subTone === "pos" ? "text-pos" : "text-faint")}>{k.sub}</div>
          </div>
        {/each}
      </div>
    </Card>

    <!-- Cash flow + categories -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3 3xl:grid-cols-4">
      <Card class="xl:col-span-2 3xl:col-span-3">
        <CardHeader title={t("Cashflow")} subtitle={t("Einnahmen und Ausgaben der letzten Monate")}>
          {#snippet actions()}
            <Legend items={[{ label: t("Einnahmen"), color: "var(--pos)" }, { label: t("Ausgaben"), color: "var(--neg)" }]} />
          {/snippet}
        </CardHeader>
        <div class="px-3 pb-4">
          <BarChart
            data={monthlyData}
            x="label"
            series={[
              { key: "earned", label: t("Einnahmen"), color: "var(--pos)" },
              { key: "spent", label: t("Ausgaben"), color: "var(--neg)" },
            ]}
            height={340}
            valueFormat={fmtEUR}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Ausgaben nach Kategorie")} subtitle={monthShort(new Date().getMonth())} />
        <div class="flex flex-col items-center gap-5 px-5 pb-5">
          <Donut
            size={176}
            thickness={20}
            format={fmtEUR0}
            segments={donutData.map((c) => ({ key: c.category, label: t(c.category), value: c.total, color: CATEGORY_COLORS[c.category] ?? "var(--faint)" }))}
          >
            {#snippet center()}
              <span class="text-[11px] text-muted">{t("Gesamt")}</span>
              <span class="num text-lg font-semibold">{fmtEUR0(data?.thisMonth.spent ?? 0)}</span>
            {/snippet}
          </Donut>
          <div class="w-full space-y-2">
            {#each donutData.slice(0, 6) as c (c.category)}
              {@const share = data.thisMonth.spent > 0 ? (c.total / data.thisMonth.spent) * 100 : 0}
              <div>
                <div class="flex items-center justify-between gap-2 text-[13px]">
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="text-sm leading-none">{CATEGORY_EMOJI[c.category] ?? "•"}</span>
                    <span class="truncate text-ink-2">{t(c.category)}</span>
                  </span>
                  <span class="num font-medium">{fmtEUR0(c.total)}</span>
                </div>
                <Progress class="mt-1" height={4} value={share} color={CATEGORY_COLORS[c.category] ?? "var(--faint)"} />
              </div>
            {/each}
            {#if donutData.length === 0}
              <p class="py-4 text-center text-sm text-muted">{t("Noch keine Ausgaben in diesem Monat.")}</p>
            {/if}
          </div>
        </div>
      </Card>
    </div>

    <!-- Recent transactions + side cards -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3 3xl:grid-cols-4">
      <Card class="xl:col-span-2 3xl:col-span-3">
        <CardHeader title={t("Letzte Transaktionen")}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" href="/transactions">{t("Alle ansehen")} <ChevronRight /></Button>
          {/snippet}
        </CardHeader>
        <ul class="divide-y divide-line border-t border-line">
          {#each data.recent as tx (tx.id)}
            <li class="flex items-center gap-3 px-5 py-3">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                style="background: color-mix(in srgb, {CATEGORY_COLORS[tx.category] ?? 'var(--faint)'} 14%, transparent)"
              >{CATEGORY_EMOJI[tx.category] ?? "•"}</span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{tx.merchant || tx.description || "—"}</div>
                <div class="truncate text-xs text-muted">{t(tx.category)} · {fmtDate(tx.booking_date)}</div>
              </div>
              <span class={cn("num shrink-0 text-sm font-semibold", tx.amount > 0 ? "text-pos" : "text-ink")}>
                {tx.amount > 0 ? "+" : ""}{fmtEUR(tx.amount)}
              </span>
            </li>
          {/each}
        </ul>
      </Card>

      <div class="flex flex-col gap-5">
        <EmergencyFund monthlySpending={data.thisMonth.spent} onchange={load} />

        <Card>
          <CardHeader title={t("Edelmetall-Allokation")}>
            {#snippet actions()}
              <Button variant="ghost" size="icon-sm" href="/metals" aria-label={t("Details →")}><ChevronRight /></Button>
            {/snippet}
          </CardHeader>
          <div class="space-y-4 px-5 pb-5">
            {#if data.metals.holdings.length === 0}
              <p class="py-4 text-center text-sm text-muted">{t("Noch keine Edelmetalle erfasst.")}</p>
            {/if}
            {#each data.metals.holdings as h (h.metal)}
              {@const pct = data.metals.totalValue > 0 && h.currentValue ? (h.currentValue / data.metals.totalValue) * 100 : 0}
              {@const pl = (h.currentValue ?? 0) - h.totalCost}
              <div>
                <div class="mb-1.5 flex items-center justify-between text-[13px]">
                  <span class="flex items-center gap-2 font-medium">
                    <span class="size-2.5 rounded-full" style="background: {h.color}"></span>
                    {t(h.name)}
                    <span class="text-xs font-normal text-muted">{fmtNum(h.totalGrams)} g</span>
                  </span>
                  <span class="num font-semibold">{h.currentValue !== null ? fmtEUR0(h.currentValue) : "—"}</span>
                </div>
                <Progress height={6} value={pct} color={h.color} />
                <div class={cn("num mt-1 text-right text-[11px]", pl >= 0 ? "text-pos" : "text-neg")}>{signed(pl)}</div>
              </div>
            {/each}
          </div>
        </Card>
      </div>
    </div>
  </div>
{/if}
