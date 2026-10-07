<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, Wallet, Pencil, Check } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Segmented from "$lib/components/ui/Segmented.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import { CATEGORIES } from "$lib/categorize";
  import { t } from "$lib/i18n";
  import { apiJson, fmtEUR } from "$lib/utils";

  type Account = {
    id: string; name: string; currency: string; balance: number;
    manual: number; provider: string; tx_count: number;
  };

  /**
   * Accounts and bookings kept by hand.
   *
   * Without this the app only works for someone whose bank speaks PSD2. A cash
   * box, a building society account, a bank with no API — all of it is entered
   * here. Manual accounts are kept apart from synced ones because a booking
   * written into a synced account would be wiped by the next sync.
   */
  let { onchange }: { onchange?: () => void } = $props();

  let accounts = $state<Account[] | null>(null);
  let open = $state(false);
  let txOpen = $state(false);
  let error = $state<string | null>(null);
  let editing = $state<string | null>(null);
  let editBalance = $state("");

  let acc = $state({ name: "", currency: "EUR", balance: "" });
  let tx = $state({
    account_id: "", booking_date: new Date().toISOString().slice(0, 10),
    amount: "", merchant: "", description: "", category: "", sign: "-" as string,
  });

  const load = () => apiJson<{ accounts: Account[] }>("/api/accounts").then((d) => (accounts = d.accounts));
  onMount(load);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const refresh = () => { load(); onchange?.(); };
  const manual = $derived((accounts ?? []).filter((a) => a.manual));

  async function addAccount() {
    error = null;
    const res = await fetch("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: acc.name, currency: acc.currency, balance: acc.balance ? num(acc.balance) : 0 }),
    });
    if (!res.ok) { error = t((await res.json()).error || "Fehler beim Speichern"); return; }
    open = false;
    acc = { name: "", currency: "EUR", balance: "" };
    refresh();
  }

  async function addTx() {
    error = null;
    // Sign is a separate control: typing a minus is easy to forget, and an
    // expense entered as income is a silent error nobody notices.
    const amount = (tx.sign === "-" ? -1 : 1) * Math.abs(num(tx.amount));
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tx, amount }),
    });
    if (!res.ok) { error = t((await res.json()).error || "Fehler beim Speichern"); return; }
    txOpen = false;
    tx = { ...tx, amount: "", merchant: "", description: "" };
    refresh();
  }

  async function saveBalance(id: string) {
    await fetch("/api/accounts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, balance: num(editBalance) }),
    });
    editing = null;
    refresh();
  }

  async function removeAccount(a: Account) {
    if (!confirm(t("„{name}“ mit allen {n} Buchungen löschen?", { name: a.name, n: a.tx_count }))) return;
    await fetch(`/api/accounts?id=${a.id}`, { method: "DELETE" });
    refresh();
  }
</script>

