<script lang="ts">
  import { onMount } from "svelte";
  import { Repeat, CalendarClock, TrendingUp, TrendingDown, EyeOff, Undo2, ChevronRight } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import { CATEGORY_COLORS, CATEGORY_EMOJI } from "$lib/categorize";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtDate, fmtNum } from "$lib/utils";

  type Recurring = {
    key: string; merchant: string; category: string;
    frequency: "weekly" | "monthly" | "quarterly" | "halfyearly" | "yearly";
    amount: number; lastAmount: number;
    priceChange: { from: number; to: number; pct: number; since: string } | null;
    savings: boolean; monthly: number; yearly: number; count: number;
    firstDate: string; lastDate: string; nextDate: string; active: boolean;
  };

  let data = $state<{ recurring: Recurring[]; ignored: Recurring[] } | null>(null);
  let showIgnored = $state(false);

  const load = () => apiJson<{ recurring: Recurring[]; ignored: Recurring[] }>("/api/recurring").then((d) => (data = d));
  onMount(load);

  async function ignore(key: string, ignored: boolean) {
    await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ignored }),
    });
    load();
  }

  const FREQ: Record<Recurring["frequency"], string> = {
    weekly: "wöchentlich",
    monthly: "monatlich",
    quarterly: "vierteljährlich",
    halfyearly: "halbjährlich",
    yearly: "jährlich",
  };

  const costs = $derived((data?.recurring ?? []).filter((r) => r.active && !r.savings));
  const plans = $derived((data?.recurring ?? []).filter((r) => r.active && r.savings));
  const stopped = $derived((data?.recurring ?? []).filter((r) => !r.active));
  const monthlyTotal = $derived(costs.reduce((s, r) => s + r.monthly, 0));
  const raised = $derived(costs.filter((r) => r.priceChange && r.priceChange.pct > 0));

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  /** Debits due in the next 30 days, by date — what will leave the account soon. */
  const upcoming = $derived(
    [...costs, ...plans].filter((r) => r.nextDate >= today && r.nextDate <= in30).sort((a, b) => a.nextDate.localeCompare(b.nextDate))
  );
  const upcomingSum = $derived(upcoming.reduce((s, r) => s + r.lastAmount, 0));

  const daysUntil = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);
  const whenLabel = (d: string) => {
    const n = daysUntil(d);
    if (n === 0) return t("heute");
    if (n === 1) return t("morgen");
    return t("in {n} Tagen", { n });
  };
</script>

