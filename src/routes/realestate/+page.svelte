<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, Home, MapPin, ImagePlus, Pencil, CalendarClock, Ruler } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, fmtEUR0, fmtNum, fmtDate, fmtPct } from "$lib/utils";

  type Property = {
    id: number; label: string; address: string | null; value_eur: number;
    value_source: string | null; valued_on: string | null;
    purchase_price_eur: number | null; purchase_date: string | null;
    size_sqm: number | null; share_pct: number; note: string | null; created_at: string;
    photoIds: number[]; myValue: number; myPurchase: number | null; gain: number | null; gainPct: number | null;
  };
  type Data = { properties: Property[]; total: number };

  const EMPTY = () => ({
    label: "", address: "", value_eur: "", value_source: "",
    valued_on: new Date().toISOString().slice(0, 10),
    purchase_price_eur: "", purchase_date: "", size_sqm: "", share_pct: "100", note: "",
  });

  /**
   * Downscale in the browser before upload.
   *
   * Photos are stored in the database so the encrypted backup genuinely
   * contains them — which only stays affordable if they aren't 5 MB phone
   * originals. 1600px on the long edge is plenty for a tile and a lightbox.
   */
  async function shrink(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000) return file; // already small enough
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
  }

  let data = $state<Data | null>(null);
  let open = $state(false);
  let form = $state(EMPTY());
  let error = $state<string | null>(null);
  let editing = $state<Property | null>(null);
  let editOpen = $state(false);
  let edit = $state({ label: "", address: "", value_eur: "", value_source: "", valued_on: "", share_pct: "" });
  let uploadFor: number | null = null;
  let lightbox = $state<number | null>(null);
  let lightboxOpen = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  // Returns the fresh data so callers can also refresh a copy they are holding
  const load = () => apiJson<Data>("/api/properties").then((d) => { data = d; return d; });
  onMount(load);

  // German input: 350.000,50 → 350000.50
  const num = (s: string) => (s.trim() === "" ? "" : parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);

  async function submit() {
    error = null;
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        value_eur: num(form.value_eur),
        purchase_price_eur: num(form.purchase_price_eur),
        size_sqm: num(form.size_sqm),
        share_pct: form.share_pct === "" ? 100 : num(form.share_pct),
      }),
    });
    if (!res.ok) { error = t((await res.json()).error); return; }
    open = false;
    form = EMPTY();
    load();
  }

  function openEdit(p: Property) {
    editing = p;
    error = null;
    edit = {
      label: p.label, address: p.address ?? "", value_eur: String(p.value_eur).replace(".", ","),
      value_source: p.value_source ?? "", valued_on: p.valued_on ?? new Date().toISOString().slice(0, 10),
      share_pct: String(p.share_pct ?? 100).replace(".", ","),
    };
    editOpen = true;
  }

  async function saveValue() {
    if (!editing) return;
    const res = await fetch("/api/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id, label: edit.label, address: edit.address, value_eur: num(edit.value_eur),
        value_source: edit.value_source, valued_on: edit.valued_on, share_pct: edit.share_pct === "" ? undefined : num(edit.share_pct),
      }),
    });
    if (!res.ok) { error = t((await res.json()).error); return; }
    editOpen = false;
    load();
  }

  async function upload(propertyId: number, files: FileList) {
    for (const file of Array.from(files)) {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("propertyId", String(propertyId));
      fd.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
      const res = await fetch("/api/properties/photo", { method: "POST", body: fd });
      if (!res.ok) { error = t((await res.json()).error); break; }
    }
    const fresh = await load();
    // The edit dialog renders its own copy of the property — refresh it too.
    if (editing) editing = fresh.properties.find((p) => p.id === editing?.id) ?? editing;
  }

  async function removePhoto(id: number) {
    await fetch(`/api/properties/photo?id=${id}`, { method: "DELETE" });
    load();
  }

  async function remove(p: Property) {
    if (!confirm(t("„{name}“ mit allen Fotos löschen?", { name: p.label }))) return;
    await fetch(`/api/properties?id=${p.id}`, { method: "DELETE" });
    load();
  }

  function pickPhotos(id: number) {
    uploadFor = id;
    fileInput?.click();
  }

  const lightboxOwner = $derived(lightbox !== null ? data?.properties.find((p) => p.photoIds.includes(lightbox!)) : undefined);
</script>

<svelte:head><title>{t("Immobilien")} · Achilles</title></svelte:head>

<!-- Hidden picker, shared by every tile -->
<input
  bind:this={fileInput}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  multiple
  class="hidden"
  onchange={(e) => {
    const el = e.currentTarget;
    if (uploadFor && el.files?.length) upload(uploadFor, el.files);
    el.value = "";
  }}
/>

