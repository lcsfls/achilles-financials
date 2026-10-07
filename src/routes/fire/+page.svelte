<script lang="ts">
  import { onMount } from "svelte";
  import { Flame, Target, Coins, Plus, Trash2, SlidersHorizontal, Pencil, Wallet, Gem, TrendingUp, PiggyBank, ShieldCheck } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import AreaChart from "$lib/components/charts/AreaChart.svelte";
  import Legend from "$lib/components/charts/Legend.svelte";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { DEFAULT_PARAMS, project, startCapital, type Assets, type FireParams } from "$lib/fire";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtNum } from "$lib/utils";

  type Scenario = { id: number; name: string; createdAt: string; params: FireParams };

  const COLORS = ["#f0652f", "#2f6fed", "#7950f2", "#12a150", "#f59f00", "#e64980"];

  let scenarios = $state<Scenario[] | null>(null);
  let assets = $state<Assets>({ cash: 0, metals: 0, investments: 0, pension: 0 });
  let emergency = $state<{ balance: number; accountName: string } | null>(null);
  let activeId = $state<number | null>(null);
  let editing = $state<Scenario | null>(null);
  let editOpen = $state(false);
  let draft = $state<FireParams>(structuredClone(DEFAULT_PARAMS));
  let draftName = $state("");
  let isNew = $state(false);
  let busy = $state(false);

  async function load() {
    const [f, s] = await Promise.all([
      apiJson<{ scenarios: Scenario[] }>("/api/fire"),
      apiJson<{ assets?: Assets; emergency?: { balance: number; accountName: string } | null }>("/api/summary"),
    ]);
    assets = s.assets ?? { cash: 0, metals: 0, investments: 0, pension: 0 };
    emergency = s.emergency ? { balance: s.emergency.balance, accountName: s.emergency.accountName } : null;
    scenarios = f.scenarios;
    activeId = activeId ?? f.scenarios[0]?.id ?? null;
  }
  onMount(load);

  function openEdit(s: Scenario) {
    editing = s;
    draft = structuredClone($state.snapshot(s.params));
    draftName = s.name;
    isNew = false;
    editOpen = true;
  }
  function openNew() {
    const base = scenarios?.find((s) => s.id === activeId)?.params ?? DEFAULT_PARAMS;
    editing = { id: -1, name: "", createdAt: "", params: base };
    draft = structuredClone($state.snapshot(base));
    draftName = "";
    isNew = true;
    editOpen = true;
  }

  async function save() {
    busy = true;
    const params = $state.snapshot(draft);
    if (isNew) {
      const res = await fetch("/api/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName || t("Neues Szenario"), params }),
      });
      const d = await res.json();
      if (res.ok) activeId = d.id;
    } else if (editing) {
      await fetch("/api/fire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name: draftName, params }),
      });
    }
    busy = false;
    editOpen = false;
    load();
  }

  async function remove(id: number) {
    if (!confirm(t("Szenario wirklich löschen?"))) return;
    const res = await fetch(`/api/fire?id=${id}`, { method: "DELETE" });
    if (!res.ok) { alert((await res.json()).error); return; }
    if (activeId === id) activeId = null;
    load();
  }

  const year = new Date().getFullYear();
  // Live preview in the editor
  const preview = $derived(editOpen ? project(draft, assets, year) : null);
  const projections = $derived((scenarios ?? []).map((s, i) => ({ scenario: s, p: project(s.params, assets, year), color: COLORS[i % COLORS.length] })));
  const active = $derived(projections.find((x) => x.scenario.id === activeId) ?? projections[0]);

  /** All scenarios on one age axis — each scenario is one column. */
  const chartRows = $derived.by(() => {
    const byAge = new Map<number, Record<string, number | string>>();
    for (const { scenario, p } of projections) {
      for (const pt of p.series) {
        const age = Math.round(pt.age);
        const row = byAge.get(age) ?? { age, label: t("{n} J.", { n: age }) };
        row[`s${scenario.id}`] = pt.value;
        byAge.set(age, row);
      }
    }
    return [...byAge.values()].sort((a, b) => Number(a.age) - Number(b.age));
  });

  const ASSET_ROWS = $derived<Array<{ key: keyof Assets; label: string; icon: typeof Wallet; color: string }>>([
    { key: "cash", label: t("Liquidität"), icon: Wallet, color: "#2f6fed" },
    { key: "investments", label: t("Investments"), icon: TrendingUp, color: "#7950f2" },
    { key: "metals", label: t("Edelmetalle"), icon: Gem, color: "#c49a1a" },
    { key: "pension", label: t("Altersvorsorge"), icon: PiggyBank, color: "#12a150" },
  ]);

  type NumKey = "age" | "monthlySavings" | "monthlyExpenses" | "annualReturnPct" | "inflationPct" | "withdrawalRatePct";
  const SLIDERS = $derived<Array<{ key: NumKey; label: string; min: number; max: number; step: number; fmt: (v: number) => string }>>([
    { key: "age", label: t("Aktuelles Alter"), min: 18, max: 70, step: 1, fmt: (v) => t("{n} Jahre", { n: v }) },
    { key: "monthlySavings", label: t("Sparrate / Monat"), min: 0, max: 10000, step: 50, fmt: (v) => fmtEUR0(v) },
    { key: "monthlyExpenses", label: t("Wunsch-Ausgaben im Ruhestand / Monat (heutige Kaufkraft)"), min: 500, max: 15000, step: 100, fmt: (v) => fmtEUR0(v) },
    { key: "annualReturnPct", label: t("Erwartete Rendite p. a."), min: 0, max: 12, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "inflationPct", label: t("Inflation p. a."), min: 0, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
    { key: "withdrawalRatePct", label: t("Entnahmerate (SWR)"), min: 2, max: 6, step: 0.1, fmt: (v) => `${fmtNum(v, 1)} %` },
  ]);

  const yearsLabel = (y: number | null) =>
    y === null ? t("> 60 J.") : y === 0 ? t("Erreicht 🎉") : t("{n} Jahre", { n: fmtNum(y, 1) });
  const axis = (v: number) => new Intl.NumberFormat(prefs.locale, { notation: "compact", maximumFractionDigits: 1 }).format(v);
</script>

<svelte:head><title>FIRE · Achilles</title></svelte:head>

{#if !scenarios}
  <Loading rows={2} />
{:else}
  <div class="rise space-y-6">
    <PageHeader title={t("FIRE-Simulator")} subtitle={t("Financial Independence, Retire Early — alle Werte inflationsbereinigt in heutiger Kaufkraft.")}>
      {#snippet actions()}
        <Button size="sm" onclick={openNew}><Plus /> {t("Szenario anlegen")}</Button>
      {/snippet}
    </PageHeader>

    {#if active}
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={Target} color="#f0652f" label={t("FIRE-Zahl")} value={fmtEUR0(active.p.fireNumber)} sub={t("bei {pct} % Entnahme", { pct: fmtNum(active.scenario.params.withdrawalRatePct, 1) })} />
        <Stat icon={Coins} color="#2f6fed" label={t("Startkapital")} value={fmtEUR0(active.p.start)} sub={active.scenario.params.startNetWorth === null ? t("aus gewählten Bausteinen") : t("manuell gesetzt")} />
        <Stat icon={Flame} color="#f59f00" label={t("Fortschritt")} value="{fmtNum(active.p.progressPct, 1)} %" sub={t("{amount} fehlen", { amount: fmtEUR0(Math.max(0, active.p.fireNumber - active.p.start)) })} />
        <Stat icon={SlidersHorizontal} color="#7950f2" label={t("Realrendite")} value="{fmtNum(active.p.realAnnualPct, 1)} %" sub={t("nach Inflation")} />
      </div>
    {/if}

    <Card>
      <CardHeader title={t("Vermögensprojektion (real)")}>
        {#snippet actions()}
          <Legend items={[...projections.map((x) => ({ label: x.scenario.name, color: x.color })), ...(active ? [{ label: t("FIRE-Zahl"), color: "var(--warn)", dashed: true }] : [])]} />
        {/snippet}
      </CardHeader>
      <div class="px-3 pb-4">
        <AreaChart
          data={chartRows}
          x="label"
          height={380}
          xTicks={8}
          yFormat={axis}
          valueFormat={fmtEUR0}
          refLine={active ? { value: active.p.fireNumber, color: "var(--warn)" } : null}
          series={projections.map((x) => ({ key: `s${x.scenario.id}`, label: x.scenario.name, color: x.color, fill: x.scenario.id === active?.scenario.id }))}
        />
      </div>
    </Card>

    <div>
      <h2 class="mb-3 text-[15px] font-semibold">{t("Szenarien")}</h2>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {#each projections as { scenario, p, color } (scenario.id)}
          {@const isActive = scenario.id === active?.scenario.id}
          <div
            role="button"
            tabindex="0"
            onclick={() => (activeId = scenario.id)}
            onkeydown={(e) => e.key === "Enter" && (activeId = scenario.id)}
            class={cn(
              "cursor-pointer rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] transition-all",
              isActive ? "border-accent ring-3 ring-accent/15" : "border-line hover:border-line-strong"
            )}
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="size-2 shrink-0 rounded-full" style="background: {color}"></span>
                  <span class="truncate text-sm font-semibold">{scenario.name}</span>
                </div>
                <div class="num mt-2 text-2xl font-semibold tracking-tight">{yearsLabel(p.yearsToFire)}</div>
                <div class="mt-0.5 text-xs text-muted">
                  {p.fireAge !== null && p.yearsToFire !== 0
                    ? t("mit {age} Jahren ({year})", { age: Math.round(p.fireAge), year: p.fireYear! })
                    : t("FIRE-Zahl {amount}", { amount: fmtEUR0(p.fireNumber) })}
                </div>
              </div>
              <div class="-mr-1.5 -mt-1 flex shrink-0">
                <Button variant="ghost" size="icon-sm" title={t("Bearbeiten")} aria-label={t("Bearbeiten")} onclick={(e) => { e.stopPropagation(); openEdit(scenario); }}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" class="hover:text-neg" title={t("Löschen")} aria-label={t("Löschen")} onclick={(e) => { e.stopPropagation(); remove(scenario.id); }}><Trash2 /></Button>
              </div>
            </div>
            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-[11px] text-muted">
                <span class="num">{fmtEUR0(p.start)} / {fmtEUR0(p.fireNumber)}</span>
                <span class="num font-semibold" style="color: {color}">{fmtNum(p.progressPct, 1)} %</span>
              </div>
              <Progress value={p.progressPct} {color} height={6} />
              <div class="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-faint">
                <span>{fmtEUR0(scenario.params.monthlySavings)}/{t("Mon.")}</span>
                <span>{fmtNum(scenario.params.annualReturnPct, 1)} % {t("Rendite")}</span>
                <span>{fmtNum(scenario.params.withdrawalRatePct, 1)} % SWR</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <Card>
      <CardHeader title={t("Startkapital")}>
        {#snippet actions()}
          {#if emergency}
            <span class="flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck class="size-3.5 text-pos" />
              {t("Notgroschen ({amount}) ist ausgenommen", { amount: fmtEUR0(emergency.balance) })}
            </span>
          {/if}
        {/snippet}
      </CardHeader>
      <div class="px-5 pb-5">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each ASSET_ROWS as row (row.key)}
            {@const on = active?.scenario.params.include[row.key] ?? true}
            <div class={cn("rounded-xl bg-surface-2 px-4 py-3 transition-opacity", !on && "opacity-40")}>
              <div class="flex items-center gap-2">
                <row.icon class="size-4" style="color: {row.color}" />
                <span class="text-xs text-muted">{row.label}</span>
              </div>
              <div class="num mt-1.5 text-lg font-semibold">{fmtEUR0(assets[row.key])}</div>
            </div>
          {/each}
        </div>
        <p class="mt-3 text-xs text-muted">{t("Welche Bausteine zählen, legst du je Szenario fest — über „Bearbeiten“.")}</p>
      </div>
    </Card>

    <p class="text-xs leading-relaxed text-faint">
      {t("Modell: konstante Realrendite, monatliche Sparrate in heutiger Kaufkraft, FIRE-Zahl = Jahresausgaben ÷ Entnahmerate. Keine Steuern/Abgeltungsteuer, keine Sequence-of-Returns-Risiken — als Orientierung gedacht, nicht als Anlageberatung.")}
    </p>
  </div>
{/if}

<Dialog
  bind:open={editOpen}
  title={isNew ? t("Szenario anlegen") : t("Szenario bearbeiten")}
  description={t("Parameter anpassen — die Vorschau rechnet live mit.")}
  class="max-w-2xl"
>
  <div class="space-y-5">
    <Field label={t("Name")}>
      <Input placeholder={t("z. B. Optimistisch, Sparsam, Basis")} bind:value={draftName} />
    </Field>

    {#if preview}
      <div class="sticky top-0 z-10 -mx-1 grid grid-cols-3 gap-3 rounded-xl bg-accent-soft p-4">
        {#each [
          { l: t("FIRE-Zahl"), v: fmtEUR0(preview.fireNumber) },
          { l: t("Zeit bis FIRE"), v: yearsLabel(preview.yearsToFire) },
          { l: t("Fortschritt"), v: `${fmtNum(preview.progressPct, 1)} %` },
        ] as x (x.l)}
          <div>
            <div class="text-[11px] text-muted">{x.l}</div>
            <div class="num mt-0.5 text-sm font-semibold text-accent">{x.v}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#each SLIDERS as s (s.key)}
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
          <span class="text-ink-2">{s.label}</span>
          <span class="num shrink-0 font-semibold">{s.fmt(draft[s.key])}</span>
        </div>
        <input type="range" min={s.min} max={s.max} step={s.step} bind:value={draft[s.key]} class="w-full cursor-pointer accent-[var(--accent)]" />
      </div>
    {/each}

    <div>
      <div class="mb-2 text-[13px] text-ink-2">{t("Welches Vermögen zählt ins Startkapital?")}</div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {#each ASSET_ROWS as row (row.key)}
          {@const on = draft.include[row.key]}
          <button
            type="button"
            onclick={() => (draft.include[row.key] = !on)}
            class={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-all",
              on ? "border-accent/40 bg-accent-soft" : "border-line text-muted hover:border-line-strong"
            )}
          >
            <span class="flex items-center gap-2">
              <row.icon class="size-4" style={on ? `color: ${row.color}` : undefined} />
              {row.label}
            </span>
            <span class="num">{fmtEUR0(assets[row.key])}</span>
          </button>
        {/each}
      </div>
      <div class="mt-2 flex items-center justify-between text-xs">
        <span class="text-muted">{t("Summe Startkapital")}</span>
        <span class="num font-semibold">{fmtEUR(startCapital({ ...draft, startNetWorth: null }, assets))}</span>
      </div>
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between text-[13px]">
        <span class="text-ink-2">{t("Startkapital überschreiben")}</span>
        <button
          type="button"
          class="cursor-pointer text-xs font-medium text-accent hover:underline"
          onclick={() => (draft.startNetWorth = draft.startNetWorth === null ? Math.round(startCapital({ ...draft, startNetWorth: null }, assets)) : null)}
        >
          {draft.startNetWorth === null ? t("manuell setzen") : t("auf automatisch zurück")}
        </button>
      </div>
      {#if draft.startNetWorth !== null}
        <div class="num mb-1 text-right text-[13px] font-semibold">{fmtEUR0(draft.startNetWorth)}</div>
        <input type="range" min={0} max={2000000} step={5000} bind:value={draft.startNetWorth} class="w-full cursor-pointer accent-[var(--accent)]" />
      {/if}
    </div>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (editOpen = false)} disabled={busy}>{t("Abbrechen")}</Button>
    <Button onclick={save} disabled={busy}>{busy ? t("Speichern …") : t("Speichern")}</Button>
  {/snippet}
</Dialog>
