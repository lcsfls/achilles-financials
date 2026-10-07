<script lang="ts">
  import { onMount } from "svelte";
  import { ShieldCheck, Pencil, CheckCircle2 } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import { t } from "$lib/i18n";
  import { cn, apiJson, fmtEUR, fmtEUR0, fmtNum } from "$lib/utils";

  type Data = {
    accounts: Array<{ id: string; name: string; balance: number; iban: string | null }>;
    accountId: string | null;
    target: number;
    balance: number;
    monthsOfExpenses: number;
  };

  /** Notgroschen: ein Konto zweckbinden, Ziel setzen, Fortschritt sehen. */
  let { monthlySpending, onchange, class: klass = "" }: { monthlySpending: number; onchange?: () => void; class?: string } = $props();

  let data = $state<Data | null>(null);
  let open = $state(false);
  let accountId = $state("");
  let target = $state("");
  let months = $state("3");
  let busy = $state(false);

  const load = () =>
    apiJson<Data>("/api/emergency").then((d) => {
      data = d;
      accountId = d.accountId ?? "";
      target = d.target ? String(d.target).replace(".", ",") : "";
      months = d.monthsOfExpenses ? String(d.monthsOfExpenses) : "3";
    });
  onMount(load);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));

  async function save() {
    busy = true;
    await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: accountId || null,
        target: target ? num(target) : 0,
        monthsOfExpenses: Number(months) || 0,
      }),
    });
    busy = false;
    open = false;
    await load();
    onchange?.();
  }

  // Zielvorschlag aus den echten Ausgaben — meist aussagekräftiger als eine runde Zahl
  const suggested = $derived(monthlySpending > 0 ? Math.round(monthlySpending * (Number(months) || 3)) : 0);
  const configured = $derived(Boolean(data?.accountId));
  const pct = $derived(data && data.target > 0 ? Math.min(100, (data.balance / data.target) * 100) : 0);
  const reached = $derived(Boolean(data && data.target > 0 && data.balance >= data.target));
  const monthsCovered = $derived(data && monthlySpending > 0 ? data.balance / monthlySpending : null);
</script>

{#if data}
  <Card class={cn("flex flex-col p-5", klass)}>
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pos-soft text-pos">
          <ShieldCheck class="size-4.5" />
        </span>
        <div class="min-w-0">
          <h3 class="text-[15px] font-semibold">{t("Notgroschen")}</h3>
          <div class="truncate text-xs text-muted">
            {configured ? data.accounts.find((a) => a.id === data?.accountId)?.name : t("Kein Konto zugewiesen")}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" onclick={() => (open = true)} title={t("Einrichten")} aria-label={t("Einrichten")}>
        <Pencil />
      </Button>
    </div>

    <div class="mt-4 flex flex-1 flex-col justify-center">
      {#if !configured}
        <p class="text-[13px] leading-relaxed text-muted">
          {t("Weise ein Konto als Notgroschen zu. Es wird dann aus dem FIRE-Startkapital ausgenommen — zweckgebundenes Geld sollte nicht als investierbares Vermögen zählen.")}
        </p>
        <Button variant="secondary" size="sm" class="mt-3 self-start" onclick={() => (open = true)}>
          {t("Notgroschen einrichten")}
        </Button>
      {:else}
        <div class="flex items-end justify-between gap-3">
          <div>
            <div class="num text-2xl font-semibold tracking-tight">{fmtEUR(data.balance)}</div>
            {#if data.target > 0}
              <div class="mt-0.5 text-xs text-muted">
                {t("Ziel {amount}", { amount: fmtEUR0(data.target) })}{#if !reached}{` · ${t("{amount} fehlen", { amount: fmtEUR0(data.target - data.balance) })}`}{/if}
              </div>
            {/if}
          </div>
          {#if reached}
            <span class="flex items-center gap-1 text-xs font-medium text-pos"><CheckCircle2 class="size-4" /> {t("Ziel erreicht")}</span>
          {/if}
        </div>
        {#if data.target > 0}
          <Progress class="mt-3" value={pct} color={reached ? "var(--pos)" : "var(--info)"} />
        {/if}
        {#if monthsCovered !== null}
          <div class="mt-2 text-[11px] text-muted">
            {t("Deckt {n} Monate deiner aktuellen Ausgaben", { n: fmtNum(monthsCovered, 1) })}
          </div>
        {/if}
      {/if}
    </div>
  </Card>

  <Dialog
    bind:open
    title={t("Notgroschen einrichten")}
    description={t("Das gewählte Konto gilt als zweckgebunden und wird aus dem FIRE-Startkapital herausgerechnet.")}
  >
    <div class="space-y-4">
      <Field label={t("Konto")}>
        <Select
          bind:value={accountId}
          options={[{ value: "", label: t("— keines —") }, ...data.accounts.map((a) => ({ value: a.id, label: `${a.name} (${fmtEUR0(a.balance)})` }))]}
        />
        {#if data.accounts.length === 0}
          <p class="mt-1 text-[11px] text-warn">{t("Noch keine Konten vorhanden — verbinde zuerst eine Bank oder importiere eine CSV.")}</p>
        {/if}
      </Field>

      <div class="grid grid-cols-2 gap-4">
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
          class="w-full cursor-pointer rounded-xl bg-accent-soft px-3 py-2.5 text-left text-xs text-accent hover:brightness-[0.98]"
        >
          {t("Vorschlag aus deinen Ausgaben: {amount} ({n} × {monthly}) — übernehmen", {
            amount: fmtEUR0(suggested),
            n: months,
            monthly: fmtEUR0(monthlySpending),
          })}
        </button>
      {/if}
    </div>
    {#snippet footer()}
      <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
      <Button onclick={save} disabled={busy}>{busy ? t("Speichern …") : t("Speichern")}</Button>
    {/snippet}
  </Dialog>
{/if}
