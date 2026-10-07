<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, Layers } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Donut from "$lib/components/charts/Donut.svelte";
  import InstrumentSearch from "$lib/components/InstrumentSearch.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR0, fmtNum } from "$lib/utils";

  type Row = {
    id: number; symbol: string; name: string | null; weight_pct: number; valueEur: number;
    quote: { price: number; currency: string; changePct: number | null; name: string | null; stale: boolean } | null;
  };
  type Data = {
    allocation: Row[]; totalWeight: number; balance: number;
    startDate: string | null; monthly: number; monthsSinceStart: number;
    contributedEstimate: number; gainEstimate: number | null;
  };

  const COLORS = ["#7950f2", "#2f6fed", "#12a150", "#f59f00", "#e64980", "#15aabf", "#f0652f", "#be4bdb"];

  /** Fund split of the pension: ETFs with a percentage weight + start of payments. */
  let { onchange }: { onchange?: () => void } = $props();

  let data = $state<Data | null>(null);
  let symbol = $state("");
  let weight = $state("");
  let startDate = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  const load = () =>
    apiJson<Data>("/api/pension/allocation").then((d) => {
      data = d;
      startDate = d.startDate ?? "";
    });
  onMount(load);

  async function add() {
    busy = true;
    error = null;
    const res = await fetch("/api/pension/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, weight_pct: parseFloat(weight.replace(",", ".")) }),
    });
    busy = false;
    if (!res.ok) { error = (await res.json()).error; return; }
    symbol = "";
    weight = "";
    load();
    onchange?.();
  }

  async function setWeightFor(id: number, value: number) {
    error = null;
    const res = await fetch("/api/pension/allocation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, weight_pct: value }),
    });
    if (!res.ok) { error = (await res.json()).error; return; }
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/pension/allocation?id=${id}`, { method: "DELETE" });
    load();
  }

  async function saveStart(value: string) {
    startDate = value;
    await fetch("/api/pension/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: value }),
    });
    load();
  }

  const remaining = $derived(data ? Math.round((100 - data.totalWeight) * 10) / 10 : 0);
  const complete = $derived(data ? Math.abs(data.totalWeight - 100) < 0.05 : false);
</script>

{#if data}
  <!-- relative z-20: the search results must paint over the cards that follow -->
  <Card class="relative z-20">
    <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,#7950f2_13%,transparent)] text-[#7950f2]"><Layers class="size-4.5" /></span>
        <div>
          <h3 class="text-[15px] font-semibold">{t("Fondsaufteilung")}</h3>
          <div class="text-xs text-muted">{t("Worin deine Vorsorge angelegt ist")}</div>
        </div>
      </div>
      <span class={cn("num rounded-full px-2 py-0.5 text-xs font-semibold", complete ? "bg-pos-soft text-pos" : "bg-warn-soft text-warn")}>{fmtNum(data.totalWeight, 1)} %</span>
    </div>

    <div class="space-y-4 px-5 pb-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("Einzahlungen seit")}>
          <Input type="date" value={startDate} onchange={(e) => saveStart(e.currentTarget.value)} />
        </Field>
        {#if data.startDate && data.monthly > 0}
          <div class="flex flex-col justify-center rounded-xl bg-surface-2 px-4 py-2">
            <div class="text-xs text-muted">{t("Eingezahlt (geschätzt)")}</div>
            <div class="num text-sm font-semibold">
              {fmtEUR0(data.contributedEstimate)}
              <span class="ml-1 text-[11px] font-normal text-muted">{t("in {n} Monaten", { n: data.monthsSinceStart })}</span>
            </div>
            {#if data.gainEstimate !== null}
              <div class={cn("text-[11px]", data.gainEstimate >= 0 ? "text-pos" : "text-neg")}>{data.gainEstimate >= 0 ? "+" : ""}{fmtEUR0(data.gainEstimate)} {t("Wertzuwachs")}</div>
            {/if}
          </div>
        {/if}
      </div>

      {#if data.allocation.length > 0}
        <div class="flex flex-col items-center gap-5 sm:flex-row">
          <Donut
            size={148}
            thickness={18}
            format={(v) => `${fmtNum(v, 1)} %`}
            segments={data.allocation.map((a, i) => ({ key: String(a.id), label: a.name || a.quote?.name || a.symbol, value: a.weight_pct, color: COLORS[i % COLORS.length] }))}
          >
            {#snippet center()}
              <span class="text-[11px] text-muted">{t("Guthaben")}</span>
              <span class="num text-sm font-semibold">{fmtEUR0(data?.balance ?? 0)}</span>
            {/snippet}
          </Donut>

          <div class="w-full min-w-0 flex-1 divide-y divide-line">
            {#each data.allocation as a, i (a.id)}
              <div class="flex items-center gap-3 py-2">
                <span class="size-2 shrink-0 rounded-full" style="background: {COLORS[i % COLORS.length]}"></span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[13px] font-medium">{a.name || a.quote?.name || a.symbol}</div>
                  <div class="flex items-center gap-2 text-[11px] text-muted">
                    <span>{a.symbol}</span>
                    {#if a.quote}
                      <span class={(a.quote.changePct ?? 0) >= 0 ? "text-pos" : "text-neg"}>
                        {fmtNum(a.quote.price)} {a.quote.currency}{a.quote.changePct !== null ? ` (${a.quote.changePct >= 0 ? "+" : ""}${fmtNum(a.quote.changePct, 1)} %)` : ""}
                      </span>
                    {/if}
                  </div>
                </div>
                <input
                  type="number" min={0.1} max={100} step={0.1}
                  value={a.weight_pct}
                  onblur={(e) => {
                    const v = parseFloat(e.currentTarget.value);
                    if (v && v !== a.weight_pct) setWeightFor(a.id, v);
                  }}
                  class="num h-8 w-16 rounded-lg border border-line bg-surface px-2 text-right text-xs focus:border-accent focus:outline-none"
                />
                <span class="text-[11px] text-muted">%</span>
                <span class="num w-20 shrink-0 text-right text-xs font-medium">{fmtEUR0(a.valueEur)}</span>
                <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(a.id)} title={t("Entfernen")} aria-label={t("Entfernen")}><Trash2 /></Button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if !complete && data.allocation.length > 0}
        <Alert tone="warn">{remaining > 0 ? t("Noch {n} % nicht zugeordnet.", { n: fmtNum(remaining, 1) }) : t("Gewichtung übersteigt 100 %.")}</Alert>
      {/if}
      {#if error}<Alert tone="neg">{error}</Alert>{/if}

      <div class="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3">
        <div class="min-w-[180px] flex-1">
          <div class="mb-1.5 text-xs font-medium text-ink-2">{t("Fonds suchen")}</div>
          <!-- Unlike the watchlist, picking only fills the symbol: the weight still has to be entered. -->
          <InstrumentSearch
            compact
            bind:value={symbol}
            onpick={(sym) => { symbol = sym; error = null; }}
            placeholder={t("Name oder ISIN, z. B. IE00B4L5Y983")}
          />
        </div>
        <Field label={t("Gewicht %")} class="w-24">
          <Input
            class="h-8.5 text-[13px]"
            inputmode="decimal"
            placeholder={remaining > 0 ? String(remaining).replace(".", ",") : "50"}
            bind:value={weight}
            onkeydown={(e) => e.key === "Enter" && add()}
          />
        </Field>
        <Button size="sm" class="h-8.5" disabled={busy || !symbol || !weight} onclick={add}>
          {#if busy}{t("Prüfe …")}{:else}<Plus /> {t("Hinzufügen")}{/if}
        </Button>
      </div>

      {#if data.allocation.length === 0}
        <p class="text-xs leading-relaxed text-muted">{t("Trage die Fonds deiner Vorsorge mit ihrer Gewichtung ein — der Anteil am Guthaben und die Live-Kurse erscheinen dann hier.")}</p>
      {/if}
    </div>
  </Card>
{/if}