{#if !data}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader
      title={t("Immobilien")}
      subtitle={data.properties.length === 0
        ? t("Adresse, Wert und Fotos — der Wert wird von Hand gepflegt.")
        : `${t("{n} Objekte", { n: data.properties.length })} · ${fmtEUR0(data.total)}`}
    >
      {#snippet actions()}
        <Button size="sm" onclick={() => { error = null; open = true; }}><Plus /> {t("Immobilie erfassen")}</Button>
      {/snippet}
    </PageHeader>

    {#if data.properties.length === 0}
      <Card>
        <EmptyState icon={Home} title={t("Immobilien")} text={t("Noch nichts erfasst. Trage eine Immobilie mit Adresse und Wert ein — Fotos kannst du danach hinzufügen.")}>
          <Button size="sm" onclick={() => (open = true)}><Plus /> {t("Immobilie erfassen")}</Button>
        </EmptyState>
      </Card>
    {:else}
      <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {#each data.properties as p (p.id)}
          <Card class="group overflow-hidden">
            {#if p.photoIds.length > 0}
              <button type="button" onclick={() => { lightbox = p.photoIds[0]; lightboxOpen = true; }} class="relative block h-44 w-full cursor-pointer overflow-hidden" title={t("Foto ansehen")}>
                <img src="/api/properties/photo?id={p.photoIds[0]}" alt={p.label} class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                {#if p.photoIds.length > 1}
                  <span class="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] text-white">+{p.photoIds.length - 1}</span>
                {/if}
              </button>
            {:else}
              <button type="button" onclick={() => pickPhotos(p.id)} class="flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-1.5 bg-surface-2 text-faint transition-colors hover:text-ink-2">
                <ImagePlus class="size-6" />
                <span class="text-xs">{t("Foto hinzufügen")}</span>
              </button>
            {/if}

            <div class="p-5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate text-[15px] font-semibold">{p.label}</div>
                  {#if p.address}
                    <div class="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin class="size-3 shrink-0" /><span class="truncate">{p.address}</span></div>
                  {/if}
                </div>
                <div class="-mr-1.5 -mt-1 flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
                  <Button variant="ghost" size="icon-sm" onclick={() => pickPhotos(p.id)} title={t("Foto hinzufügen")} aria-label={t("Foto hinzufügen")}><ImagePlus /></Button>
                  <Button variant="ghost" size="icon-sm" onclick={() => openEdit(p)} title={t("Wert aktualisieren")} aria-label={t("Wert aktualisieren")}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" class="hover:text-neg" onclick={() => remove(p)} title={t("Löschen")} aria-label={t("Löschen")}><Trash2 /></Button>
                </div>
              </div>

              <div class="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div class="text-xs text-muted">{t("Wert")}</div>
                  <div class="num text-2xl font-semibold tracking-tight">{fmtEUR0(p.myValue)}</div>
                  {#if p.share_pct < 100}
                    <!-- Say both numbers — otherwise a halved figure looks wrong -->
                    <div class="mt-0.5 text-[11px] text-muted">{t("{share} % von {full}", { share: fmtNum(p.share_pct, 0), full: fmtEUR0(p.value_eur) })}</div>
                  {/if}
                </div>
                {#if p.gain !== null && p.gainPct !== null}
                  <div class="text-right text-xs">
                    <div class={cn("num font-semibold", p.gain >= 0 ? "text-pos" : "text-neg")}>{p.gain >= 0 ? "+" : ""}{fmtEUR0(p.gain)}</div>
                    <div class="text-muted">{fmtPct(p.gainPct)} {t("seit Kauf")}</div>
                  </div>
                {/if}
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[11px] text-muted">
                {#if p.size_sqm}
                  <span class="flex items-center gap-1"><Ruler class="size-3" />{p.size_sqm} m²</span>
                  <span class="num">{fmtEUR0(p.value_eur / p.size_sqm)}/m²</span>
                {/if}
                {#if p.share_pct < 100}<span class="num font-medium text-accent">{fmtNum(p.share_pct, 0)} %</span>{/if}
                {#if p.valued_on}
                  <span class="flex items-center gap-1"><CalendarClock class="size-3" />{t("Wert vom {date}", { date: fmtDate(p.valued_on) })}</span>
                {/if}
              </div>
              <!-- Naming the source keeps a hand-entered number honest -->
              {#if p.value_source}<div class="mt-1 text-[11px] text-muted">{t("Quelle: {src}", { src: p.value_source })}</div>{/if}
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<Dialog
  bind:open
  title={t("Immobilie erfassen")}
  description={t("Den Wert trägst du selbst ein — eine automatische Marktbewertung bräuchte einen kostenpflichtigen Dienst, und amtliche Bodenrichtwerte bewerten nur den Boden, nicht das Gebäude. Notiere daher, woher deine Zahl stammt.")}
>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Bezeichnung")} class="col-span-2"><Input placeholder={t("Wohnung Berlin")} bind:value={form.label} /></Field>
    <Field label={t("Adresse (optional)")} class="col-span-2"><Input placeholder="Musterstraße 1, 10115 Berlin" bind:value={form.address} /></Field>
    <Field label={t("Aktueller Wert (€)")}><Input inputmode="decimal" placeholder="350.000" bind:value={form.value_eur} /></Field>
    <Field label={t("Woher stammt der Wert?")}><Input placeholder={t("Gutachten, Portal, Schätzung …")} bind:value={form.value_source} /></Field>
    <Field label={t("Kaufpreis (€, optional)")}><Input inputmode="decimal" placeholder="290.000" bind:value={form.purchase_price_eur} /></Field>
    <Field label={t("Kaufdatum (optional)")}><Input type="date" bind:value={form.purchase_date} /></Field>
    <Field label={t("Wohnfläche m² (optional)")}><Input inputmode="decimal" placeholder="82" bind:value={form.size_sqm} /></Field>
    <Field label={t("Wert vom")}><Input type="date" bind:value={form.valued_on} /></Field>
    <Field label={t("Dein Anteil in %")} class="col-span-2" hint={t("Gehört dir nur ein Teil, trage ihn hier ein — Wert, Gewinn und Gesamtvermögen zählen dann nur deinen Anteil. 100 % = alleiniges Eigentum.")}>
      <Input inputmode="decimal" placeholder="100" bind:value={form.share_pct} />
    </Field>
    <Field label={t("Notiz (optional)")} class="col-span-2"><Input bind:value={form.note} /></Field>
  </div>
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t("Abbrechen")}</Button>
    <Button onclick={submit}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={editOpen}
  onclose={() => (editing = null)}
  title={t("Immobilie bearbeiten")}
  description={t("Ein Immobilienwert altert. Halte fest, wann und woher — das unterscheidet eine gepflegte Zahl von einer geratenen.")}
>
  <div class="grid grid-cols-2 gap-4">
    <Field label={t("Bezeichnung")} class="col-span-2"><Input bind:value={edit.label} /></Field>
    <Field label={t("Adresse")} class="col-span-2"><Input bind:value={edit.address} /></Field>
    <Field label={t("Aktueller Wert (€)")}><Input inputmode="decimal" bind:value={edit.value_eur} /></Field>
    <Field label={t("Wert vom")}><Input type="date" bind:value={edit.valued_on} /></Field>
    <Field label={t("Woher stammt der Wert?")}><Input bind:value={edit.value_source} /></Field>
    <Field label={t("Dein Anteil in %")}><Input inputmode="decimal" bind:value={edit.share_pct} /></Field>
  </div>

  <!-- Photos, managed where everything else about the property is edited -->
  <div class="mt-5">
    <div class="mb-1.5 text-xs font-medium text-ink-2">{t("Fotos")}</div>
    <div class="flex flex-wrap gap-2">
      {#each editing?.photoIds ?? [] as pid (pid)}
        <div class="relative size-20 overflow-hidden rounded-lg border border-line">
          <img src="/api/properties/photo?id={pid}" alt="" class="h-full w-full object-cover" />
          <button
            type="button"
            onclick={async () => {
              if (!confirm(t("Dieses Foto wirklich löschen?"))) return;
              await removePhoto(pid);
              if (editing) editing = { ...editing, photoIds: editing.photoIds.filter((x) => x !== pid) };
            }}
            class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/55 opacity-0 transition-opacity hover:opacity-100"
            title={t("Foto löschen")}
          >
            <Trash2 class="size-4 text-white" />
          </button>
        </div>
      {/each}
      <button
        type="button"
        onclick={() => editing && pickPhotos(editing.id)}
        class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-faint transition-colors hover:text-ink"
      >
        <ImagePlus class="size-4" /><span class="text-[10px]">{t("Hinzufügen")}</span>
      </button>
    </div>
  </div>
  {#if error}<Alert tone="neg" class="mt-3">{error}</Alert>{/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (editOpen = false)}>{t("Abbrechen")}</Button>
    <Button onclick={saveValue}>{t("Speichern")}</Button>
  {/snippet}
</Dialog>

<!-- Photo viewer with the other shots of the same property -->
<Dialog bind:open={lightboxOpen} onclose={() => (lightbox = null)} title={lightboxOwner?.label ?? t("Foto")} class="max-w-3xl">
  {#if lightbox !== null}
    <img src="/api/properties/photo?id={lightbox}" alt="" class="max-h-[65vh] w-full rounded-xl object-contain" />
    {#if lightboxOwner && lightboxOwner.photoIds.length > 1}
      <div class="mt-3 flex flex-wrap gap-2">
        {#each lightboxOwner.photoIds as id (id)}
          <button type="button" onclick={() => (lightbox = id)} class={cn("h-14 w-20 cursor-pointer overflow-hidden rounded-lg border-2 transition-all", id === lightbox ? "border-accent" : "border-transparent opacity-70 hover:opacity-100")}>
            <img src="/api/properties/photo?id={id}" alt="" class="h-full w-full object-cover" />
          </button>
        {/each}
      </div>
    {/if}
  {/if}
  {#snippet footer()}
    <Button variant="danger" size="sm" onclick={async () => { if (lightbox !== null) await removePhoto(lightbox); lightboxOpen = false; }}><Trash2 /> {t("Foto löschen")}</Button>
  {/snippet}
</Dialog>
