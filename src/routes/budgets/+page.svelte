<script lang="ts">
  import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Target, Repeat } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Switch from "$lib/components/ui/Switch.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import { CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJI } from "$lib/categorize";
  import { CASHFLOW_GROUPS } from "$lib/cashflow";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR0, fmtNum } from "$lib/utils";

  type Row = {
    category: string; group: string; amount: number; rollover: boolean; carry: number;
    available: number; spent: number; remaining: number; pct: number; status: "ok" | "warn" | "over";
  };
  type Overview = {
    month: string; pace: number; budgets: Row[];
    unbudgeted: Array<{ category: string; group: string; spent: number; suggestion: number }>;
    suggestions: Record<string, number>;
    totals: { available: number; spent: number; remaining: number };
  };

  const NOT_BUDGETABLE = ["Überweisungen", "Gehalt & Einnahmen", "Investments"];
  const thisMonth = new Date().toISOString().slice(0, 7);

  let month = $state(thisMonth);
  let data = $state<Overview | null>(null);
  let editOpen = $state(false);
  let form = $state({ category: "", amount: "", rollover: false, isNew: true });
  let error = $state<string | null>(null);

  const load = () => apiJson<Overview>(`/api/budgets?month=${month}`).then((d) => (data = d));
  $effect(() => { void month; load(); });

  function shift(n: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const monthLabel = $derived(new Date(`${month}-01`).toLocaleDateString(prefs.locale, { month: "long", year: "numeric" }));
  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  function openNew(category = "", suggestion?: number) {
    error = null;
    const cat = category || freeCategories[0] || "";
    form = { category: cat, amount: String(suggestion ?? data?.suggestions[cat] ?? "").replace(".", ","), rollover: false, isNew: true };
    editOpen = true;
  }
  function openEdit(r: Row) {
    error = null;
    form = { category: r.category, amount: String(r.amount).replace(".", ","), rollover: r.rollover, isNew: false };
    editOpen = true;
  }

  async function save() {
    error = null;
    const res = await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, amount: num(form.amount), rollover: form.rollover }),
    });
    if (!res.ok) { error = t((await res.json()).error); return; }
    editOpen = false;
    load();
  }

  async function remove(category: string) {
    if (!confirm(t("Budget für „{cat}“ löschen?", { cat: t(category) }))) return;
    await fetch(`/api/budgets?category=${encodeURIComponent(category)}`, { method: "DELETE" });
    editOpen = false;
    load();
  }

  const freeCategories = $derived(
    CATEGORIES.filter((c) => !NOT_BUDGETABLE.includes(c) && !(data?.budgets ?? []).some((b) => b.category === c))
  );

  /** Budgets grouped like the cash flow groups, largest group first. */
  const grouped = $derived.by(() => {
    const out = new Map<string, Row[]>();
    for (const r of data?.budgets ?? []) out.set(r.group, [...(out.get(r.group) ?? []), r]);
    return [...out.entries()].sort((a, b) => b[1].reduce((s, r) => s + r.available, 0) - a[1].reduce((s, r) => s + r.available, 0));
  });

  const barColor = (s: Row["status"]) => (s === "over" ? "var(--neg)" : s === "warn" ? "var(--warn)" : "var(--pos)");
  const totalPct = $derived(data && data.totals.available > 0 ? (data.totals.spent / data.totals.available) * 100 : 0);
  const isCurrent = $derived(month === thisMonth);
  const daysLeft = $derived.by(() => {
    if (!isCurrent) return null;
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
  });
</script>