{#if accounts}
  <div class="flex flex-wrap items-center gap-2">
    <Button variant="secondary" size="sm" onclick={() => { error = null; open = true; }}>
      <Wallet /> {t("Konten von Hand")}
    </Button>
    <Button
      size="sm"
      disabled={manual.length === 0}
      onclick={() => { error = null; tx.account_id = tx.account_id || manual[0]?.id || ""; txOpen = true; }}
      title={manual.length === 0 ? t("Zuerst ein manuelles Konto anlegen") : undefined}
    >
      <Plus /> {t("Buchung erfassen")}
    </Button>
  </div>

  <Dialog
    bind:open
    onclose={() => { error = null; editing = null; }}
    title={t("Konten von Hand")}
    description={t("Für alles ohne Bankanbindung — Bargeld, Konten bei Banken ohne API, Sparbücher. Der Kontostand wird hier direkt gepflegt und von keinem Abruf überschrieben.")}
  >
    {#if manual.length > 0}
      <div class="mb-5 divide-y divide-line rounded-xl border border-line">
        {#each manual as a (a.id)}
          <div class="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
            <div class="min-w-0">
              <div class="truncate font-medium">{a.name}</div>
              <div class="text-[11px] text-muted">
                {a.tx_count === 1 ? t("1 Buchung") : t("{n} Buchungen", { n: a.tx_count })} · {a.currency}
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              {#if editing === a.id}
                <Input
                  class="h-8 w-28 text-right"
                  inputmode="decimal"
                  bind:value={editBalance}
                  autofocus
                  onkeydown={(e) => e.key === "Enter" && saveBalance(a.id)}
                />
                <Button variant="ghost" size="icon-sm" class="text-pos" onclick={() => saveBalance(a.id)} aria-label={t("Speichern")}><Check /></Button>
              {:else}
                <span class="num mr-1 text-sm font-medium">{fmtEUR(a.balance)}</span>
                <Button variant="ghost" size="icon-sm" title={t("Kontostand ändern")} aria-label={t("Kontostand ändern")}
                  onclick={() => { editing = a.id; editBalance = String(a.balance).replace(".", ","); }}><Pencil /></Button>
              {/if}
              <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => removeAccount(a)} aria-label={t("Löschen")}><Trash2 /></Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="space-y-4 rounded-xl bg-surface-2 p-4">
      <div class="text-xs font-semibold text-ink-2">{t("Neues Konto")}</div>
      <div class="grid grid-cols-2 gap-4">
        <Field label={t("Name")} class="col-span-2">
          <Input placeholder={t("Bargeld")} bind:value={acc.name} />
        </Field>
        <Field label={t("Währung")}>
          <Select bind:value={acc.currency} options={["EUR", "USD", "CHF", "GBP"].map((c) => ({ value: c, label: c }))} />
        </Field>
        <Field label={t("Aktueller Stand")}>
          <Input inputmode="decimal" placeholder="0,00" bind:value={acc.balance} />
        </Field>
      </div>
      {#if error}<div class="text-xs text-neg">{error}</div>{/if}
      <Button class="w-full" disabled={!acc.name.trim()} onclick={addAccount}>{t("Konto anlegen")}</Button>
    </div>
  </Dialog>

  <Dialog
    bind:open={txOpen}
    onclose={() => (error = null)}
    title={t("Buchung erfassen")}
    description={t("Die Buchung verändert den Kontostand des gewählten Kontos sofort. Nur bei manuell geführten Konten möglich.")}
  >
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <Segmented
          bind:value={tx.sign}
          class="w-full [&>button]:flex-1"
          options={[{ value: "-", label: t("Ausgabe") }, { value: "+", label: t("Einnahme") }]}
        />
      </div>
      <Field label={t("Konto")} class="col-span-2">
        <Select bind:value={tx.account_id} options={manual.map((a) => ({ value: a.id, label: a.name }))} />
      </Field>
      <Field label={t("Betrag (€)")}>
        <Input inputmode="decimal" placeholder="24,90" bind:value={tx.amount} />
      </Field>
      <Field label={t("Datum")}>
        <Input type="date" bind:value={tx.booking_date} />
      </Field>
      <Field label={t("Empfänger / Beschreibung")} class="col-span-2">
        <Input placeholder={t("z. B. Wochenmarkt")} bind:value={tx.merchant} />
      </Field>
      <Field label={t("Kategorie")} class="col-span-2">
        <Select bind:value={tx.category} options={[{ value: "", label: t("automatisch") }, ...CATEGORIES.map((c) => ({ value: c, label: t(c) }))]} />
      </Field>
    </div>
    {#if error}<div class="mt-3 text-xs text-neg">{error}</div>{/if}
    {#snippet footer()}
      <Button variant="secondary" onclick={() => (txOpen = false)}>{t("Abbrechen")}</Button>
      <Button disabled={!tx.amount.trim() || !tx.account_id} onclick={addTx}>{t("Speichern")}</Button>
    {/snippet}
  </Dialog>
{/if}
