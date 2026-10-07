<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, Landmark } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, fmtEUR0, fmtDate, fmtNum } from "$lib/utils";

  type Notice = {
    id: number; notice_date: string; kind: "renteninformation" | "rentenbescheid";
    disability_eur: number | null; earned_eur: number | null; projected_eur: number | null;
    points: number | null; note: string | null;
  };

  const EMPTY = () => ({
    notice_date: new Date().toISOString().slice(0, 10),
    kind: "renteninformation" as string,
    earned_eur: "", projected_eur: "", disability_eur: "", points: "", note: "",
  });

  /**
   * German statutory pension notices.
   *
   * Shown next to the private contracts but never summed with them: a monthly
   * entitlement is income, not capital. Saying so on screen matters more than
   * the numbers — adding these to net worth is the obvious mistake.
   */
  let notices = $state<Notice[] | null>(null);
  let open = $state(false);
  let form = $state(EMPTY());
  let error = $state<string | null>(null);

  const load = () => apiJson<{ notices: Notice[] }>("/api/pension/statutory").then((d) => (notices = d.notices));
  onMount(load);

  const num = (s: string) => (s.trim() ? parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0 : null);

  async function save() {
    error = null;
    const res = await fetch("/api/pension/statutory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notice_date: form.notice_date, kind: form.kind,
        earned_eur: num(form.earned_eur), projected_eur: num(form.projected_eur),
        disability_eur: num(form.disability_eur), points: num(form.points),
        note: form.note,
      }),
    });
    if (!res.ok) { error = t((await res.json()).error || "Fehler beim Speichern"); return; }
    open = false;
    form = EMPTY();
    load();
  }

  async function remove(id: number) {
    if (!confirm(t("Diesen Bescheid wirklich löschen?"))) return;
    await fetch(`/api/pension/statutory?id=${id}`, { method: "DELETE" });
    load();
  }

  const latest = $derived(notices?.[0]);
</script>

{#if notices}
  <Card>
    <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div class="flex items-center gap-3">
        <span class="flex size-9 items-center justify-center rounded-xl bg-info-soft text-info"><Landmark class="size-4.5" /></span>
        <div>
          <h3 class="text-[15px] font-semibold">{t("Gesetzliche Rente")}</h3>
          <div class="text-xs text-muted">{t("Renteninformation & Rentenbescheid")}</div>
        </div>
      </div>
      <Button variant="secondary" size="sm" onclick={() => { error = null; open = true; }}><Plus /> {t("Bescheid erfassen")}</Button>
    </div>

    <div class="space-y-4 px-5 pb-5">
      <!-- The point that keeps someone from double-counting their retirement -->
      <Alert tone="info">{t("Diese Beträge sind monatliche Ansprüche, kein Guthaben — sie fließen bewusst nicht ins Gesamtvermögen ein. Man kann eine Rente nicht verkaufen; sie ersetzt später Einkommen, statt Kapital zu sein.")}</Alert>

      {#if notices.length === 0 || !latest}
        <p class="py-4 text-center text-sm text-muted">{t("Noch kein Bescheid erfasst. Die Werte stehen auf deiner jährlichen Renteninformation der Deutschen Rentenversicherung.")}</p>
      {:else}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {#each [
            { label: t("Bisher erreicht"), value: latest.earned_eur, hint: t("ohne weitere Beiträge") },
            { label: t("Hochrechnung"), value: latest.projected_eur, hint: t("bei gleichem Beitrag") },
            { label: t("Erwerbsminderung"), value: latest.disability_eur, hint: t("volle Erwerbsminderung") },
          ] as k (k.label)}
            <div class="rounded-xl bg-surface-2 p-4">
              <div class="text-xs text-muted">{k.label}</div>
              <div class="num mt-1 text-xl font-semibold">
                {k.value != null ? fmtEUR0(k.value) : "—"}{#if k.value != null}<span class="text-xs font-normal text-muted">{t("/Monat")}</span>{/if}
              </div>
              <div class="mt-0.5 text-[11px] text-faint">{k.hint}</div>
            </div>
          {/each}
        </div>

        <div class="divide-y divide-line rounded-xl border border-line">
          {#each notices as n (n.id)}
            <div class="flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
              <div class="min-w-0">
                <span>{fmtDate(n.notice_date)}</span>
                <span class="ml-2 text-xs text-muted">
                  {n.kind === "rentenbescheid" ? t("Rentenbescheid") : t("Renteninformation")}{n.points != null ? ` · ${fmtNum(n.points)} ${t("Entgeltpunkte")}` : ""}
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="num text-xs text-ink-2">{n.projected_eur != null ? `${fmtEUR0(n.projected_eur)}${t("/Monat")}` : "—"}</span>
                <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(n.id)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Card>

  <Dialog
    bind:open
    onclose={() => (error = null)}
    title={t("Bescheid erfassen")}
    description={t("Die Werte stehen auf der Renteninformation der Deutschen Rentenversicherung. Alle Felder außer dem Datum sind optional.")}
  >
    <div class="grid grid-cols-2 gap-4">
      <Field label={t("Datum des Bescheids")}><Input type="date" bind:value={form.notice_date} /></Field>
      <Field label={t("Art")}>
        <Select bind:value={form.kind} options={[{ value: "renteninformation", label: t("Renteninformation") }, { value: "rentenbescheid", label: t("Rentenbescheid") }]} />
      </Field>
      <Field label={t("Bisher erreichte Rente (€/Monat)")}><Input inputmode="decimal" placeholder="842,15" bind:value={form.earned_eur} /></Field>
      <Field label={t("Hochgerechnete Rente (€/Monat)")}><Input inputmode="decimal" placeholder="1.640,00" bind:value={form.projected_eur} /></Field>
      <Field label={t("Volle Erwerbsminderung (€/Monat)")}><Input inputmode="decimal" placeholder="1.120,00" bind:value={form.disability_eur} /></Field>
      <Field label={t("Entgeltpunkte")}><Input inputmode="decimal" placeholder="24,5" bind:value={form.points} /></Field>
      <Field label={t("Notiz (optional)")} class="col-span-2"><Input bind:value={form.note} /></Field>
    </div>
    {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
    {#snippet footer()}
      <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
      <Button onclick={save}>{t("Speichern")}</Button>
    {/snippet}
  </Dialog>
{/if}