{#snippet bar(pct: number, color: string, pace: number | null)}
  <div class="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
    <div class="h-full rounded-full transition-[width] duration-700" style="width: {Math.min(100, pct)}%; background: {color}"></div>
  </div>
  {#if pace !== null && pace > 0 && pace < 1}
    <!-- Where spending "should" be by today if spread evenly over the month. -->
    <div class="relative -mt-3 h-4"><span class="absolute top-0 h-4 w-0.5 rounded bg-ink-2/60" style="left: calc({pace * 100}% - 1px)" title={t("Heute")}></span></div>
  {/if}
{/snippet}

<svelte:head><title>{t("Budgets")} · Achilles</title></svelte:head>

<div class="rise space-y-6">
  <PageHeader title={t("Budgets")} subtitle={t("Ein Monatsbudget pro Kategorie — mit Blick darauf, ob du im Plan liegst.")}>
    {#snippet actions()}
      <Button size="sm" onclick={() => openNew()} disabled={freeCategories.length === 0}><Plus /> {t("Budget anlegen")}</Button>
    {/snippet}
  </PageHeader>

  <div class="flex items-center gap-1">
    <Button variant="secondary" size="icon" onclick={() => shift(-1)} aria-label={t("Vorheriger Monat")}><ChevronLeft /></Button>
    <span class="min-w-40 text-center text-sm font-semibold">{monthLabel}</span>
    <Button variant="secondary" size="icon" onclick={() => shift(1)} disabled={month >= thisMonth} aria-label={t("Nächster Monat")}><ChevronRight /></Button>
    {#if !isCurrent}<Button variant="ghost" size="sm" onclick={() => (month = thisMonth)}>{t("Aktueller Monat")}</Button>{/if}
  </div>

  {#if !data}
    <Loading />
  {:else if data.budgets.length === 0}
    <Card>
      <EmptyState icon={Target} title={t("Noch keine Budgets")} text={t("Lege für die Kategorien, die du im Blick behalten willst, ein Monatsbudget an. Als Vorschlag dient dein Durchschnitt der letzten drei Monate.")}>
        <Button size="sm" onclick={() => openNew()}><Plus /> {t("Budget anlegen")}</Button>
      </EmptyState>
    </Card>
  {:else}
    <Card class="p-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="text-[13px] font-medium text-muted">{data.totals.remaining >= 0 ? t("Noch verfügbar") : t("Überzogen")}</div>
          <div class={cn("num mt-1 text-[30px] font-semibold leading-tight tracking-tight", data.totals.remaining < 0 && "text-neg")}>
            {fmtEUR0(Math.abs(data.totals.remaining))}
          </div>
          <div class="mt-1 text-[13px] text-muted">
            {t("{spent} von {available} ausgegeben", { spent: fmtEUR0(data.totals.spent), available: fmtEUR0(data.totals.available) })}
            {#if daysLeft !== null && data.totals.remaining > 0}
              · {t("{amount} pro Tag für die restlichen {n} Tage", { amount: fmtEUR0(data.totals.remaining / daysLeft), n: daysLeft })}
            {/if}
          </div>
        </div>
        <div class="flex gap-2">
          {#each [
            { n: data.budgets.filter((b) => b.status === "ok").length, label: t("im Plan"), tone: "pos" as const },
            { n: data.budgets.filter((b) => b.status === "warn").length, label: t("knapp"), tone: "warn" as const },
            { n: data.budgets.filter((b) => b.status === "over").length, label: t("überzogen"), tone: "neg" as const },
          ] as s (s.label)}
            <Badge tone={s.tone}>{s.n} {s.label}</Badge>
          {/each}
        </div>
      </div>
      <div class="mt-4">
        {@render bar(totalPct, totalPct > 100 ? "var(--neg)" : "var(--accent)", isCurrent ? data.pace : null)}
      </div>
    </Card>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {#each grouped as [group, rows] (group)}
        {@const g = CASHFLOW_GROUPS[group]}
        <Card>
          <CardHeader
            title={t(g?.label ?? group)}
            subtitle={t("{spent} von {available}", { spent: fmtEUR0(rows.reduce((s, r) => s + r.spent, 0)), available: fmtEUR0(rows.reduce((s, r) => s + r.available, 0)) })}
          />
          <ul class="divide-y divide-line border-t border-line">
            {#each rows as r (r.category)}
              <li class="group px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-full text-sm" style="background: color-mix(in srgb, {CATEGORY_COLORS[r.category] ?? 'var(--faint)'} 14%, transparent)">
                    {CATEGORY_EMOJI[r.category] ?? "•"}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-3">
                      <a href="/transactions?category={encodeURIComponent(r.category)}&from={month}-01&to={month}-31" class="truncate text-sm font-medium hover:underline">{t(r.category)}</a>
                      <span class="num shrink-0 text-[13px]">
                        <span class="font-semibold">{fmtEUR0(r.spent)}</span>
                        <span class="text-muted"> / {fmtEUR0(r.available)}</span>
                      </span>
                    </div>
                    <div class="mt-2">{@render bar(r.pct, barColor(r.status), isCurrent ? data.pace : null)}</div>
                    <div class="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span class={cn(r.status === "over" ? "font-medium text-neg" : r.status === "warn" ? "text-warn" : "text-muted")}>
                        {r.remaining >= 0 ? t("{amount} übrig", { amount: fmtEUR0(r.remaining) }) : t("{amount} überzogen", { amount: fmtEUR0(-r.remaining) })}
                      </span>
                      <span class="flex items-center gap-2 text-faint">
                        {#if r.rollover}
                          <span class="flex items-center gap-1" title={t("Übertrag aus Vormonaten")}>
                            <Repeat class="size-3" />{r.carry >= 0 ? "+" : "−"}{fmtEUR0(Math.abs(r.carry))}
                          </span>
                        {/if}
                        <span class="num">{fmtNum(r.pct, 0)} %</span>
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" class="opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100" onclick={() => openEdit(r)} aria-label={t("Bearbeiten")}><Pencil /></Button>
                </div>
              </li>
            {/each}
          </ul>
        </Card>
      {/each}
    </div>
  {/if}

  {#if data && data.unbudgeted.length > 0}
    <Card>
      <CardHeader title={t("Ohne Budget")} subtitle={t("Ausgaben in diesem Monat, für die kein Budget besteht")} />
      <ul class="divide-y divide-line border-t border-line">
        {#each data.unbudgeted as u (u.category)}
          <li class="flex items-center gap-3 px-5 py-3">
            <span class="text-base leading-none">{CATEGORY_EMOJI[u.category] ?? "•"}</span>
            <span class="min-w-0 flex-1 truncate text-sm">{t(u.category)}</span>
            <span class="num text-sm font-semibold">{fmtEUR0(u.spent)}</span>
            <Button variant="secondary" size="sm" onclick={() => openNew(u.category, u.suggestion)}><Plus /> {t("Budget")}</Button>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
</div>

<Dialog
  bind:open={editOpen}
  title={form.isNew ? t("Budget anlegen") : t("Budget bearbeiten")}
  description={t("Gilt für jeden Monat, bis du es änderst.")}
>
  <div class="space-y-4">
    <Field label={t("Kategorie")}>
      {#if form.isNew}
        <Select
          bind:value={form.category}
          onchange={(c) => (form.amount = data?.suggestions[c] ? String(data.suggestions[c]) : form.amount)}
          options={freeCategories.map((c) => ({ value: c, label: `${CATEGORY_EMOJI[c] ?? ""} ${t(c)}`, hint: data?.suggestions[c] ? `Ø ${fmtEUR0(data.suggestions[c])}` : undefined }))}
        />
      {:else}
        <div class="flex h-9.5 items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm">{CATEGORY_EMOJI[form.category] ?? ""} {t(form.category)}</div>
      {/if}
    </Field>
    <Field label={t("Betrag pro Monat (€)")} hint={data?.suggestions[form.category] ? t("Ø der letzten drei Monate: {amount}", { amount: fmtEUR0(data.suggestions[form.category]) }) : null}>
      <Input inputmode="decimal" placeholder="300" bind:value={form.amount} />
    </Field>
    <div class="flex items-start justify-between gap-4 rounded-xl bg-surface-2 p-3.5">
      <div>
        <div class="text-sm font-medium">{t("Übertrag in den Folgemonat")}</div>
        <div class="mt-0.5 text-xs leading-relaxed text-muted">{t("Was übrig bleibt, steht nächsten Monat zusätzlich zur Verfügung — Überzogenes wird abgezogen. Sinnvoll für Ausgaben, die schwanken.")}</div>
      </div>
      <Switch bind:checked={form.rollover} label={t("Übertrag in den Folgemonat")} />
    </div>
  </div>
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    {#if !form.isNew}
      <Button variant="danger" class="mr-auto" onclick={() => remove(form.category)}><Trash2 /> {t("Löschen")}</Button>
    {/if}
    <Button variant="secondary" onclick={() => (editOpen = false)}>{t("Abbrechen")}</Button>
    <Button onclick={save} disabled={!form.category || num(form.amount) <= 0}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>
