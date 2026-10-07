<script lang="ts">
  import { Search, ArrowLeftRight, X } from "@lucide/svelte";
  import { page } from "$app/state";
  import Card from "$lib/components/ui/Card.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ManualAccounts from "$lib/components/ManualAccounts.svelte";
  import { CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJI } from "$lib/categorize";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR } from "$lib/utils";

  type Tx = {
    id: string;
    booking_date: string;
    amount: number;
    merchant: string | null;
    description: string | null;
    category: string;
    pending: number;
  };

  let txs = $state<Tx[]>([]);
  let months = $state<string[]>([]);
  let accounts = $state<Array<{ id: string; name: string; n: number }>>([]);
  let q = $state("");
  // Filters can arrive in the URL — the cash flow page links here with a
  // category and its period.
  let category = $state(page.url.searchParams.get("category") ?? "");
  let from = $state(page.url.searchParams.get("from") ?? "");
  let to = $state(page.url.searchParams.get("to") ?? "");
  let month = $state("");
  let account = $state("");
  let loading = $state(true);
  let editing = $state<string | null>(null);
  let reloadKey = $state(0);

  function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (month) params.set("month", month);
    if (account) params.set("account", account);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return apiJson<{ transactions: Tx[]; months: string[]; accounts: typeof accounts }>(`/api/transactions?${params}`)
      .then((d) => { txs = d.transactions; months = d.months; accounts = d.accounts; })
      .finally(() => (loading = false));
  }

  // Refetch on every filter change; typing is debounced so a search doesn't
  // fire a request per keystroke.
  $effect(() => {
    void [category, month, account, from, to, reloadKey];
    const query = q;
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  });

  async function setCat(id: string, cat: string) {
    txs = txs.map((tx) => (tx.id === id ? { ...tx, category: cat } : tx));
    editing = null;
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category: cat }),
    });
  }

  const spent = $derived(txs.filter((tx) => tx.amount < 0).reduce((s, tx) => s - tx.amount, 0));
  const earned = $derived(txs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0));

  const fmtDay = (d: string) => new Date(d).toLocaleDateString(prefs.locale, { day: "2-digit", month: "short", year: "numeric" });
  const fmtMonth = (m: string) => new Date(`${m}-01`).toLocaleDateString(prefs.locale, { month: "long", year: "numeric" });

  /** Bookings grouped by day, the way a bank statement reads. */
  const groups = $derived.by(() => {
    const out: Array<{ date: string; items: Tx[]; total: number }> = [];
    for (const tx of txs) {
      const last = out[out.length - 1];
      if (last && last.date === tx.booking_date) { last.items.push(tx); last.total += tx.amount; }
      else out.push({ date: tx.booking_date, items: [tx], total: tx.amount });
    }
    return out;
  });

  const dayLabel = (iso: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    if (iso === today) return t("Heute");
    if (iso === yesterday) return t("Gestern");
    return new Date(iso).toLocaleDateString(prefs.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const catOptions = $derived(CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_EMOJI[c] ?? ""} ${t(c)}` })));
</script>

<svelte:head><title>{t("Transaktionen")} · Achilles</title></svelte:head>

<div class="rise">
  <PageHeader title={t("Transaktionen")}>
    {#snippet actions()}
      <ManualAccounts onchange={() => reloadKey++} />
    {/snippet}
  </PageHeader>

  <div class="mb-5 grid grid-cols-3 gap-3">
    <Card class="px-4 py-3">
      <div class="text-xs text-muted">{t("Buchungen")}</div>
      <div class="num mt-0.5 text-lg font-semibold">{txs.length}</div>
    </Card>
    <Card class="px-4 py-3">
      <div class="text-xs text-muted">{t("Ausgaben")}</div>
      <div class="num mt-0.5 truncate text-lg font-semibold text-neg">−{fmtEUR(spent)}</div>
    </Card>
    <Card class="px-4 py-3">
      <div class="text-xs text-muted">{t("Einnahmen")}</div>
      <div class="num mt-0.5 truncate text-lg font-semibold text-pos">+{fmtEUR(earned)}</div>
    </Card>
  </div>

  <Card class="overflow-visible">
    <div class="flex flex-wrap gap-2.5 border-b border-line p-3">
      <div class="relative min-w-[220px] flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input placeholder={t("Händler oder Beschreibung suchen …")} bind:value={q} class="pl-9" />
      </div>
      <Select bind:value={category} class="w-full sm:w-52" options={[{ value: "", label: t("Alle Kategorien") }, ...catOptions]} />
      <Select bind:value={month} class="w-full sm:w-48" options={[{ value: "", label: t("Alle Monate") }, ...months.map((m) => ({ value: m, label: fmtMonth(m) }))]} />
      <!-- Only from two accounts on: with one, the filter would be a choice without a choice. -->
      {#if from || to}
        <button
          type="button"
          onclick={() => { from = ""; to = ""; }}
          class="flex h-9.5 items-center gap-1.5 rounded-xl bg-accent-soft px-3 text-[13px] font-medium text-accent"
          title={t("Zeitraum-Filter entfernen")}
        >
          {from ? fmtDay(from) : "…"} – {to ? fmtDay(to) : "…"}
          <X class="size-3.5" />
        </button>
      {/if}
      {#if accounts.length > 1}
        <Select bind:value={account} class="w-full sm:w-52" options={[{ value: "", label: t("Alle Konten") }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.n})` }))]} />
      {/if}
    </div>

    {#if loading}
      <div class="space-y-3 p-5">
        {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="skeleton h-11"></div>{/each}
      </div>
    {:else if txs.length === 0}
      <EmptyState icon={ArrowLeftRight} title={t("Keine Transaktionen gefunden.")} />
    {:else}
      {#each groups as g (g.date)}
        <div class="flex items-center justify-between bg-surface-2 px-5 py-2 text-xs font-medium text-muted first:rounded-none">
          <span>{dayLabel(g.date)}</span>
          <span class={cn("num", g.total > 0 ? "text-pos" : "")}>{g.total > 0 ? "+" : ""}{fmtEUR(g.total)}</span>
        </div>
        <ul class="divide-y divide-line">
          {#each g.items as tx (tx.id)}
            <li class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2 sm:gap-4">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                style="background: color-mix(in srgb, {CATEGORY_COLORS[tx.category] ?? 'var(--faint)'} 14%, transparent)"
              >{CATEGORY_EMOJI[tx.category] ?? "•"}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">{tx.merchant || tx.description || "—"}</span>
                  {#if tx.pending === 1}<Badge>{t("ausstehend")}</Badge>{/if}
                </div>
                {#if tx.merchant && tx.description}
                  <div class="truncate text-xs text-muted">{tx.description}</div>
                {/if}
              </div>
              <div class="hidden w-56 shrink-0 sm:block">
                {#if editing === tx.id}
                  <Select
                    size="sm"
                    autoOpen
                    value={tx.category}
                    options={catOptions}
                    onchange={(v) => setCat(tx.id, v)}
                    onclose={() => (editing = null)}
                  />
                {:else}
                  <button
                    type="button"
                    onclick={() => (editing = tx.id)}
                    class="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-3"
                    title={t("Kategorie ändern")}
                  >
                    <span class="size-2 shrink-0 rounded-full" style="background: {CATEGORY_COLORS[tx.category] ?? 'var(--faint)'}"></span>
                    <span class="truncate">{t(tx.category)}</span>
                  </button>
                {/if}
              </div>
              <span class={cn("num w-28 shrink-0 text-right text-sm font-semibold", tx.amount > 0 ? "text-pos" : "text-ink")}>
                {tx.amount > 0 ? "+" : ""}{fmtEUR(tx.amount)}
              </span>
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  </Card>
</div>
