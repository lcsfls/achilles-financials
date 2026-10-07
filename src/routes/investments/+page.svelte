<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, TrendingUp, Pencil, RefreshCw, Upload, Landmark } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Donut from "$lib/components/charts/Donut.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtPct, fmtNum } from "$lib/utils";

  type ImportResult = {
    inserted: number; updated: number;
    skipped?: number;
    /** Only set by the CSV import — the depot fetch has no file format. */
    mode?: "positions" | "transactions";
    detected?: { delimiter: string; headerRow: number; mapping: Record<string, string> };
    convertedFrom: string[];
    noQuoteSymbols: string[];
    withoutCostBasis: string[];
    /** Only for the FinTS fetch. */
    depots?: number;
  };

  type Inv = {
    id: number; name: string; symbol: string | null; units: number;
    buy_price_eur: number; current_price_eur: number | null; kind: string; updated_at: string | null;
  };

  const KIND_LABEL: Record<string, { label: string; color: string }> = {
    stock: { label: "Aktie", color: "#2f6fed" },
    etf: { label: "ETF", color: "#7950f2" },
    crypto: { label: "Krypto", color: "#f59f00" },
    other: { label: "Sonstiges", color: "#868e96" },
  };

  const EMPTY = () => ({ name: "", symbol: "", units: "", buy_price_eur: "", current_price_eur: "", kind: "etf" });

  let invs = $state<Inv[] | null>(null);
  let open = $state(false);
  let form = $state(EMPTY());
  let priceEdit = $state<{ id: number; value: string } | null>(null);
  let refreshing = $state(false);
  let refreshInfo = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();
  let importing = $state(false);
  let importResult = $state<ImportResult | null>(null);
  let importError = $state<string | null>(null);
  let importOpen = $state(false);
  let fintsAvailable = $state(false);

  const load = () => apiJson<{ investments: Inv[] }>("/api/investments").then((d) => (invs = d.investments));
  onMount(() => {
    load();
    // Only offer the depot fetch when FinTS is set up — a button that is sure
    // to fail is not a feature.
    apiJson<{ available: boolean }>("/api/investments/fints").then((d) => (fintsAvailable = d.available)).catch(() => {});
  });

  async function refreshPrices() {
    refreshing = true;
    refreshInfo = null;
    const res = await fetch("/api/investments/refresh", { method: "POST" });
    const d = await res.json();
    await load();
    refreshing = false;
    refreshInfo = t("{n} Kurse aktualisiert", { n: d.updated });
    setTimeout(() => (refreshInfo = null), 5000);
  }

  async function runImport(req: () => Promise<Response>) {
    importing = true;
    importError = null;
    importResult = null;
    const res = await req();
    const d = await res.json();
    importing = false;
    importOpen = true;
    if (!res.ok) { importError = t(d.error); return; }
    importResult = d;
    load();
  }

  const importCsv = async (file: File) =>
    runImport(async () =>
      fetch("/api/import/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: await file.text() }),
      })
    );

  const fetchFints = () => runImport(() => fetch("/api/investments/fints", { method: "POST" }));

  const num = (s: string) => parseFloat(s.replace(",", "."));

  async function submit() {
    const res = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        symbol: form.symbol || null,
        units: num(form.units),
        buy_price_eur: num(form.buy_price_eur),
        current_price_eur: form.current_price_eur ? num(form.current_price_eur) : null,
        kind: form.kind,
      }),
    });
    if (res.ok) { open = false; form = EMPTY(); load(); }
    else alert((await res.json()).error || t("Fehler beim Speichern"));
  }

  async function savePrice() {
    if (!priceEdit) return;
    const edit = priceEdit;
    priceEdit = null;
    await fetch("/api/investments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, current_price_eur: num(edit.value) }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm(t("Position wirklich löschen?"))) return;
    await fetch(`/api/investments?id=${id}`, { method: "DELETE" });
    load();
  }

  const rows = $derived(
    (invs ?? [])
      .map((i) => {
        const cur = i.current_price_eur ?? i.buy_price_eur;
        const value = i.units * cur;
        const cost = i.units * i.buy_price_eur;
        return { ...i, cur, value, cost, pl: value - cost };
      })
      .sort((a, b) => b.value - a.value)
  );
  const totalValue = $derived(rows.reduce((s, r) => s + r.value, 0));
  const totalCost = $derived(rows.reduce((s, r) => s + r.cost, 0));
  const pl = $derived(totalValue - totalCost);
  const byKind = $derived(
    Object.entries(
      rows.reduce<Record<string, number>>((acc, r) => {
        const k = KIND_LABEL[r.kind] ? r.kind : "other";
        acc[k] = (acc[k] ?? 0) + r.value;
        return acc;
      }, {})
    )
      .map(([k, v]) => ({ key: k, label: t(KIND_LABEL[k].label), value: v, color: KIND_LABEL[k].color }))
      .sort((a, b) => b.value - a.value)
  );
</script>

<svelte:head><title>{t("Investments")} · Achilles</title></svelte:head>

<input
  bind:this={fileInput}
  type="file"
  accept=".csv,text/csv"
  class="hidden"
  onchange={(e) => { const el = e.currentTarget; const f = el.files?.[0]; if (f) importCsv(f); el.value = ""; }}
/>

{#if !invs}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader title={t("Investments")}>
      {#snippet actions()}
        {#if refreshInfo}<span class="text-xs font-medium text-pos">{refreshInfo}</span>{/if}
        <Button variant="secondary" size="sm" disabled={refreshing} onclick={refreshPrices}>
          <RefreshCw class={refreshing ? "animate-spin" : ""} /> {t("Kurse aktualisieren")}
        </Button>
        <Button variant="secondary" size="sm" disabled={importing} onclick={() => fileInput?.click()}>
          <Upload /> {importing ? t("Importiere …") : t("CSV importieren")}
        </Button>
        {#if fintsAvailable}
          <Button variant="secondary" size="sm" disabled={importing} onclick={fetchFints}><Landmark /> {t("Depot abrufen")}</Button>
        {/if}
        <Button size="sm" onclick={() => (open = true)}><Plus /> {t("Position hinzufügen")}</Button>
      {/snippet}
    </PageHeader>

    {#if rows.length === 0}
      <Card>
        <EmptyState icon={TrendingUp} title={t("Investments")} text={t("Noch keine Positionen. Füge dein Depot hinzu, um Wertentwicklung und Allokation zu sehen.")}>
          <Button size="sm" onclick={() => (open = true)}><Plus /> {t("Position hinzufügen")}</Button>
        </EmptyState>
      </Card>
    {:else}
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card class="p-5 lg:col-span-2">
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <div class="text-[13px] font-medium text-muted">{t("Depotwert")}</div>
              <div class="num mt-1 text-[30px] font-semibold leading-tight tracking-tight">{fmtEUR0(totalValue)}</div>
              <div class={cn("num mt-1 text-[13px] font-medium", pl >= 0 ? "text-pos" : "text-neg")}>
                {pl >= 0 ? "+" : ""}{fmtEUR0(pl)}{totalCost > 0 ? ` (${fmtPct((pl / totalCost) * 100)})` : ""}
              </div>
            </div>
            <div>
              <div class="text-[13px] font-medium text-muted">{t("Einstand")}</div>
              <div class="num mt-1 text-xl font-semibold">{fmtEUR0(totalCost)}</div>
            </div>
            <div>
              <div class="text-[13px] font-medium text-muted">{t("Positionen")}</div>
              <div class="num mt-1 text-xl font-semibold">{rows.length}</div>
            </div>
          </div>
          <!-- top holdings as one stacked bar -->
          <div class="mt-6">
            <div class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {#each rows as r, i (r.id)}
                <div
                  title="{r.name} · {fmtNum((r.value / totalValue) * 100, 1)} %"
                  style="width: {(r.value / totalValue) * 100}%; background: {KIND_LABEL[r.kind]?.color ?? '#868e96'}; opacity: {Math.max(0.35, 1 - i * 0.12)}"
                ></div>
              {/each}
            </div>
            <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              {#each rows.slice(0, 5) as r, i (r.id)}
                <span class="flex items-center gap-1.5">
                  <span class="size-2 rounded-full" style="background: {KIND_LABEL[r.kind]?.color ?? '#868e96'}; opacity: {Math.max(0.35, 1 - i * 0.12)}"></span>
                  <span class="max-w-40 truncate">{r.name}</span>
                  <span class="num text-faint">{fmtNum((r.value / totalValue) * 100, 1)} %</span>
                </span>
              {/each}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("Allokation")} />
          <div class="flex items-center gap-5 px-5 pb-5">
            <Donut size={128} thickness={16} format={fmtEUR0} segments={byKind}>
              {#snippet center()}<span class="text-[11px] text-muted">{byKind.length} {t("Typen")}</span>{/snippet}
            </Donut>
            <div class="min-w-0 flex-1 space-y-2 text-[13px]">
              {#each byKind as k (k.key)}
                <div class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2 text-ink-2"><span class="size-2 rounded-full" style="background: {k.color}"></span>{k.label}</span>
                  <span class="num font-medium">{fmtNum((k.value / totalValue) * 100, 1)} %</span>
                </div>
              {/each}
            </div>
          </div>
        </Card>
      </div>

      <Card class="overflow-hidden">
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>{t("Position")}</th>
                <th class="hidden sm:table-cell">{t("Typ")}</th>
                <th class="text-right">{t("Anzahl")}</th>
                <th class="hidden text-right md:table-cell">{t("Kaufkurs")}</th>
                <th class="text-right">{t("Akt. Kurs")}</th>
                <th class="text-right">{t("Wert")}</th>
                <th class="text-right">{t("G/V")}</th>
                <th class="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {#each rows as i (i.id)}
                {@const kind = KIND_LABEL[i.kind] ?? KIND_LABEL.other}
                <tr>
                  <td>
                    <div class="font-medium">{i.name}</div>
                    {#if i.symbol}<div class="text-xs text-muted">{i.symbol}</div>{/if}
                  </td>
                  <td class="hidden sm:table-cell"><Badge color={kind.color}>{t(kind.label)}</Badge></td>
                  <td class="num text-right">{fmtNum(i.units, 4)}</td>
                  <td class="num hidden text-right text-muted md:table-cell">{fmtEUR(i.buy_price_eur)}</td>
                  <td class="num text-right">
                    {#if priceEdit?.id === i.id}
                      <!-- svelte-ignore a11y_autofocus -->
                      <Input
                        autofocus
                        class="ml-auto h-8 w-28 text-right text-xs"
                        bind:value={priceEdit.value}
                        onkeydown={(e) => e.key === "Enter" && savePrice()}
                        onblur={savePrice}
                      />
                    {:else}
                      <button
                        type="button"
                        class="group ml-auto flex cursor-pointer items-center gap-1.5"
                        onclick={() => (priceEdit = { id: i.id, value: String(i.cur).replace(".", ",") })}
                        title={t("Kurs bearbeiten")}
                      >
                        <Pencil class="size-3 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                        {fmtEUR(i.cur)}
                      </button>
                    {/if}
                  </td>
                  <td class="num text-right font-semibold">{fmtEUR(i.value)}</td>
                  <td class={cn("num text-right font-medium", i.pl >= 0 ? "text-pos" : "text-neg")}>
                    {i.pl >= 0 ? "+" : ""}{fmtEUR(i.pl)}
                    <div class="text-[11px] opacity-80">{i.cost > 0 ? fmtPct((i.pl / i.cost) * 100) : "—"}</div>
                  </td>
                  <td>
                    <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(i.id)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
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

<Dialog
  bind:open
  title={t("Position hinzufügen")}
  description={t("Mit Symbol im Yahoo-Format (AAPL, VWCE.DE, IWDA.AS, BTC-EUR) wird der Kurs über „Kurse aktualisieren“ automatisch gepflegt.")}
>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Name")} class="col-span-2"><Input placeholder="iShares Core MSCI World" bind:value={form.name} /></Field>
    <Field label={t("Symbol · Yahoo-Format (optional)")}><Input placeholder="VWCE.DE" bind:value={form.symbol} /></Field>
    <Field label={t("Typ")}>
      <Select bind:value={form.kind} options={[
        { value: "etf", label: "ETF" }, { value: "stock", label: t("Aktie") },
        { value: "crypto", label: t("Krypto") }, { value: "other", label: t("Sonstiges") },
      ]} />
    </Field>
    <Field label={t("Anzahl")}><Input inputmode="decimal" placeholder="148" bind:value={form.units} /></Field>
    <Field label={t("Kaufkurs / Stück (€)")}><Input inputmode="decimal" placeholder="82,40" bind:value={form.buy_price_eur} /></Field>
    <Field label={t("Aktueller Kurs / Stück (€, optional)")} class="col-span-2"><Input inputmode="decimal" placeholder="101,20" bind:value={form.current_price_eur} /></Field>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
    <Button onclick={submit}>{t("Position speichern")}</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={importOpen} title={importError ? t("Import fehlgeschlagen") : t("CSV importiert")} onclose={() => { importResult = null; importError = null; }}>
  {#if importError}
    <Alert tone="neg">{importError}</Alert>
  {:else if importResult}
    <p class="text-sm text-muted">
      {importResult.depots !== undefined
        ? t("{n} Depot(s) über FinTS abgerufen.", { n: importResult.depots })
        : importResult.mode === "transactions"
          ? t("Orderliste erkannt — Käufe und Verkäufe wurden zu Positionen verrechnet.")
          : t("Bestandsliste erkannt.")}
    </p>
    <div class="mt-4 grid grid-cols-3 gap-2 text-center">
      {#each [
        { n: importResult.inserted, label: t("neu") },
        { n: importResult.updated, label: t("aktualisiert") },
        { n: importResult.skipped ?? 0, label: t("übersprungen") },
      ] as x (x.label)}
        <div class="rounded-xl bg-surface-2 px-3 py-2.5">
          <div class="num text-xl font-semibold">{x.n}</div>
          <div class="text-[11px] text-muted">{x.label}</div>
        </div>
      {/each}
    </div>
    <div class="mt-4 space-y-2">
      {#if importResult.convertedFrom.length > 0}
        <Alert tone="warn">{t("Beträge in {cur} wurden zum heutigen Kurs in Euro umgerechnet. Für aktuelle Kurse stimmt das — der Einstand eines älteren Kaufs wird dadurch aber falsch, weil im Export kein historischer Wechselkurs steht. Prüfe diese Positionen.", { cur: importResult.convertedFrom.join(", ") })}</Alert>
      {/if}
      {#if importResult.noQuoteSymbols.length > 0}
        <Alert tone="warn">{t("{sym} sind WKN oder ISIN. Der Kursabruf läuft über Yahoo Finance, das nur Kürzel kennt — „Kurse aktualisieren“ lässt diese Positionen aus. Trage das Yahoo-Symbol nach (z. B. AAPL statt 865985).", { sym: importResult.noQuoteSymbols.join(", ") })}</Alert>
      {/if}
      {#if importResult.withoutCostBasis.length > 0}
        <Alert tone="warn">{t("Für {n} keinen Einstandskurs erhalten — als Platzhalter steht dort der aktuelle Kurs, die Wertentwicklung zeigt deshalb 0 %. Bitte den echten Kaufkurs nachtragen.", { n: importResult.withoutCostBasis.join(", ") })}</Alert>
      {/if}
    </div>
    <!-- Show the detected mapping, so an unknown export can be checked instead of just believed -->
    {#if importResult.detected}
      <div class="mt-4">
        <div class="text-xs font-medium text-muted">{t("Erkannte Spalten")}</div>
        <div class="mt-1.5 space-y-1">
          {#each Object.entries(importResult.detected.mapping) as [k, v] (k)}
            <div class="flex justify-between gap-3 text-xs"><span class="text-muted">{k}</span><span class="num truncate">{v}</span></div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</Dialog>
