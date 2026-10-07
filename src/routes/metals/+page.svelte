<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, RefreshCw, Gem } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import Donut from "$lib/components/charts/Donut.svelte";
  import { t } from "$lib/i18n";
  import { prefs } from "$lib/prefs.svelte";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtGrams, fmtDate, fmtPct } from "$lib/utils";

  type Lot = {
    id: number; grams: number; purchase_price_eur: number; purchase_date: string;
    vendor: string | null; note: string | null; currentValue: number | null; pl: number | null; plPct: number | null;
  };
  type Holding = {
    metal: string; name: string; color: string; totalGrams: number; totalCost: number;
    currentValue: number | null; eurPerGram: number | null; lots: Lot[];
  };
  type Spot = { symbol: string; name: string; eurPerGram: number; fetchedAt: string; stale: boolean };
  type Data = { holdings: Holding[]; spot: Spot[]; totalValue: number; totalCost: number };

  const EMPTY_FORM = () => ({ metal: "XAU", grams: "", purchase_price_eur: "", purchase_date: new Date().toISOString().slice(0, 10), vendor: "", note: "" });

  let data = $state<Data | null>(null);
  let open = $state(false);
  let form = $state(EMPTY_FORM());
  let saving = $state(false);
  let refreshing = $state(false);

  const load = (refresh = false) => apiJson<Data>(`/api/metals${refresh ? "?refresh=1" : ""}`).then((d) => (data = d));
  onMount(() => { load(); });

  async function submit() {
    saving = true;
    const res = await fetch("/api/metals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        grams: parseFloat(form.grams.replace(",", ".")),
        purchase_price_eur: parseFloat(form.purchase_price_eur.replace(",", ".")),
      }),
    });
    saving = false;
    if (res.ok) {
      open = false;
      form = EMPTY_FORM();
      load();
    } else {
      alert((await res.json()).error || t("Fehler beim Speichern"));
    }
  }

  async function remove(id: number) {
    if (!confirm(t("Diesen Kauf wirklich löschen?"))) return;
    await fetch(`/api/metals?id=${id}`, { method: "DELETE" });
    load();
  }

  const totalPL = $derived(data ? data.totalValue - data.totalCost : 0);
  const plColor = (n: number) => (n >= 0 ? "text-pos" : "text-neg");
</script>

<svelte:head><title>{t("Edelmetalle")} · Achilles</title></svelte:head>

