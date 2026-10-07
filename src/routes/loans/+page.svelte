<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, HandCoins, ArrowUpRight, ArrowDownLeft, Landmark, User, CheckCircle2, RotateCcw, CalendarClock, FileDown, Pencil, ChevronRight } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Segmented from "$lib/components/ui/Segmented.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Stat from "$lib/components/ui/Stat.svelte";
  import Progress from "$lib/components/ui/Progress.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import LoanReportDialog from "$lib/components/LoanReportDialog.svelte";
  import type { ScheduleRow } from "$lib/amortization";
  import type { Loan, LoanState, Payment } from "$lib/loans";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR, fmtEUR0, fmtDate, fmtPct } from "$lib/utils";

  type Plan = {
    rows: ScheduleRow[]; totalInterest: number; totalPaid: number;
    payoffDate: string | null; months: number; neverPaysOff: boolean; minPayment: number | null;
  };
  type Row = Loan & { payments: Payment[]; state: LoanState; plan: Plan | null };
  type Data = { loans: Row[]; totals: { lent: number; borrowed: number } };

  const EMPTY = () => ({
    direction: "lent" as string,
    counterparty: "",
    kind: "private" as string,
    principal_eur: "",
    interest_pct: "",
    monthly_payment_eur: "",
    start_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    note: "",
  });

  let data = $state<Data | null>(null);
  let filter = $state("all");
  let open = $state(false);
  let form = $state(EMPTY());
  let error = $state<string | null>(null);
  let payFor = $state<Row | null>(null);
  let payOpen = $state(false);
  let pay = $state({ amount_eur: "", paid_on: new Date().toISOString().slice(0, 10), note: "" });
  let payError = $state<string | null>(null);
  let planFor = $state<Row | null>(null);
  let planOpen = $state(false);
  let reportFor = $state<Row | null>(null);
  // id of the loan being edited; null means the dialog creates a new one
  let editingId = $state<number | null>(null);

  const load = () => apiJson<Data>("/api/loans").then((d) => (data = d));
  onMount(load);

  // German input: 1.234,56 → 1234.56
  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  function openNew() {
    editingId = null;
    form = EMPTY();
    error = null;
    open = true;
  }

  async function submit() {
    error = null;
    const payload = {
      ...form,
      principal_eur: num(form.principal_eur),
      interest_pct: form.interest_pct ? num(form.interest_pct) : 0,
      monthly_payment_eur: form.monthly_payment_eur ? num(form.monthly_payment_eur) : null,
      due_date: form.due_date || null,
    };
    const res = await fetch("/api/loans", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });
    if (!res.ok) { error = t((await res.json()).error); return; }
    open = false;
    editingId = null;
    form = EMPTY();
    load();
  }

  function openEdit(l: Row) {
    editingId = l.id;
    error = null;
    form = {
      direction: l.direction,
      counterparty: l.counterparty,
      kind: l.kind,
      principal_eur: String(l.principal_eur).replace(".", ","),
      interest_pct: l.interest_pct ? String(l.interest_pct).replace(".", ",") : "",
      monthly_payment_eur: l.monthly_payment_eur ? String(l.monthly_payment_eur).replace(".", ",") : "",
      start_date: l.start_date,
      due_date: l.due_date ?? "",
      note: l.note ?? "",
    };
    open = true;
  }

  async function refreshPayFor() {
    const fresh: Data = await fetch("/api/loans").then((r) => r.json());
    data = fresh;
    payFor = fresh.loans.find((l) => l.id === payFor?.id) ?? null;
  }

  async function addPayment() {
    if (!payFor) return;
    payError = null;
    const res = await fetch("/api/loans/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loan_id: payFor.id, amount_eur: num(pay.amount_eur), paid_on: pay.paid_on, note: pay.note }),
    });
    if (!res.ok) { payError = t((await res.json()).error); return; }
    pay = { amount_eur: "", paid_on: new Date().toISOString().slice(0, 10), note: "" };
    await refreshPayFor();
  }

  async function removePayment(id: number) {
    await fetch(`/api/loans/payments?id=${id}`, { method: "DELETE" });
    await refreshPayFor();
  }

  async function toggleClosed(l: Row) {
    await fetch("/api/loans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, closed: !l.closed }),
    });
    load();
  }

  async function remove(l: Row) {
    if (!confirm(t("Kredit „{name}“ mit allen Zahlungen löschen?", { name: l.counterparty }))) return;
    await fetch(`/api/loans?id=${l.id}`, { method: "DELETE" });
    load();
  }

  const shown = $derived((data?.loans ?? []).filter((l) => filter === "all" || l.direction === filter));
  const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>{t("Kredite")} · Achilles</title></svelte:head>

