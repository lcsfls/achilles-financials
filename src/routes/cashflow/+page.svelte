<script lang="ts">
  import { goto } from "$app/navigation";
  import { ChevronLeft, ChevronRight, Split, Info } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Segmented from "$lib/components/ui/Segmented.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Sankey, { type SankeyNode } from "$lib/components/charts/Sankey.svelte";
  import { CATEGORY_COLORS, CATEGORY_EMOJI } from "$lib/categorize";
  import { CASHFLOW_GROUPS, type Cashflow } from "$lib/cashflow";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR0, fmtNum, fmtPct } from "$lib/utils";

  type Mode = "month" | "quarter" | "year" | "custom";

  let mode = $state<Mode>("month");
  /** Any date inside the period shown; the arrows move it by one period. */
  let anchor = $state(new Date());
  let customFrom = $state(new Date(Date.now() - 89 * 86400_000).toISOString().slice(0, 10));
  let customTo = $state(new Date().toISOString().slice(0, 10));
  let view = $state("categories");
  let data = $state<Cashflow | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let width = $state(0);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /** The period containing `d`, and the one before it. */
  function period(d: Date, offset = 0) {
    const y = d.getFullYear();
    const m = d.getMonth();
    if (mode === "month") return { from: iso(new Date(y, m + offset, 1)), to: iso(new Date(y, m + offset + 1, 0)) };
    if (mode === "quarter") {
      const q = Math.floor(m / 3) * 3 + offset * 3;
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    }
    return { from: iso(new Date(y + offset, 0, 1)), to: iso(new Date(y + offset, 11, 31)) };
  }

  const range = $derived(mode === "custom" ? { from: customFrom, to: customTo } : period(anchor));
  // Custom ranges compare against the same number of days before (server default).
  const prevRange = $derived(mode === "custom" ? null : period(anchor, -1));

  const periodLabel = $derived.by(() => {
    const d = anchor;
    if (mode === "month") return d.toLocaleDateString(prefs.locale, { month: "long", year: "numeric" });
    if (mode === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (mode === "year") return String(d.getFullYear());
    return "";
  });

  const today = iso(new Date());
  const atEnd = $derived(mode !== "custom" && range.to >= today);
  const atStart = $derived(mode !== "custom" && data?.firstDate != null && range.from <= data.firstDate);

  function step(dir: -1 | 1) {
    const d = new Date(anchor);
    if (mode === "month") d.setMonth(d.getMonth() + dir, 1);
    else if (mode === "quarter") d.setMonth(d.getMonth() + 3 * dir, 1);
    else d.setFullYear(d.getFullYear() + dir, 0, 1);
    anchor = d;
  }

  $effect(() => {
    const { from, to } = range;
    const prevQ = prevRange ? `&prevFrom=${prevRange.from}&prevTo=${prevRange.to}` : "";
    if (!from || !to || from > to) return;
    let current = true;
    loading = true;
    error = null;
    apiJson<Cashflow & { error?: string }>(`/api/cashflow?from=${from}&to=${to}${prevQ}`)
      .then((d) => {
        if (!current) return;
        if (d.error) error = t(d.error);
        else data = d;
      })
      .finally(() => { if (current) loading = false; });
    return () => { current = false; };
  });

  /* ---------- diagram nodes ---------- */

  const SOURCE_COLORS = ["#12a150", "#2f9e44", "#37b24d", "#51cf66", "#69db7c", "#8ce99a"];

  const leftNodes = $derived.by<SankeyNode[]>(() => {
    if (!data) return [];
    let i = 0;
    return data.sources.map((s) => ({
      key: s.key,
      label: s.kind === "refund" ? t("Erstattungen · {cat}", { cat: t(s.label) }) : t(s.label),
      value: s.value,
      color: s.kind === "deficit" ? "#e5484d" : s.kind === "refund" ? "#868e96" : SOURCE_COLORS[i++ % SOURCE_COLORS.length],
    }));
  });

  const rightNodes = $derived.by<SankeyNode[]>(() => {
    if (!data) return [];
    const total = data.sources.reduce((s, x) => s + x.value, 0);
    const spent = data.expenses.filter((e) => e.value > 0);
    let nodes: SankeyNode[];
    if (view === "groups") {
      const byGroup = new Map<string, number>();
      for (const e of spent) byGroup.set(e.group, (byGroup.get(e.group) ?? 0) + e.value);
      nodes = [...byGroup.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([g, v]) => ({ key: `group:${g}`, label: t(CASHFLOW_GROUPS[g]?.label ?? g), value: v, color: CASHFLOW_GROUPS[g]?.color ?? "#868e96", clickable: true }));
    } else {
      // Slivers under 2 % are pooled: a dozen hairline bands help no one.
      const big = spent.filter((e) => e.value >= total * 0.02);
      const small = spent.filter((e) => e.value < total * 0.02);
      nodes = big.map((e) => ({ key: `cat:${e.category}`, label: t(e.category), value: e.value, color: CATEGORY_COLORS[e.category] ?? "#868e96", clickable: true }));
      const rest = small.reduce((s, e) => s + e.value, 0);
      if (rest > 0) nodes.push({ key: "cat:__rest", label: t("Weitere ({n})", { n: small.length }), value: rest, color: "#adb5bd" });
    }
    if (data.invested > 0) nodes.push({ key: "invested", label: t("Investiert"), value: data.invested, color: "#7950f2" });
    if (data.saved > 0) nodes.push({ key: "saved", label: t("Gespart"), value: data.saved, color: "#2f6fed" });
    return nodes;
  });

  const centerValue = $derived(leftNodes.reduce((s, n) => s + n.value, 0));

  function openNode(key: string) {
    if (key.startsWith("group:")) { view = "categories"; return; }
    if (!key.startsWith("cat:") || key === "cat:__rest") return;
    const cat = key.slice(4);
    goto(`/transactions?category=${encodeURIComponent(cat)}&from=${range.from}&to=${range.to}`);
  }

  const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
  const tableRows = $derived((data?.expenses ?? []).filter((e) => e.value > 0 || e.prev > 0));
  const empty = $derived(data !== null && centerValue === 0 && (data.expenses.length === 0));
  const prevLabel = $derived(
    data ? `${new Date(data.prevFrom).toLocaleDateString(prefs.locale, { day: "2-digit", month: "short" })} – ${new Date(data.prevTo).toLocaleDateString(prefs.locale, { day: "2-digit", month: "short", year: "numeric" })}` : ""
  );
</script>

<svelte:head><title>{t("Cashflow")} · Achilles</title></svelte:head>

<div class="rise space-y-6">
  <PageHeader title={t("Cashflow")} subtitle={t("Woher dein Geld im Zeitraum kam und wohin es geflossen ist.")} />

  <!-- Period -->
  <div class="flex flex-wrap items-center gap-3">
    <Segmented bind:value={mode} options={[
      { value: "month", label: t("Monat") },
      { value: "quarter", label: t("Quartal") },
      { value: "year", label: t("Jahr") },
      { value: "custom", label: t("Zeitraum") },
    ]} />
    {#if mode === "custom"}
      <div class="flex items-center gap-2">
        <Input type="date" class="w-40" bind:value={customFrom} max={customTo} />
        <span class="text-muted">–</span>
        <Input type="date" class="w-40" bind:value={customTo} min={customFrom} />
      </div>
    {:else}
      <div class="flex items-center gap-1">
        <Button variant="secondary" size="icon" onclick={() => step(-1)} disabled={atStart} aria-label={t("Vorheriger Zeitraum")}><ChevronLeft /></Button>
        <span class="min-w-36 text-center text-sm font-semibold">{periodLabel}</span>
        <Button variant="secondary" size="icon" onclick={() => step(1)} disabled={atEnd} aria-label={t("Nächster Zeitraum")}><ChevronRight /></Button>
      </div>
    {/if}
  </div>

  {#if error}
    <Card class="p-5 text-sm text-neg">{error}</Card>
  {:else if !data}
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">{#each [0, 1, 2, 3] as i (i)}<div class="skeleton h-24 rounded-2xl"></div>{/each}</div>
      <div class="skeleton h-[420px] rounded-2xl"></div>
    </div>
  {:else}
    <div class={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {#each [
          { label: t("Einnahmen"), value: data.totals.income, prev: data.prevTotals.income, good: "up" },
          { label: t("Ausgaben"), value: data.totals.expenses, prev: data.prevTotals.expenses, good: "down" },
          { label: t("Investiert"), value: data.totals.invested, prev: data.prevTotals.invested, good: "up" },
        ] as k (k.label)}
          {@const d = delta(k.value, k.prev)}
          <Stat
            label={k.label}
            value={fmtEUR0(k.value)}
            sub={d === null ? t("kein Vergleich") : t("{pct} vs. Vorzeitraum", { pct: fmtPct(d) })}
            subTone={d === null || Math.abs(d) < 0.5 ? "muted" : (d > 0) === (k.good === "up") ? "pos" : "neg"}
          />
        {/each}
        <Stat
          label={data.totals.saved >= 0 ? t("Gespart") : t("Aus Rücklagen")}
          value={fmtEUR0(Math.abs(data.totals.saved))}
          valueTone={data.totals.saved >= 0 ? "pos" : "neg"}
          sub={data.totals.savingsRatePct !== null ? t("Sparquote {pct}", { pct: `${fmtNum(data.totals.savingsRatePct, 0)} %` }) : t("keine Einnahmen erfasst")}
        />
      </div>

      {#if empty}
        <Card>
          <EmptyState icon={Split} title={t("Keine Buchungen im Zeitraum")} text={t("Wähle einen anderen Zeitraum oder importiere Umsätze.")} />
        </Card>
      {:else}
        <Card>
          <CardHeader title={t("Geldfluss")} subtitle={t("Klick auf eine Kategorie zeigt ihre Buchungen")}>
            {#snippet actions()}
              <Segmented size="sm" bind:value={view} options={[{ value: "categories", label: t("Kategorien") }, { value: "groups", label: t("Gruppen") }]} />
            {/snippet}
          </CardHeader>
          <div class="px-3 pb-5 sm:px-5" bind:clientWidth={width}>
            {#if width >= 720}
              <Sankey left={leftNodes} right={rightNodes} center={{ label: t("Verfügbar"), value: centerValue, color: "var(--ink-2)" }} format={fmtEUR0} onnode={openNode} />
            {:else}
              <!-- Phones: a flow diagram at this width is unreadable — the same numbers as two lists. -->
              {#each [{ title: t("Herkunft"), nodes: leftNodes }, { title: t("Verwendung"), nodes: rightNodes }] as col (col.title)}
                <div class="mb-5 last:mb-0">
                  <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{col.title}</div>
                  <div class="space-y-3">
                    {#each col.nodes as n (n.key)}
                      <button type="button" class="block w-full text-left" onclick={() => n.clickable && openNode(n.key)}>
                        <div class="flex items-center justify-between gap-2 text-[13px]">
                          <span class="flex min-w-0 items-center gap-2"><span class="size-2 shrink-0 rounded-full" style="background: {n.color}"></span><span class="truncate">{n.label}</span></span>
                          <span class="num shrink-0 font-semibold">{fmtEUR0(n.value)}</span>
                        </div>
                        <Progress class="mt-1.5" height={6} value={centerValue > 0 ? (n.value / centerValue) * 100 : 0} color={n.color} />
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
          {#if data.excludedTransfers > 0}
            <div class="flex items-start gap-2 border-t border-line px-5 py-3 text-xs text-muted">
              <Info class="mt-0.5 size-3.5 shrink-0" />
              {t("Überweisungen ({amount}) sind ausgeklammert — meist Geld zwischen eigenen Konten, das sonst doppelt zählen würde.", { amount: fmtEUR0(data.excludedTransfers) })}
            </div>
          {/if}
        </Card>

        <Card class="overflow-hidden">
          <CardHeader title={t("Ausgaben nach Kategorie")} subtitle={t("Vergleich mit {period}", { period: prevLabel })} />
          <div class="overflow-x-auto border-t border-line">
            <table class="tbl">
              <thead>
                <tr>
                  <th>{t("Kategorie")}</th>
                  <th class="hidden md:table-cell">{t("Gruppe")}</th>
                  <th class="text-right">{t("Betrag")}</th>
                  <th class="hidden text-right sm:table-cell">{t("Anteil")}</th>
                  <th class="hidden text-right md:table-cell">{t("Vorzeitraum")}</th>
                  <th class="text-right">{t("Veränderung")}</th>
                </tr>
              </thead>
              <tbody>
                {#each tableRows as e (e.category)}
                  {@const d = delta(e.value, e.prev)}
                  <tr class="cursor-pointer" onclick={() => openNode(`cat:${e.category}`)}>
                    <td>
                      <span class="flex items-center gap-2">
                        <span class="text-base leading-none">{CATEGORY_EMOJI[e.category] ?? "•"}</span>
                        <span class="font-medium">{t(e.category)}</span>
                      </span>
                    </td>
                    <td class="hidden text-muted md:table-cell">{t(CASHFLOW_GROUPS[e.group]?.label ?? e.group)}</td>
                    <td class="num text-right font-semibold">{fmtEUR0(e.value)}</td>
                    <td class="num hidden text-right text-muted sm:table-cell">{data.totals.expenses > 0 ? `${fmtNum((e.value / data.totals.expenses) * 100, 1)} %` : "—"}</td>
                    <td class="num hidden text-right text-muted md:table-cell">{fmtEUR0(e.prev)}</td>
                    <!-- Spending more is red, spending less is green. -->
                    <td class={cn("num text-right font-medium", d === null || Math.abs(d) < 0.5 ? "text-muted" : d > 0 ? "text-neg" : "text-pos")}>
                      {d === null ? (e.value > 0 ? t("neu") : "—") : fmtPct(d)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>
      {/if}
    </div>
  {/if}
</div>