{#if !data}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader title={t("Edelmetalle")}>
      {#snippet actions()}
        <Button variant="secondary" size="sm" disabled={refreshing} onclick={async () => { refreshing = true; await load(true); refreshing = false; }}>
          <RefreshCw class={refreshing ? "animate-spin" : ""} /> {t("Kurse aktualisieren")}
        </Button>
        <Button size="sm" onclick={() => (open = true)}><Plus /> {t("Kauf erfassen")}</Button>
      {/snippet}
    </PageHeader>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card class="flex items-center gap-6 p-5 lg:col-span-1">
        <Donut
          size={132}
          thickness={16}
          format={fmtEUR0}
          segments={data.holdings.map((h) => ({ key: h.metal, label: t(h.name), value: h.currentValue ?? h.totalCost, color: h.color }))}
        >
          {#snippet center()}
            <span class="text-[11px] text-muted">{t("Bestand")}</span>
            <span class="num text-sm font-semibold">{fmtEUR0(data?.totalValue ?? 0)}</span>
          {/snippet}
        </Donut>
        <div class="min-w-0 space-y-2.5 text-sm">
          <div>
            <div class="text-xs text-muted">{t("Bestand")}</div>
            <div class="num text-xl font-semibold">{fmtEUR0(data.totalValue)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">{t("Einstand")}</div>
            <div class="num font-medium">{fmtEUR0(data.totalCost)}</div>
          </div>
          <div class={cn("num text-[13px] font-medium", plColor(totalPL))}>
            {totalPL >= 0 ? "+" : ""}{fmtEUR0(totalPL)} ({data.totalCost > 0 ? fmtPct((totalPL / data.totalCost) * 100) : "—"})
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-2 gap-3 lg:col-span-2 xl:grid-cols-4">
        {#each data.spot as s (s.symbol)}
          <Stat
            label="{t(s.name)} · {t('Spot')}"
            value="{fmtEUR(s.eurPerGram)} / g"
            sub={s.stale ? t("⚠ letzter bekannter Kurs") : t("Stand {time}", { time: new Date(s.fetchedAt).toLocaleTimeString(prefs.locale, { hour: "2-digit", minute: "2-digit" }) })}
            subTone={s.stale ? "neg" : "muted"}
          />
        {/each}
        {#if data.spot.length === 0}
          <Card class="col-span-full flex items-center p-5 text-sm text-muted">{t("Spotpreise derzeit nicht verfügbar — Kurse werden automatisch nachgeladen.")}</Card>
        {/if}
      </div>
    </div>

    {#if data.holdings.length === 0}
      <Card>
        <EmptyState icon={Gem} title={t("Edelmetalle")} text={t("Noch keine Bestände. Erfasse deinen ersten Kauf — Gold, Silber, Platin oder Palladium — mit Gewicht und Einstandspreis.")}>
          <Button size="sm" onclick={() => (open = true)}><Plus /> {t("Kauf erfassen")}</Button>
        </EmptyState>
      </Card>
    {:else}
      {#each data.holdings as h (h.metal)}
        <Card class="overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div class="flex items-center gap-3">
              <span class="flex size-10 items-center justify-center rounded-xl" style="background: color-mix(in srgb, {h.color} 15%, transparent); color: {h.color}">
                <Gem class="size-5" />
              </span>
              <div>
                <h3 class="text-[15px] font-semibold">{t(h.name)}</h3>
                <div class="text-xs text-muted">{fmtGrams(h.totalGrams)} · {h.eurPerGram !== null ? `${fmtEUR(h.eurPerGram)}/g` : t("kein Kurs")}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="num text-lg font-semibold">{h.currentValue !== null ? fmtEUR(h.currentValue) : "—"}</div>
              {#if h.currentValue !== null}
                <div class={cn("num text-xs font-medium", plColor(h.currentValue - h.totalCost))}>
                  {h.currentValue - h.totalCost >= 0 ? "+" : ""}{fmtEUR(h.currentValue - h.totalCost)} · {fmtPct(((h.currentValue - h.totalCost) / h.totalCost) * 100)}
                </div>
              {/if}
            </div>
          </div>
          <div class="overflow-x-auto border-t border-line">
            <table class="tbl">
              <thead>
                <tr>
                  <th>{t("Kaufdatum")}</th>
                  <th>{t("Gewicht")}</th>
                  <th>{t("Einstand")}</th>
                  <th class="hidden md:table-cell">{t("Einstand / g")}</th>
                  <th>{t("Aktueller Wert")}</th>
                  <th class="text-right">{t("G/V")}</th>
                  <th class="hidden lg:table-cell">{t("Händler / Notiz")}</th>
                  <th class="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {#each h.lots as l (l.id)}
                  <tr>
                    <td>{fmtDate(l.purchase_date)}</td>
                    <td class="num">{fmtGrams(l.grams)}</td>
                    <td class="num">{fmtEUR(l.purchase_price_eur)}</td>
                    <td class="num hidden text-muted md:table-cell">{fmtEUR(l.purchase_price_eur / l.grams)}</td>
                    <td class="num font-medium">{l.currentValue !== null ? fmtEUR(l.currentValue) : "—"}</td>
                    <td class={cn("num text-right font-medium", plColor(l.pl ?? 0))}>
                      {l.pl !== null ? `${l.pl >= 0 ? "+" : ""}${fmtEUR(l.pl)}` : "—"}
                      {#if l.plPct !== null}<span class="ml-1 text-[11px] opacity-75">({fmtPct(l.plPct)})</span>{/if}
                    </td>
                    <td class="hidden max-w-[200px] truncate text-xs text-muted lg:table-cell">{[l.vendor, l.note].filter(Boolean).join(" · ") || "—"}</td>
                    <td>
                      <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(l.id)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>
      {/each}
    {/if}
  </div>
{/if}

<Dialog bind:open title={t("Edelmetall-Kauf erfassen")} description={t("Jeder Kauf wird als eigene Position (Lot) mit Einstandspreis geführt.")}>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Metall")} class="col-span-2">
      <Select bind:value={form.metal} options={[
        { value: "XAU", label: t("Gold") }, { value: "XAG", label: t("Silber") },
        { value: "XPT", label: t("Platin") }, { value: "XPD", label: t("Palladium") },
      ]} />
    </Field>
    <Field label={t("Gewicht (Gramm)")}><Input inputmode="decimal" placeholder="31,1" bind:value={form.grams} /></Field>
    <Field label={t("Kaufpreis gesamt (€)")}><Input inputmode="decimal" placeholder="2350,00" bind:value={form.purchase_price_eur} /></Field>
    <Field label={t("Kaufdatum")}><Input type="date" bind:value={form.purchase_date} /></Field>
    <Field label={t("Händler (optional)")}><Input placeholder="Philoro, Degussa …" bind:value={form.vendor} /></Field>
    <Field label={t("Notiz (optional)")} class="col-span-2"><Input placeholder={t("1 oz Krügerrand")} bind:value={form.note} /></Field>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
    <Button disabled={saving} onclick={submit}>{saving ? t("Speichern …") : t("Kauf speichern")}</Button>
  {/snippet}
</Dialog>
