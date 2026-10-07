<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, PiggyBank, Shield, Info, ChevronRight, Pencil } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import AreaChart from "$lib/components/charts/AreaChart.svelte";
  import PensionAllocation from "$lib/components/PensionAllocation.svelte";
  import PensionStatutory from "$lib/components/PensionStatutory.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtDate, fmtNum } from "$lib/utils";
  import type { ContractStats, Statement, Waterfall } from "$lib/pension";

  type Contract = {
    id: number; label: string; kind: "pension" | "life";
    provider: string | null; monthly_eur: number | null; note: string | null;
    statements: Array<Statement & { waterfall: Waterfall | null }>; stats: ContractStats;
  };
  type Data = { contracts: Contract[]; totalBalance: number; totalContrib: number; totalReturn: number };

  const EMPTY_STMT = () => ({
    statement_date: new Date().toISOString().slice(0, 10), balance_eur: "", contribution_eur: "", note: "",
    prev_balance_eur: "", fund_performance_eur: "", earned_returns_eur: "",
    acquisition_costs_eur: "", admin_costs_eur: "", total_paid_eur: "",
  });
  const EMPTY_CONTRACT = () => ({ label: "", kind: "pension" as string, provider: "", monthly_eur: "" });

  let data = $state<Data | null>(null);
  let activeId = $state<number | null>(null);
  let stmtOpen = $state(false);
  let contractOpen = $state(false);
  let methodOpen = $state(false);
  let editing = $state<number | null>(null);
  let form = $state(EMPTY_STMT());
  let contract = $state(EMPTY_CONTRACT());
  let error = $state<string | null>(null);
  let details = $state(false);
  let expanded = $state<number | null>(null);

  const load = () =>
    apiJson<Data>("/api/pension").then((d) => {
      data = d;
      // Keep the current selection if it still exists, otherwise take the first.
      activeId = activeId && d.contracts.some((c) => c.id === activeId) ? activeId : d.contracts[0]?.id ?? null;
    });
  onMount(load);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const opt = (v: string) => (v.trim() ? num(v) : null);

  async function saveContract() {
    error = null;
    const payload = {
      label: contract.label.trim(),
      kind: contract.kind,
      provider: contract.provider,
      monthly_eur: contract.monthly_eur ? num(contract.monthly_eur) : null,
    };
    const res = await fetch("/api/pension", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing, ...payload } : { contract: payload }),
    });
    if (!res.ok) { error = t((await res.json()).error || "Fehler beim Speichern"); return; }
    const body = await res.json();
    contractOpen = false;
    contract = EMPTY_CONTRACT();
    editing = null;
    await load();
    if (body.id) activeId = body.id;
  }

  async function addStatement() {
    if (!activeId) return;
    error = null;
    const res = await fetch("/api/pension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: activeId,
        statement_date: form.statement_date,
        balance_eur: num(form.balance_eur),
        contribution_eur: form.contribution_eur ? num(form.contribution_eur) : null,
        note: form.note || null,
        // Empty stays empty: an untouched field must not be stored as a zero
        // that would claim the costs were nil.
        prev_balance_eur: opt(form.prev_balance_eur),
        fund_performance_eur: opt(form.fund_performance_eur),
        earned_returns_eur: opt(form.earned_returns_eur),
        acquisition_costs_eur: opt(form.acquisition_costs_eur),
        admin_costs_eur: opt(form.admin_costs_eur),
        total_paid_eur: opt(form.total_paid_eur),
      }),
    });
    if (!res.ok) { error = t((await res.json()).error || "Fehler beim Speichern"); return; }
    stmtOpen = false;
    form = EMPTY_STMT();
    load();
  }

  async function removeStatement(id: number) {
    if (!confirm(t("Diesen Auszug wirklich löschen?"))) return;
    await fetch(`/api/pension?statement=${id}`, { method: "DELETE" });
    load();
  }

  async function removeContract(c: Contract) {
    if (!confirm(t("Vertrag samt allen Auszügen löschen?"))) return;
    await fetch(`/api/pension?contract=${c.id}`, { method: "DELETE" });
    load();
  }

  function openEdit(c: Contract) {
    editing = c.id;
    error = null;
    contract = { label: c.label, kind: c.kind, provider: c.provider ?? "", monthly_eur: c.monthly_eur ? String(c.monthly_eur).replace(".", ",") : "" };
    contractOpen = true;
  }

  const active = $derived(data?.contracts.find((c) => c.id === activeId) ?? null);
  const s = $derived(active?.stats ?? null);
  const chartData = $derived((active?.statements ?? []).map((x) => ({ ...x, label: fmtDate(x.statement_date) })));
  const rows = $derived.by(() => {
    const list = [...(active?.statements ?? [])].reverse();
    return list.map((x, idx) => {
      const prev = list[idx + 1];
      const delta = prev ? x.balance_eur - prev.balance_eur : null;
      // This row's own return: the change minus what was paid in
      const ret = delta === null ? null : delta - (x.contribution_eur ?? 0);
      return { x, delta, ret, w: x.waterfall };
    });
  });

  const STMT_DETAILS = $derived([
    { key: "prev_balance_eur", label: t("Vorheriges Vertragsguthaben (€)") },
    { key: "total_paid_eur", label: t("Beiträge insgesamt bisher (€)") },
    { key: "fund_performance_eur", label: t("Wert aus Entwicklung des Fondsportfolios (€)") },
    { key: "earned_returns_eur", label: t("Erwirtschaftete Erträge — Zinsen, Überschüsse (€)") },
    { key: "acquisition_costs_eur", label: t("Abschluss- und Vertriebskosten (€)") },
    { key: "admin_costs_eur", label: t("Verwaltungskosten (€)") },
  ] as Array<{ key: "prev_balance_eur" | "total_paid_eur" | "fund_performance_eur" | "earned_returns_eur" | "acquisition_costs_eur" | "admin_costs_eur"; label: string }>);

  const pct1 = (n: number) => `${n >= 0 ? "+" : ""}${fmtNum(n, 1)} %`;
