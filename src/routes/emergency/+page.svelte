<script lang="ts">
  import { onMount } from "svelte";
  import { CheckCircle2, Wallet, PencilLine } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import CardHeader from "$lib/components/ui/CardHeader.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtNum } from "$lib/utils";

  type Data = {
    accounts: Array<{ id: string; name: string; balance: number; iban: string | null }>;
    accountId: string | null;
    manual: boolean;
    manualBalance: number;
    target: number;
    balance: number;
    configured: boolean;
    monthsOfExpenses: number;
  };

  let data = $state<Data | null>(null);
  let monthlySpending = $state(0);
  let mode = $state<"account" | "manual">("manual");
  let accountId = $state("");
  let manualBalance = $state("");
  let target = $state("");
  let months = $state("3");
  let busy = $state(false);
  let saved = $state(false);

  async function load() {
    const [d, s] = await Promise.all([
      apiJson<Data>("/api/emergency"),
      apiJson<{ stats?: { avgSpent: number | null }; thisMonth?: { spent: number } }>("/api/summary").catch(() => null),
    ]);
    data = d;
    mode = d.accountId ? "account" : "manual";
    accountId = d.accountId ?? "";
    manualBalance = d.manualBalance ? String(d.manualBalance).replace(".", ",") : "";
    target = d.target ? String(d.target).replace(".", ",") : "";
    months = d.monthsOfExpenses ? String(d.monthsOfExpenses) : "3";
    if (s) monthlySpending = s.stats?.avgSpent ?? s.thisMonth?.spent ?? 0;
  }
  onMount(load);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  async function save() {
    busy = true;
    await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: mode === "account" ? accountId || null : null,
        manualBalance: mode === "manual" ? num(manualBalance) : undefined,
        target: num(target),
        monthsOfExpenses: Number(months) || 0,
      }),
    });
    busy = false;
    saved = true;
    setTimeout(() => (saved = false), 2500);
    load();
  }

  const suggested = $derived(monthlySpending > 0 ? Math.round(monthlySpending * (Number(months) || 3)) : 0);
  const pct = $derived(data && data.target > 0 ? Math.min(100, (data.balance / data.target) * 100) : 0);
  const reached = $derived(Boolean(data && data.target > 0 && data.balance >= data.target));
  const monthsCovered = $derived(data && monthlySpending > 0 ? data.balance / monthlySpending : null);

  const choice = (on: boolean) =>
    cn(
      "cursor-pointer rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
      on ? "border-accent bg-accent-soft ring-3 ring-accent/15" : "border-line hover:border-line-strong"
    );
</script>

<svelte:head><title>{t("Notgroschen")} · Achilles</title></svelte:head>

{#if !data}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader
      title={t("Notgroschen")}
      subtitle={t("Zweckgebundene Rücklage für den Notfall. Sie wird aus dem FIRE-Startkapital herausgerechnet — dieses Geld soll nicht investiert werden.")}
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat
        label={t("Aktueller Stand")}
        value={fmtEUR(data.balance)}
        sub={data.accountId ? data.accounts.find((a) => a.id === data?.accountId)?.name : data.manualBalance > 0 ? t("manuell gepflegt") : t("noch nichts erfasst")}
      />
      <Stat
        label={t("Ziel")}
        value={data.target > 0 ? fmtEUR0(data.target) : "—"}
        sub={data.target > 0 ? (reached ? t("Ziel erreicht") : t("{amount} fehlen", { amount: fmtEUR0(data.target - data.balance) })) : t("kein Ziel gesetzt")}
        subTone={reached ? "pos" : "muted"}
      />
      <Stat
        label={t("Reichweite")}
        value={monthsCovered !== null ? t("{n} Monate", { n: fmtNum(monthsCovered, 1) }) : "—"}
        sub={monthsCovered !== null ? t("bei Ø {amount}/Monat", { amount: fmtEUR0(monthlySpending) }) : t("keine Ausgaben erfasst")}
      />
    </div>

    {#if data.target > 0}
      <Card class="p-5">
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-medium text-ink-2">{t("Fortschritt")}</span>
          <span class={cn("num font-semibold", reached ? "text-pos" : "text-info")}>{fmtNum(pct, 1)} %</span>
        </div>
        <Progress value={pct} height={12} color={reached ? "var(--pos)" : "var(--info)"} />
      </Card>
    {/if}

    <Card>
      <CardHeader title={t("Einrichtung")} subtitle={t("Woher der Stand kommt und wie hoch das Ziel ist")} />
      <div class="space-y-5 px-5 pb-5">
        <div>
          <div class="mb-2 text-xs font-medium text-ink-2">{t("Quelle des Stands")}</div>
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button type="button" onclick={() => (mode = "manual")} class={choice(mode === "manual")}>
              <PencilLine class={cn("size-4", mode === "manual" ? "text-accent" : "text-faint")} />
              <div class="mt-2 text-sm font-semibold">{t("Betrag selbst eintragen")}</div>
              <div class="mt-0.5 text-xs leading-relaxed text-muted">{t("Für Rücklagen, die die App nicht sieht — Tagesgeld bei einer anderen Bank, Bargeld, Bausparer.")}</div>
            </button>
            <button type="button" onclick={() => (mode = "account")} disabled={data.accounts.length === 0} class={choice(mode === "account")}>
              <Wallet class={cn("size-4", mode === "account" ? "text-accent" : "text-faint")} />
              <div class="mt-2 text-sm font-semibold">{t("Konto zuweisen")}</div>
              <div class="mt-0.5 text-xs leading-relaxed text-muted">
                {data.accounts.length === 0
                  ? t("Noch keine Konten vorhanden — verbinde zuerst eine Bank oder importiere eine CSV.")
                  : t("Der Stand kommt automatisch vom Konto und wird aus der Liquidität herausgerechnet.")}
              </div>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {#if mode === "account"}
            <Field label={t("Konto")}>
              <Select bind:value={accountId} options={[{ value: "", label: t("— keines —") }, ...data.accounts.map((a) => ({ value: a.id, label: `${a.name} (${fmtEUR0(a.balance)})` }))]} />
            </Field>
          {:else}
            <Field label={t("Aktueller Stand (€)")}>
              <Input inputmode="decimal" placeholder="10.000" bind:value={manualBalance} />
            </Field>
          {/if}
          <Field label={t("Monatsausgaben abdecken")}>
            <Select bind:value={months} options={[3, 4, 5, 6, 9, 12].map((m) => ({ value: String(m), label: t("{n} Monate", { n: m }) }))} />
          </Field>
          <Field label={t("Zielbetrag (€)")}>
            <Input inputmode="decimal" placeholder="10.000" bind:value={target} />
          </Field>
        </div>

        {#if suggested > 0}
          <button
            type="button"
            onclick={() => (target = String(suggested).replace(".", ","))}
            class="w-full cursor-pointer rounded-xl bg-accent-soft px-3.5 py-2.5 text-left text-xs text-accent hover:brightness-[0.98]"
          >
            {t("Vorschlag aus deinen Ausgaben: {amount} ({n} × {monthly}) — übernehmen", { amount: fmtEUR0(suggested), n: months, monthly: fmtEUR0(monthlySpending) })}
          </button>
        {/if}

        <div class="flex items-center gap-3">
          <Button onclick={save} disabled={busy}>{busy ? t("Speichern …") : t("Speichern")}</Button>
          {#if saved}<span class="flex items-center gap-1.5 text-sm text-pos"><CheckCircle2 class="size-4" /> {t("Gespeichert")}</span>{/if}
        </div>
      </div>
    </Card>
  </div>
{/if}