{#if !data}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader title={t("Kredite")} subtitle={t("Verliehenes und Aufgenommenes — Zahlungen von Hand erfasst.")}>
      {#snippet actions()}
        <Button size="sm" onclick={openNew}><Plus /> {t("Kredit erfassen")}</Button>
      {/snippet}
    </PageHeader>

    <!-- Shown apart: netting a claim against a debt would turn two different things into one meaningless number. -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Stat icon={ArrowUpRight} color="var(--pos)" label={t("Verliehen · offen")} value={fmtEUR(data.totals.lent)} />
      <Stat icon={ArrowDownLeft} color="var(--neg)" label={t("Aufgenommen · offen")} value={fmtEUR(data.totals.borrowed)} />
    </div>

    <Segmented bind:value={filter} options={[
      { value: "all", label: t("Alle") }, { value: "lent", label: t("Verliehen") }, { value: "borrowed", label: t("Aufgenommen") },
    ]} />

    {#if shown.length === 0}
      <Card>
        <EmptyState icon={HandCoins} title={t("Kredite")} text={t("Noch nichts erfasst. Trage einen Kredit ein, den du vergeben oder aufgenommen hast — mit oder ohne Zinsen.")}>
          <Button size="sm" onclick={openNew}><Plus /> {t("Kredit erfassen")}</Button>
        </EmptyState>
      </Card>
    {:else}
      <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {#each shown as l (l.id)}
          {@const lent = l.direction === "lent"}
          {@const accent = lent ? "var(--pos)" : "var(--neg)"}
          {@const overdue = l.due_date && !l.closed && l.state.outstanding > 0 && l.due_date < today}
          <Card class={cn("group flex flex-col p-5", l.closed && "opacity-60")}>
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 items-center gap-3">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted">
                  {#if l.kind === "bank"}<Landmark class="size-4" />{:else}<User class="size-4" />{/if}
                </span>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold">{l.counterparty}</div>
                  <div class="mt-1 flex flex-wrap items-center gap-1">
                    <Badge tone={lent ? "pos" : "neg"}>{lent ? t("verliehen") : t("aufgenommen")}</Badge>
                    {#if l.interest_pct > 0}<Badge tone="info">{fmtPct(l.interest_pct).replace("+", "")} p. a.</Badge>{:else}<Badge>{t("zinslos")}</Badge>{/if}
                    {#if l.closed === 1}<Badge>{t("abgeschlossen")}</Badge>{/if}
                  </div>
                </div>
              </div>
              <div class="-mr-1.5 -mt-1 flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
                <Button variant="ghost" size="icon-sm" onclick={() => openEdit(l)} title={t("Bearbeiten")} aria-label={t("Bearbeiten")}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" onclick={() => toggleClosed(l)} title={l.closed ? t("Wieder öffnen") : t("Abschließen")} aria-label={l.closed ? t("Wieder öffnen") : t("Abschließen")}>
                  {#if l.closed}<RotateCcw />{:else}<CheckCircle2 />{/if}
                </Button>
                <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(l)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
              </div>
            </div>

            <div class="mt-4 flex items-end justify-between gap-3">
              <div>
                <div class="text-xs text-muted">{t("Offen")}</div>
                <div class="num text-2xl font-semibold tracking-tight" style="color: {accent}">{fmtEUR(l.state.outstanding)}</div>
              </div>
              <div class="text-right text-xs text-muted">
                <div>{t("von {amount}", { amount: fmtEUR0(l.principal_eur) })}</div>
                {#if l.state.interestTotal > 0.005}<div class="mt-0.5">{t("+{amount} Zinsen", { amount: fmtEUR(l.state.interestTotal) })}</div>{/if}
              </div>
            </div>

            <Progress class="mt-3" height={6} value={l.state.progress * 100} color={accent} />
            <div class="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>{t("{amount} getilgt", { amount: fmtEUR0(l.principal_eur - l.state.principalLeft) })}</span>
              <span class="num">{Math.round(l.state.progress * 100)} %</span>
            </div>

            {#if l.state.overpaid > 0.005}
              <div class="mt-2 text-[11px] text-warn">{t("{amount} mehr gezahlt als geschuldet", { amount: fmtEUR(l.state.overpaid) })}</div>
            {/if}

            {#if l.plan && !l.closed}
              {#if l.plan.neverPaysOff}
                <Alert tone="warn" class="mt-3 text-xs">
                  {t("Die Rate deckt nicht einmal die Zinsen — die Schuld würde wachsen. Nötig wären mindestens {amount}/Monat.", { amount: fmtEUR(l.plan.minPayment ?? 0) })}
                </Alert>
              {:else if l.plan.months > 0}
                <button
                  type="button"
                  onclick={() => { planFor = l; planOpen = true; }}
                  class="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-3"
                >
                  <span class="text-muted">{t("Bei {rate}/Monat schuldenfrei in {months} Monaten", { rate: fmtEUR0(l.monthly_payment_eur ?? 0), months: String(l.plan.months) })}</span>
                  <span class="flex shrink-0 items-center font-medium text-ink-2">{t("Tilgungsplan")}<ChevronRight class="size-3.5" /></span>
                </button>
              {/if}
            {/if}

            <div class="h-4 shrink-0"></div>
            <div class="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
              <div class="flex flex-col gap-0.5 text-[11px] text-muted">
                <span>{t("seit {date}", { date: fmtDate(l.start_date) })}</span>
                {#if l.due_date}
                  <span class={cn("flex items-center gap-1", overdue && "font-medium text-neg")}>
                    <CalendarClock class="size-3" />
                    {t("fällig {date}", { date: fmtDate(l.due_date) })}{overdue ? ` · ${t("überfällig")}` : ""}
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-1">
                <Button variant="secondary" size="sm" onclick={() => { payFor = l; payError = null; payOpen = true; }}>
                  {l.payments.length === 1 ? t("1 Zahlung") : t("{n} Zahlungen", { n: l.payments.length })}
                </Button>
                <Button variant="ghost" size="icon-sm" onclick={() => (reportFor = l)} title={t("Als PDF exportieren")} aria-label={t("Als PDF exportieren")}><FileDown /></Button>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<LoanReportDialog bind:loan={reportFor} />

<Dialog
  bind:open
  onclose={() => { error = null; editingId = null; }}
  title={editingId ? t("Kredit bearbeiten") : t("Kredit erfassen")}
  description={t("Zinsen laufen taggenau auf den jeweiligen Restbetrag. Eine Zahlung tilgt erst die aufgelaufenen Zinsen, dann das Kapital. Ohne Zinssatz wird nur getilgt.")}
>
  <div class="grid grid-cols-2 gap-4">
    <div class="col-span-2">
      <Segmented bind:value={form.direction} class="w-full [&>button]:flex-1" options={[
        { value: "lent", label: t("Ich habe verliehen") }, { value: "borrowed", label: t("Ich habe aufgenommen") },
      ]} />
    </div>
    <Field label={form.direction === "lent" ? t("An wen") : t("Bei wem")}>
      <Input placeholder={form.direction === "lent" ? "Max Mustermann" : "Sparkasse"} bind:value={form.counterparty} />
    </Field>
    <Field label={t("Art")}>
      <Select bind:value={form.kind} options={[{ value: "private", label: t("Privat") }, { value: "bank", label: t("Bank") }]} />
    </Field>
    <Field label={t("Summe (€)")}><Input inputmode="decimal" placeholder="2.500" bind:value={form.principal_eur} /></Field>
    <Field label={t("Zinssatz % p. a. (leer = zinslos)")}><Input inputmode="decimal" placeholder="0" bind:value={form.interest_pct} /></Field>
    <Field label={t("Monatliche Rate (€, optional)")} hint={t("Nur mit Rate lässt sich ein Tilgungsplan vorausberechnen.")} class="col-span-2">
      <Input inputmode="decimal" placeholder="200" bind:value={form.monthly_payment_eur} />
    </Field>
    <Field label={t("Beginn")}><Input type="date" bind:value={form.start_date} /></Field>
    <Field label={t("Fällig bis (optional)")}><Input type="date" bind:value={form.due_date} /></Field>
    <Field label={t("Notiz (optional)")} class="col-span-2"><Input bind:value={form.note} /></Field>
  </div>
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
    <Button onclick={submit}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={planOpen}
  onclose={() => (planFor = null)}
  title={t("Tilgungsplan · {name}", { name: planFor?.counterparty ?? "" })}
  description={planFor ? t("Vorausberechnet ab heute auf {outstanding} Restschuld bei {rate} monatlich. Kein Kontoauszug — was tatsächlich gezahlt wurde, steht unter Zahlungen.", { outstanding: fmtEUR(planFor.state.outstanding), rate: fmtEUR(planFor.monthly_payment_eur ?? 0) }) : ""}
  class="max-w-3xl"
>
  {#if planFor?.plan}
    <div class="grid grid-cols-3 gap-3">
      {#each [
        { label: t("Laufzeit"), value: t("{n} Monate", { n: planFor.plan.months }) },
        { label: t("Zinsen gesamt"), value: fmtEUR(planFor.plan.totalInterest) },
        { label: t("Letzte Rate"), value: planFor.plan.payoffDate ? fmtDate(planFor.plan.payoffDate) : "—" },
      ] as k (k.label)}
        <div class="rounded-xl bg-surface-2 p-3">
          <div class="text-xs text-muted">{k.label}</div>
          <div class="num mt-1 text-sm font-semibold">{k.value}</div>
        </div>
      {/each}
    </div>
    <div class="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-line">
      <table class="tbl text-xs">
        <thead class="sticky top-0">
          <tr>
            <th>{t("Nr.")}</th><th>{t("Fällig")}</th>
            <th class="text-right">{t("Rate")}</th><th class="text-right">{t("Zinsen")}</th>
            <th class="text-right">{t("Tilgung")}</th><th class="text-right">{t("Danach offen")}</th>
          </tr>
        </thead>
        <tbody>
          {#each planFor.plan.rows as r (r.n)}
            <tr>
              <td class="text-muted">{r.n}</td>
              <td>{fmtDate(r.date)}</td>
              <td class="num text-right">{fmtEUR(r.payment)}</td>
              <td class="num text-right text-neg">{fmtEUR(r.interest)}</td>
              <td class="num text-right text-pos">{fmtEUR(r.principal)}</td>
              <td class="num text-right text-muted">{fmtEUR(r.closing)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => { reportFor = planFor; planOpen = false; }}><FileDown /> {t("Als PDF exportieren")}</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={payOpen}
  onclose={() => (payFor = null)}
  title={t("Zahlungen · {name}", { name: payFor?.counterparty ?? "" })}
  description={payFor && payFor.interest_pct > 0
    ? t("Jede Zahlung deckt zuerst die bis dahin aufgelaufenen Zinsen, der Rest tilgt das Kapital.")
    : t("Zinslos — jede Zahlung tilgt vollständig das Kapital.")}
>
  <div class="flex flex-wrap items-end gap-2">
    <Field label={t("Betrag (€)")} class="min-w-[110px] flex-1"><Input inputmode="decimal" placeholder="250" bind:value={pay.amount_eur} /></Field>
    <Field label={t("Am")}><Input type="date" bind:value={pay.paid_on} /></Field>
    <Button onclick={addPayment}><Plus /> {t("Erfassen")}</Button>
  </div>
  {#if payError}<div class="mt-2 text-xs text-neg">{payError}</div>{/if}

  {#if payFor && payFor.payments.length > 0}
    <div class="mt-5 max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
      {#each [...payFor.payments].reverse() as p (p.id)}
        <div class="group flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
          <span class="text-muted">{fmtDate(p.paid_on)}</span>
          <div class="flex items-center gap-1">
            <span class="num font-semibold">{fmtEUR(p.amount_eur)}</span>
            <Button variant="ghost" size="icon-sm" class="opacity-0 group-hover:opacity-100 hover:text-neg" onclick={() => removePayment(p.id)} aria-label={t("Löschen")}><Trash2 /></Button>
          </div>
        </div>
      {/each}
    </div>
    {#if payFor.state.paidInterest > 0.005}
      <div class="mt-3 flex justify-between text-xs text-muted">
        <span>{t("davon Zinsen bezahlt")}</span><span class="num">{fmtEUR(payFor.state.paidInterest)}</span>
      </div>
    {/if}
  {/if}
</Dialog>