{#snippet row(r: Recurring, actions: "ignore" | "restore" | "none" = "ignore")}
  <li class="group flex items-center gap-3 px-5 py-3">
    <span class="flex size-9 shrink-0 items-center justify-center rounded-full text-base" style="background: color-mix(in srgb, {CATEGORY_COLORS[r.category] ?? 'var(--faint)'} 14%, transparent)">
      {CATEGORY_EMOJI[r.category] ?? "•"}
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-sm font-medium">{r.merchant}</span>
        {#if r.priceChange}
          <Badge tone={r.priceChange.pct > 0 ? "neg" : "pos"} title={t("seit {date}", { date: fmtDate(r.priceChange.since) })}>
            {#if r.priceChange.pct > 0}<TrendingUp class="size-3" />{:else}<TrendingDown class="size-3" />{/if}
            {fmtEUR(r.priceChange.from)} → {fmtEUR(r.priceChange.to)}
          </Badge>
        {/if}
      </div>
      <div class="truncate text-xs text-muted">
        {t(r.category)} · {t(FREQ[r.frequency])} · {r.active ? t("nächste {date}", { date: fmtDate(r.nextDate) }) : t("zuletzt {date}", { date: fmtDate(r.lastDate) })}
      </div>
    </div>
    <div class="shrink-0 text-right">
      <div class="num text-sm font-semibold">{fmtEUR(r.lastAmount)}</div>
      {#if r.frequency !== "monthly"}<div class="num text-[11px] text-muted">{t("{amount}/Monat", { amount: fmtEUR(r.monthly) })}</div>{/if}
    </div>
    {#if actions === "ignore"}
      <Button variant="ghost" size="icon-sm" class="opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100" title={t("Kein Abo — ausblenden")} aria-label={t("Kein Abo — ausblenden")} onclick={() => ignore(r.key, true)}><EyeOff /></Button>
    {:else if actions === "restore"}
      <Button variant="ghost" size="icon-sm" title={t("Wieder anzeigen")} aria-label={t("Wieder anzeigen")} onclick={() => ignore(r.key, false)}><Undo2 /></Button>
    {/if}
  </li>
{/snippet}

<svelte:head><title>{t("Wiederkehrend")} · Achilles</title></svelte:head>

{#if !data}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader
      title={t("Wiederkehrend")}
      subtitle={t("Abos, Verträge und Sparpläne — automatisch erkannt an gleichem Empfänger, Rhythmus und Betrag.")}
    />

    {#if data.recurring.length === 0}
      <Card>
        <EmptyState icon={Repeat} title={t("Noch nichts erkannt")} text={t("Wiederkehrende Zahlungen werden erkannt, sobald mindestens drei monatliche (oder zwei vierteljährliche bzw. jährliche) Buchungen beim selben Empfänger vorliegen.")} />
      </Card>
    {:else}
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label={t("Pro Monat")} value={fmtEUR0(monthlyTotal)} sub={t("{n} laufende Kosten", { n: costs.length })} />
        <Stat label={t("Pro Jahr")} value={fmtEUR0(monthlyTotal * 12)} sub={t("hochgerechnet")} />
        <Stat
          label={t("Preiserhöhungen")}
          value={String(raised.length)}
          valueTone={raised.length ? "neg" : undefined}
          sub={raised.length ? t("+{amount}/Monat seit der Erhöhung", { amount: fmtEUR(raised.reduce((s, r) => s + (r.priceChange!.to - r.priceChange!.from) * (r.monthly / r.lastAmount), 0)) }) : t("in den letzten 6 Monaten")}
        />
        <Stat label={t("Sparpläne")} value={fmtEUR0(plans.reduce((s, r) => s + r.monthly, 0))} sub={t("pro Monat, nicht in den Kosten")} />
      </div>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardHeader title={t("Laufende Kosten")} subtitle={t("Sortiert nach Kosten pro Monat")} />
          <ul class="divide-y divide-line border-t border-line">
            {#each costs as r (r.key)}{@render row(r)}{/each}
          </ul>
        </Card>

        <div class="space-y-5">
          <Card>
            <CardHeader title={t("Demnächst")} subtitle={t("{amount} in den nächsten 30 Tagen", { amount: fmtEUR0(upcomingSum) })} />
            {#if upcoming.length === 0}
              <p class="px-5 pb-5 text-sm text-muted">{t("Keine Abbuchung in den nächsten 30 Tagen.")}</p>
            {:else}
              <ul class="divide-y divide-line border-t border-line">
                {#each upcoming as r (r.key)}
                  {@const d = new Date(r.nextDate)}
                  <li class="flex items-center gap-3 px-5 py-2.5">
                    <div class="flex w-10 shrink-0 flex-col items-center rounded-lg bg-surface-2 py-1 leading-none">
                      <span class="text-[10px] font-medium uppercase text-muted">{d.toLocaleDateString(prefs.locale, { month: "short" })}</span>
                      <span class="num text-sm font-semibold">{d.getDate()}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-[13px] font-medium">{r.merchant}</div>
                      <div class="text-[11px] text-muted">{whenLabel(r.nextDate)}</div>
                    </div>
                    <span class={cn("num text-[13px] font-semibold", r.savings && "text-[#7950f2]")}>{fmtEUR(r.lastAmount)}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </Card>

          {#if plans.length > 0}
            <Card>
              <CardHeader title={t("Sparpläne")} subtitle={t("Regelmäßig investiert — Vermögensaufbau, keine Kosten")} />
              <ul class="divide-y divide-line border-t border-line">
                {#each plans as r (r.key)}{@render row(r)}{/each}
              </ul>
            </Card>
          {/if}
        </div>
      </div>

      {#if stopped.length > 0}
        <Card>
          <CardHeader title={t("Möglicherweise beendet")} subtitle={t("Seit über einem halben Intervall keine Abbuchung mehr")} />
          <ul class="divide-y divide-line border-t border-line">
            {#each stopped as r (r.key)}{@render row(r)}{/each}
          </ul>
        </Card>
      {/if}
    {/if}

    {#if data.ignored.length > 0}
      <div>
        <button type="button" class="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink" onclick={() => (showIgnored = !showIgnored)}>
          <ChevronRight class={cn("size-3.5 transition-transform", showIgnored && "rotate-90")} />
          {t("{n} ausgeblendet", { n: data.ignored.length })}
        </button>
        {#if showIgnored}
          <Card class="mt-3">
            <ul class="divide-y divide-line">
              {#each data.ignored as r (r.key)}{@render row(r, "restore")}{/each}
            </ul>
          </Card>
        {/if}
      </div>
    {/if}
  </div>
{/if}
