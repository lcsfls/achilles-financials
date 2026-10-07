<script lang="ts">
  import { onMount } from "svelte";
  import { Trash2, Info, Save, Pencil, X } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR0, fmtNum, fmtDate } from "$lib/utils";
  import { valuate, DEFAULT_MULTIPLE, type BusinessInput, type Valuation } from "$lib/business";

  type Saved = {
    id: number; label: string; kind: "own" | "target"; note: string | null;
    created_at: string; inputs: BusinessInput; result: Valuation;
  };

  const EMPTY = (): BusinessInput => ({
    revenue: 0, ebitda: 0, assets: 0, netDebt: 0,
    ownerDependency: "medium", employees: "1-4", secondLevel: false,
    concentration: "medium", recurring: "medium", growth: "flat", documented: false,
  });

  /** Labels for the drivers, so the result explains itself. */
  const DRIVER_LABEL: Record<string, string> = {
    ownerDependency: "Inhaberabhängigkeit",
    employees: "Mitarbeitende",
    secondLevel: "Zweite Führungsebene",
    concentration: "Kundenkonzentration",
    recurring: "Wiederkehrende Umsätze",
    growth: "Entwicklung",
    documented: "Dokumentierte Prozesse",
    size: "Größenklasse",
  };

  let saved = $state<Saved[] | null>(null);
  let form = $state<BusinessInput>(EMPTY());
  let label = $state("");
  let kind = $state("own");
  let editId = $state<number | null>(null);
  let error = $state<string | null>(null);
  let methodOpen = $state(false);
  let raw = $state({ revenue: "", ebitda: "", assets: "", netDebt: "" });

  const load = () => apiJson<{ businesses: Saved[] }>("/api/businesses").then((d) => (saved = d.businesses));
  onMount(load);

  // German input: 1.234.567,89
  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

  const current = $derived<BusinessInput>({
    ...form,
    revenue: num(raw.revenue),
    ebitda: num(raw.ebitda),
    assets: num(raw.assets),
    netDebt: num(raw.netDebt),
  });
  // Recalculated on every keystroke — the point is to see what each answer does.
  const result = $derived(valuate(current));

  async function save() {
    error = null;
    if (!label.trim()) { error = t("Bezeichnung erforderlich"); return; }
    const body = { id: editId ?? undefined, label, kind, inputs: $state.snapshot(current) };
    const res = await fetch("/api/businesses", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { error = t((await res.json()).error); return; }
    editId = null;
    label = "";
    load();
  }

  function edit(b: Saved) {
    form = { ...b.inputs };
    raw = {
      revenue: String(b.inputs.revenue).replace(".", ","),
      ebitda: String(b.inputs.ebitda).replace(".", ","),
      assets: String(b.inputs.assets).replace(".", ","),
      netDebt: String(b.inputs.netDebt).replace(".", ","),
    };
    label = b.label;
    kind = b.kind;
    editId = b.id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(b: Saved) {
    if (!confirm(t("„{name}“ löschen?", { name: b.label }))) return;
    await fetch(`/api/businesses?id=${b.id}`, { method: "DELETE" });
    if (editId === b.id) { editId = null; label = ""; }
    load();
  }

  const CHOICES = $derived([
    { key: "ownerDependency", label: t("Ohne dich läuft …"), options: [
      ["critical", t("gar nichts — alles hängt an mir")], ["high", t("wenig — ich bin täglich nötig")],
      ["medium", t("einiges — für Wochen ginge es")], ["low", t("alles — Führung ist eingesetzt")],
    ] },
    { key: "employees", label: t("Mitarbeitende"), options: [["none", t("keine — Einzelunternehmen")], ["1-4", "1–4"], ["5-19", "5–19"], ["20+", "20+"]] },
    { key: "concentration", label: t("Größter Kunde"), options: [["high", t("über 50 % vom Umsatz")], ["medium", t("20–50 %")], ["low", t("unter 20 %")]] },
    { key: "recurring", label: t("Wiederkehrende Umsätze"), options: [["low", t("kaum — Projektgeschäft")], ["medium", t("teilweise")], ["high", t("überwiegend — Verträge, Abos")]] },
    { key: "growth", label: t("Entwicklung"), options: [["shrinking", t("rückläufig")], ["flat", t("stabil")], ["growing", t("wachsend")]] },
  ] as Array<{ key: "ownerDependency" | "employees" | "concentration" | "recurring" | "growth"; label: string; options: string[][] }>);

  const NUMBERS = $derived([
    { key: "revenue", label: t("Jahresumsatz (€)"), ph: "1.200.000" },
    { key: "ebitda", label: t("EBITDA bereinigt (€)"), ph: "180.000" },
    { key: "assets", label: t("Vermögen (€)"), ph: "150.000" },
    { key: "netDebt", label: t("Nettoverschuldung (€)"), ph: "50.000" },
  ] as Array<{ key: "revenue" | "ebitda" | "assets" | "netDebt"; label: string; ph: string }>);
</script>

<svelte:head><title>{t("Unternehmenswert")} · Achilles</title></svelte:head>

<div class="rise space-y-6">
  <PageHeader
    title={t("Unternehmenswert")}
    subtitle={t("Eine Orientierungs-Bandbreite für dein eigenes Unternehmen oder einen Kaufkandidaten — nach dem Multiplikatorverfahren, wie es im Mittelstand üblich ist.")}
  >
    {#snippet actions()}
      <Button variant="secondary" size="sm" onclick={() => (methodOpen = true)}><Info /> {t("Methode")}</Button>
    {/snippet}
  </PageHeader>

  <div class="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
    <Card class="p-5">
      <h3 class="text-[15px] font-semibold">{t("Zahlen")}</h3>
      <div class="mt-4 grid grid-cols-2 gap-4">
        {#each NUMBERS as n (n.key)}
          <Field label={n.label}><Input inputmode="decimal" placeholder={n.ph} bind:value={raw[n.key]} /></Field>
        {/each}
      </div>
      <p class="mt-2 text-xs leading-relaxed text-muted">
        {t("Bereinigt heißt: ein marktübliches Geschäftsführergehalt ist abgezogen, private und einmalige Posten sind heraus. Nettoverschuldung = Schulden minus Kasse; sie mindert, was beim Verkauf bei dir ankommt.")}
      </p>

      <div class="my-5 border-t border-line"></div>
      <h3 class="text-[15px] font-semibold">{t("Läuft es ohne dich?")}</h3>
      <p class="mt-1 text-xs leading-relaxed text-muted">{t("Das ist bei kleinen Unternehmen der größte Werthebel — größer als die Branche.")}</p>

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {#each CHOICES as c (c.key)}
          <Field label={c.label}>
            <Select
              value={String(form[c.key])}
              onchange={(v) => ((form as Record<string, unknown>)[c.key] = v)}
              options={c.options.map(([v, l]) => ({ value: v, label: l }))}
            />
          </Field>
        {/each}
        <div>
          <div class="mb-1.5 text-xs font-medium text-ink-2">{t("Übergabefähigkeit")}</div>
          <div class="flex gap-2">
            {#each [["secondLevel", t("2. Ebene")], ["documented", t("Prozesse dok.")]] as [k, l] (k)}
              {@const key = k as "secondLevel" | "documented"}
              <button
                type="button"
                onclick={() => (form[key] = !form[key])}
                class={cn(
                  "h-9.5 flex-1 cursor-pointer rounded-xl border px-3 text-xs font-medium transition-all",
                  form[key] ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-line-strong"
                )}
              >
                {l}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </Card>

    <Card class="p-5 lg:sticky lg:top-6">
      <h3 class="text-[15px] font-semibold">{t("Ergebnis")}</h3>
      {#if current.ebitda <= 0}
        <p class="mt-6 text-sm text-muted">{t("Trage Umsatz und bereinigtes EBITDA ein — ohne Ertrag lässt sich kein Ertragswert bilden.")}</p>
      {:else}
        <div class="mt-4 rounded-xl bg-accent-soft p-4">
          <div class="text-xs text-muted">{t("Bandbreite (Eigenkapitalwert)")}</div>
          <div class="num mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink">
            {fmtEUR0(Math.max(0, result.equityLow))} – {fmtEUR0(Math.max(0, result.equityHigh))}
          </div>
          <div class="mt-1 text-xs text-ink-2">{t("Mittelwert {mid} · {mult}× EBITDA", { mid: fmtEUR0(result.equityMid), mult: fmtNum(result.multiple, 1) })}</div>
        </div>

        <!-- The most honest part of the calculator -->
        {#if result.ownerBound}
          <Alert tone="warn" class="mt-4">{t("Ohne dich läuft nichts, und es gibt niemanden, der übernehmen könnte. Für einen Käufer ist der Ertrag dann nicht übertragbar — realistisch verkaufst du eher die Substanz als das Unternehmen. Wer den Wert heben will, fängt genau hier an: jemanden aufbauen, Prozesse dokumentieren.")}</Alert>
        {/if}
        {#if result.onFloor && !result.ownerBound}
          <Alert tone="info" class="mt-4">{t("Der Ertragswert liegt unter dem Substanzwert von {v}. Ein Käufer zahlt kaum weniger als das, was er beim Weiterverkauf der Vermögenswerte bekäme.", { v: fmtEUR0(result.assetFloor) })}</Alert>
        {/if}

        <div class="mt-5 text-xs font-medium text-muted">{t("Was den Multiplikator bewegt")}</div>
        <div class="mt-2 space-y-2">
          {#each [...result.drivers].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)) as d (d.key)}
            {@const pct = Math.round(d.effect * 100)}
            <div class="flex items-center gap-3 text-xs">
              <span class="w-40 shrink-0 truncate text-ink-2">{t(DRIVER_LABEL[d.key] ?? d.key)}</span>
              <div class="relative h-1.5 flex-1 rounded-full bg-surface-3">
                <div class="absolute top-0 h-full w-px bg-line-strong" style="left: 50%"></div>
                <div
                  class={cn("absolute top-0 h-full rounded-full", pct >= 0 ? "bg-pos" : "bg-neg")}
                  style="left: {pct >= 0 ? 50 : 50 + Math.max(-50, pct)}%; width: {Math.min(50, Math.abs(pct))}%"
                ></div>
              </div>
              <span class={cn("num w-12 text-right font-semibold", pct > 0 ? "text-pos" : pct < 0 ? "text-neg" : "text-faint")}>{pct > 0 ? "+" : ""}{pct} %</span>
            </div>
          {/each}
        </div>

        <div class="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-5">
          <Field label={t("Speichern als")} class="min-w-[140px] flex-1"><Input placeholder={t("Meine GmbH")} bind:value={label} /></Field>
          <Select bind:value={kind} class="w-36" options={[{ value: "own", label: t("eigenes") }, { value: "target", label: t("Kaufkandidat") }]} />
          <Button onclick={save}><Save /> {editId ? t("Aktualisieren") : t("Speichern")}</Button>
          {#if editId !== null}
            <Button variant="secondary" size="icon" onclick={() => { editId = null; label = ""; }} title={t("Bearbeiten abbrechen")} aria-label={t("Bearbeiten abbrechen")}><X /></Button>
          {/if}
        </div>
        {#if error}<div class="mt-2 text-xs text-neg">{error}</div>{/if}
      {/if}
    </Card>
  </div>

  {#if saved && saved.length > 0}
    <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
      {#each saved as b (b.id)}
        <Card class={cn("group p-5", editId === b.id && "border-accent ring-3 ring-accent/15")}>
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">{b.label}</div>
              <div class="mt-1 flex items-center gap-1">
                <Badge tone={b.kind === "own" ? "pos" : "info"}>{b.kind === "own" ? t("eigenes") : t("Kaufkandidat")}</Badge>
                {#if b.result.ownerBound}<Badge tone="warn">{t("inhabergebunden")}</Badge>{/if}
              </div>
            </div>
            <div class="-mr-1.5 -mt-1 flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
              <Button variant="ghost" size="icon-sm" onclick={() => edit(b)} title={t("Bearbeiten")} aria-label={t("Bearbeiten")}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(b)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
            </div>
          </div>
          <div class="num mt-3 text-xl font-semibold tracking-tight">{fmtEUR0(Math.max(0, b.result.equityLow))} – {fmtEUR0(Math.max(0, b.result.equityHigh))}</div>
          <div class="mt-1 text-xs text-muted">{t("{mult}× EBITDA · erfasst {date}", { mult: fmtNum(b.result.multiple, 1), date: fmtDate(b.created_at) })}</div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<Dialog
  bind:open={methodOpen}
  title={t("Wie gerechnet wird")}
  description={t("Multiplikatorverfahren: bereinigtes EBITDA × Multiplikator, abzüglich Nettoverschuldung. Der Multiplikator startet beim Branchendurchschnitt und wird durch deine Antworten angepasst.")}
  class="max-w-2xl"
>
  <div class="space-y-3 text-[13px] leading-relaxed text-ink-2">
    <p>{t("Der Ausgangswert von {m}× ist der branchenübergreifende Mittelstands-Durchschnitt (DUB KMU-Multiples Q1/2026); der übliche Korridor liegt bei 4,1–7,3×.", { m: String(DEFAULT_MULTIPLE) })}</p>
    <p>{t("Kleinstunternehmen erzielen 30–50 % niedrigere Multiplikatoren als größere Betriebe derselben Branche — das ist als Größenabschlag hinterlegt.")}</p>
    <p>{t("Die Inhaberabhängigkeit wiegt am schwersten. Der AWH-Standard des Handwerks bildet sie mit Kapitalisierungszinsen von 15–25 % ab, was Multiplikatoren von nur 4–6,7× entspricht — noch bevor andere Risiken einfließen.")}</p>
    <Alert tone="warn">{t("Das ist eine Orientierung, kein Gutachten und keine Anlageberatung. Ein tatsächlicher Preis hängt von Verhandlung, Käufertyp, Finanzierung und Due Diligence ab. Für eine belastbare Bewertung — etwa für Nachfolge, Finanzierung oder Steuer — brauchst du eine Fachperson.")}</Alert>
  </div>
</Dialog>