</script>

<svelte:head><title>{t("Vorsorge")} · Achilles</title></svelte:head>

{#if !data}
  <Loading rows={2} />
{:else}
  <div class="rise space-y-6">
    <PageHeader
      title={t("Vorsorge")}
      subtitle={data.contracts.length === 0
        ? t("Renten- und Lebensversicherungen erfassen — die Stände fließen ins Gesamtvermögen und in den FIRE-Simulator ein.")
        : `${data.contracts.length === 1 ? t("1 Vertrag") : t("{n} Verträge", { n: data.contracts.length })} · ${fmtEUR0(data.totalBalance)}`}
    >
      {#snippet actions()}
        <Button variant="secondary" size="sm" onclick={() => (methodOpen = true)}><Info /> {t("Wie gerechnet wird")}</Button>
        <Button size="sm" onclick={() => { editing = null; contract = EMPTY_CONTRACT(); error = null; contractOpen = true; }}><Plus /> {t("Vertrag anlegen")}</Button>
      {/snippet}
    </PageHeader>

    {#if data.contracts.length === 0}
      <Card>
        <EmptyState icon={PiggyBank} title={t("Vorsorge")} text={t("Noch kein Vertrag angelegt. Lege deine Altersvorsorge oder Lebensversicherung an und trage danach die Stände aus den Jahresauszügen ein.")} />
      </Card>
      <PensionStatutory />
    {:else}
      <!-- Contract switcher — several contracts run side by side -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each data.contracts as c (c.id)}
          <button
            type="button"
            onclick={() => (activeId = c.id)}
            class={cn(
              "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all",
              c.id === activeId ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"
            )}
          >
            <span class={cn("flex size-7 items-center justify-center rounded-lg", c.id === activeId ? "bg-accent text-accent-ink" : "bg-surface-3 text-muted")}>
              {#if c.kind === "life"}<Shield class="size-3.5" />{:else}<PiggyBank class="size-3.5" />{/if}
            </span>
            <span>
              <span class="block font-medium">{c.label}</span>
              <span class="num block text-xs text-muted">{fmtEUR0(c.stats.latestBalance)}</span>
            </span>
          </button>
        {/each}
      </div>

      {#if active && s}
        <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label={t("Aktueller Stand")} value={fmtEUR0(s.latestBalance)} sub={s.latestDate ? t("Auszug vom {date}", { date: fmtDate(s.latestDate) }) : t("noch kein Auszug erfasst")} />
          <Stat label={t("Erfasste Beiträge")} value={fmtEUR0(s.totalContrib)} sub={s.contribFromStatement ? t("laut Auszug seit Vertragsbeginn") : t("Summe über {n} Auszüge", { n: active.statements.length })} />
          <!-- The honest headline: the balance change minus the money paid in -->
          <Stat
            label={t("Wertzuwachs")}
            value="{s.netReturn >= 0 ? '+' : ''}{fmtEUR0(s.netReturn)}"
            valueTone={s.netReturn >= 0 ? "pos" : "neg"}
            sub={s.netReturnPct !== null ? t("{pct} auf eingesetztes Kapital", { pct: pct1(s.netReturnPct) }) : t("mindestens zwei Auszüge nötig")}
          />
          <!-- Naming the contributions inside it prevents reading this as a return -->
          <Stat
            label={t("Standänderung")}
            value="{s.growth >= 0 ? '+' : ''}{fmtEUR0(s.growth)}"
            sub={s.contribSince > 0 ? t("davon {amount} eigene Beiträge", { amount: fmtEUR0(s.contribSince) }) : s.firstDate ? t("seit {date}", { date: fmtDate(s.firstDate) }) : "—"}
          />
        </div>

        <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card class="xl:col-span-2">
            <CardHeader
              title={active.label}
              subtitle={[
                active.kind === "life" ? t("Lebensversicherung") : t("Altersvorsorge"),
                active.provider,
                active.monthly_eur ? t("{amount}/Monat", { amount: fmtEUR0(active.monthly_eur) }) : null,
              ].filter(Boolean).join(" · ")}
            >
              {#snippet actions()}
                <Button variant="ghost" size="icon-sm" onclick={() => openEdit(active)} title={t("Bearbeiten")} aria-label={t("Bearbeiten")}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => removeContract(active)} title={t("Vertrag löschen")} aria-label={t("Vertrag löschen")}><Trash2 /></Button>
                <Button variant="secondary" size="sm" onclick={() => { error = null; stmtOpen = true; }}><Plus /> {t("Auszug")}</Button>
              {/snippet}
            </CardHeader>
            <div class="px-3 pb-4">
              {#if chartData.length < 2}
                <div class="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <PiggyBank class="size-9 text-faint" />
                  <p class="max-w-xs text-sm text-muted">{t("Ab zwei erfassten Auszügen erscheint hier die Entwicklung deines Guthabens.")}</p>
                </div>
              {:else}
                <AreaChart data={chartData} x="label" height={280} series={[{ key: "balance_eur", label: t("Stand"), color: "var(--pos)" }]} valueFormat={fmtEUR} />
              {/if}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Alle Verträge")} />
            <div class="px-2 pb-3">
              {#each data.contracts as c (c.id)}
                <button
                  type="button"
                  onclick={() => (activeId = c.id)}
                  class={cn("flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2", c.id === activeId && "bg-surface-2")}
                >
                  <div class="min-w-0">
                    <div class="truncate text-[13px] font-medium">{c.label}</div>
                    <div class="text-xs text-muted">{c.kind === "life" ? t("Lebensversicherung") : t("Altersvorsorge")}</div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="num text-[13px] font-semibold">{fmtEUR0(c.stats.latestBalance)}</div>
                    <div class={cn("num text-xs", c.stats.netReturn >= 0 ? "text-pos" : "text-neg")}>{c.stats.netReturn >= 0 ? "+" : ""}{fmtEUR0(c.stats.netReturn)}</div>
                  </div>
                </button>
              {/each}
              <div class="mx-3 mt-2 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span class="text-muted">{t("Gesamt")}</span>
                <span class="num font-semibold">{fmtEUR0(data.totalBalance)}</span>
              </div>
            </div>
          </Card>
        </div>

        <PensionAllocation onchange={load} />
        <PensionStatutory />

        <Card class="overflow-hidden">
          <CardHeader title={t("Kontoauszüge")} />
          {#if active.statements.length === 0}
            <div class="p-10 text-center text-sm text-muted">{t("Noch keine Auszüge erfasst.")}</div>
          {:else}
            <div class="overflow-x-auto border-t border-line">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>{t("Datum")}</th>
                    <th class="text-right">{t("Stand")}</th>
                    <th class="text-right">{t("Beitrag seit letztem")}</th>
                    <th class="text-right">{t("Standänderung")}</th>
                    <th class="text-right">{t("davon Wertzuwachs")}</th>
                    <th class="hidden md:table-cell">{t("Notiz")}</th>
                    <th class="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each rows as { x, delta, ret, w } (x.id)}
                    <tr class={cn(w && "cursor-pointer")} onclick={() => w && (expanded = expanded === x.id ? null : x.id)}>
                      <td>
                        <span class="flex items-center gap-1.5">
                          {#if w}<ChevronRight class={cn("size-3.5 text-faint transition-transform", expanded === x.id && "rotate-90")} />{/if}
                          {fmtDate(x.statement_date)}
                        </span>
                      </td>
                      <td class="num text-right font-medium">{fmtEUR(x.balance_eur)}</td>
                      <td class="num text-right text-muted">{x.contribution_eur != null ? fmtEUR(x.contribution_eur) : "—"}</td>
                      <td class="num text-right text-muted">{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${fmtEUR(delta)}`}</td>
                      <td class={cn("num text-right", ret !== null && (ret >= 0 ? "text-pos" : "text-neg"))}>{ret === null ? "—" : `${ret >= 0 ? "+" : ""}${fmtEUR(ret)}`}</td>
                      <td class="hidden max-w-[220px] truncate text-xs text-muted md:table-cell">{x.note || "—"}</td>
                      <td>
                        <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={(e) => { e.stopPropagation(); removeStatement(x.id); }} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
                      </td>
                    </tr>

                    <!-- The year, line by line, exactly as the statement prints it -->
                    {#if w && expanded === x.id}
                      <tr class="bg-surface-2 hover:bg-surface-2">
                        <td colspan="7" class="!py-5">
                          <div class="max-w-xl space-y-1.5 text-xs">
                            {#each [
                              [t("Vorheriges Vertragsguthaben"), w.prevBalance, false],
                              [t("Eingezahlte Beiträge"), w.contribution, false],
                              [t("Wert aus Entwicklung des Fondsportfolios"), w.fundPerformance, false],
                              [t("Erwirtschaftete Erträge"), w.earnedReturns, false],
                              [t("Abschluss- und Vertriebskosten"), -w.acquisitionCosts, true],
                              [t("Verwaltungskosten"), -w.adminCosts, true],
                            ] as [label, value, isCost] (label)}
                              <div class="flex justify-between gap-4 border-b border-line pb-1.5">
                                <span class={isCost ? "text-neg" : "text-ink-2"}>{label}</span>
                                <span class={cn("num", isCost && "text-neg")}>{Number(value) >= 0 ? "" : "−"}{fmtEUR(Math.abs(Number(value)))}</span>
                              </div>
                            {/each}
                            <div class="flex justify-between gap-4 pt-1.5 font-semibold">
                              <span>{t("Vertragsguthaben")}</span><span class="num">{fmtEUR(x.balance_eur)}</span>
                            </div>
                            <div class="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-surface p-3">
                              <div>
                                <div class="text-[11px] text-muted">{t("Ertrag nach Kosten")}</div>
                                <div class={cn("num mt-0.5 text-sm font-semibold", w.netGain >= 0 ? "text-pos" : "text-neg")}>{w.netGain >= 0 ? "+" : ""}{fmtEUR(w.netGain)}</div>
                              </div>
                              <div>
                                <div class="text-[11px] text-muted">{t("Kosten gesamt")}</div>
                                <div class="num mt-0.5 text-sm font-semibold text-neg">{fmtEUR(w.costsTotal)}</div>
                              </div>
                              {#if w.costRatio !== null}
                                <div>
                                  <div class="text-[11px] text-muted">{t("davon vom Jahresbeitrag")}</div>
                                  <div class="num mt-0.5 text-sm font-semibold">{fmtNum(w.costRatio * 100, 1)} %</div>
                                </div>
                              {/if}
                            </div>
                            <!-- Only when the gap is too big to be rounding -->
                            {#if w.mismatch}
                              <Alert tone="warn" class="mt-3">
                                {t("Die Posten ergeben {computed}, im Auszug steht {actual} — Differenz {diff}. Vermutlich ein Tippfehler oder ein Posten, den dieser Vertrag anders ausweist.", {
                                  computed: fmtEUR(w.computed), actual: fmtEUR(x.balance_eur), diff: fmtEUR(Math.abs(w.difference)),
                                })}
                              </Alert>
                            {/if}
                          </div>
                        </td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      {/if}
    {/if}
  </div>
{/if}

<Dialog
  bind:open={contractOpen}
  onclose={() => { error = null; editing = null; }}
  title={editing ? t("Vertrag bearbeiten") : t("Vertrag anlegen")}
  description={t("Jeder Vertrag wird eigenständig geführt — betriebliche und private Altersvorsorge, Lebens- und Rentenversicherungen nebeneinander.")}
>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Bezeichnung")} class="col-span-2"><Input placeholder={t("z. B. Direktversicherung")} bind:value={contract.label} /></Field>
    <Field label={t("Art")}>
      <Select bind:value={contract.kind} options={[{ value: "pension", label: t("Altersvorsorge") }, { value: "life", label: t("Lebensversicherung") }]} />
    </Field>
    <Field label={t("Anbieter / Versicherung")}><Input bind:value={contract.provider} /></Field>
    <Field label={t("Monatlicher Beitrag gesamt (€, AG + AN)")} class="col-span-2"><Input inputmode="decimal" placeholder="150,00" bind:value={contract.monthly_eur} /></Field>
  </div>
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (contractOpen = false)}>{t("Abbrechen")}</Button>
    <Button onclick={saveContract}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={stmtOpen}
  onclose={() => (error = null)}
  title={t("Kontoauszug erfassen")}
  description={t("Datum und Stand vom Auszug übernehmen. Der Beitrag ist das, was seit dem letzten Auszug eingezahlt wurde — nur damit lässt sich der echte Wertzuwachs vom eigenen Geld trennen.")}
>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Datum des Auszugs")}><Input type="date" bind:value={form.statement_date} /></Field>
    <Field label={t("Stand / Guthaben (€)")}><Input inputmode="decimal" placeholder="12.480,55" bind:value={form.balance_eur} /></Field>
    <Field label={t("Beiträge seit letztem Auszug (€, optional)")}><Input inputmode="decimal" placeholder="1.200,00" bind:value={form.contribution_eur} /></Field>
    <Field label={t("Notiz (optional)")}><Input placeholder={t("Jahresmitteilung")} bind:value={form.note} /></Field>
  </div>

  <!-- Collapsed by default: a plain balance is a complete statement, and six
       more fields on first open would look like they were required. -->
  <button type="button" onclick={() => (details = !details)} class="mt-5 flex w-full cursor-pointer items-center gap-2 text-xs font-medium text-muted transition-colors hover:text-ink">
    <ChevronRight class={cn("size-3.5 transition-transform", details && "rotate-90")} />
    {t("Weitere Angaben vom Auszug (optional)")}
  </button>

  {#if details}
    <div class="mt-4 space-y-4 rounded-xl bg-surface-2 p-4">
      <p class="text-xs leading-relaxed text-muted">{t("Diese Posten stehen so auf deiner Jahresmitteilung. Trägst du sie ein, zeigt Achilles für das Jahr, wie viel Ertrag der Vertrag erwirtschaftet hat und wie viel davon in Kosten geflossen ist.")}</p>
      <div class="grid grid-cols-2 gap-4">
        {#each STMT_DETAILS as d (d.key)}
          <Field label={d.label}><Input inputmode="decimal" bind:value={form[d.key]} /></Field>
        {/each}
      </div>
      <p class="text-[11px] text-muted">{t("Kosten als positive Beträge eintragen — sie werden als Abzug gerechnet.")}</p>
    </div>
  {/if}
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (stmtOpen = false)}>{t("Abbrechen")}</Button>
    <Button onclick={addStatement}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={methodOpen}
  title={t("Wie gerechnet wird")}
  description={t("Alle Zahlen stammen aus den Auszügen, die du erfasst hast. Es sind keine Tageswerte, sondern Stände zu deinen Stichtagen.")}
>
  <div class="space-y-3 text-[13px] leading-relaxed text-ink-2">
    <p><strong class="text-ink">{t("Standänderung")}</strong> — {t("die Differenz zwischen erstem und letztem Auszug. Sie enthält deine eigenen Einzahlungen.")}</p>
    <p><strong class="text-ink">{t("Wertzuwachs")}</strong> — {t("dieselbe Differenz, abzüglich der Beiträge seit dem ersten Auszug. Nur das hat der Vertrag tatsächlich erwirtschaftet.")}</p>
    <p>{t("Die Prozentangabe bezieht sich auf das eingesetzte Kapital (erster Stand plus spätere Einzahlungen). Bewusst keine zeitgewichtete Rendite: Jahresauszüge liegen zu weit auseinander, um eine solche ehrlich zu berechnen.")}</p>
  </div>
</Dialog>
