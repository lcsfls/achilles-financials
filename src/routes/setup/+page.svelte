<script lang="ts">
  import { Sparkles, Database, KeyRound, Check } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Textarea from "$lib/components/ui/Textarea.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import AuthFrame from "$lib/components/AuthFrame.svelte";
  import { t } from "$lib/i18n";
  import { prefs, setLang, type Lang } from "$lib/prefs.svelte";
  import { COUNTRIES } from "$lib/countries";
  import { cn } from "$lib/utils";

  let step = $state(0);
  let appId = $state("");
  let privateKey = $state("");
  let country = $state("DE");
  let startMode = $state<"demo" | "empty">("demo");
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function finish() {
    busy = true;
    error = null;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: prefs.lang,
        country,
        ebAppId: appId || undefined,
        ebPrivateKey: privateKey || undefined,
        setupDone: true,
      }),
    });
    if (!res.ok) { busy = false; error = (await res.json()).error; step = 1; return; }
    if (startMode === "demo") await fetch("/api/demo", { method: "POST" });
    window.location.href = "/";
  }

  const STEPS = $derived([t("Sprache"), "Enable Banking", "Start"]);

  const choice = (on: boolean) =>
    cn(
      "cursor-pointer rounded-2xl border p-5 text-left transition-all",
      on ? "border-accent bg-accent-soft ring-3 ring-accent/15" : "border-line bg-surface hover:border-line-strong"
    );
</script>

<svelte:head><title>Setup · Achilles</title></svelte:head>

<AuthFrame width="max-w-xl">
  <!-- Step indicator -->
  <div class="mb-5 flex items-center justify-center gap-2">
    {#each STEPS as label, i (label)}
      <div class="flex items-center gap-2">
        <span
          class={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all",
            i < step ? "bg-accent-soft text-accent" : i === step ? "bg-accent text-accent-ink" : "bg-surface-3 text-faint"
          )}
          title={label}
        >
          {#if i < step}<Check class="size-3.5" />{:else}{i + 1}{/if}
        </span>
        {#if i < STEPS.length - 1}<span class={cn("h-px w-10", i < step ? "bg-accent/50" : "bg-line-strong")}></span>{/if}
      </div>
    {/each}
  </div>

  <Card class="p-7">
    {#if step === 0}
      <div class="space-y-6">
        <h2 class="text-center text-lg font-semibold">{t("Sprache wählen / Choose your language")}</h2>
        <div class="grid grid-cols-2 gap-4">
          {#each [["de", "Deutsch", "🇩🇪"], ["en", "English", "🇬🇧"]] as [code, label, flag] (code)}
            <button type="button" onclick={() => setLang(code as Lang)} class={cn(choice(prefs.lang === code), "text-center")}>
              <div class="text-3xl">{flag}</div>
              <div class="mt-2 text-sm font-medium">{label}</div>
            </button>
          {/each}
        </div>
        <Button class="w-full" onclick={() => (step = 1)}>{t("Weiter")}</Button>
      </div>
    {:else if step === 1}
      <div class="space-y-5">
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><KeyRound class="size-5" /></span>
          <div>
            <h2 class="text-lg font-semibold">{t("Bankanbindung (optional)")}</h2>
            <p class="text-xs text-muted">{t("Application-ID und Private Key aus deinem Enable-Banking-Control-Panel (enablebanking.com).")}</p>
          </div>
        </div>
        <div class="space-y-4">
          <Field label="Application ID">
            <Input placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" bind:value={appId} />
          </Field>
          <Field label={t("Private Key (.pem-Inhalt)")}>
            <Textarea rows={3} spellcheck={false} class="font-mono text-[11px]" placeholder={"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"} bind:value={privateKey} />
          </Field>
          <Field label={t("Land deiner Bank")}>
            <Select bind:value={country} options={COUNTRIES.map((c) => ({ value: c.code, label: prefs.lang === "de" ? c.de : c.en }))} />
          </Field>
        </div>
        {#if error}<Alert tone="neg">{error}</Alert>{/if}
        <p class="text-xs leading-relaxed text-muted">
          {t("Du kannst das jederzeit später in den Einstellungen nachholen — oder Kontoauszüge per CSV importieren.")}
        </p>
        <div class="flex gap-3">
          <Button variant="secondary" class="flex-1" onclick={() => (step = 0)}>{t("Zurück")}</Button>
          <Button class="flex-1" onclick={() => (step = 2)}>{appId && privateKey ? t("Weiter") : t("Überspringen")}</Button>
        </div>
      </div>
    {:else}
      <div class="space-y-6">
        <h2 class="text-center text-lg font-semibold">{t("Wie möchtest du starten?")}</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" onclick={() => (startMode = "demo")} class={choice(startMode === "demo")}>
            <Sparkles class={cn("size-6", startMode === "demo" ? "text-accent" : "text-faint")} />
            <div class="mt-3 text-sm font-semibold">{t("Mit Demo-Daten erkunden")}</div>
            <div class="mt-1 text-xs leading-relaxed text-muted">{t("Realistische Beispieldaten — jederzeit in den Einstellungen entfernbar.")}</div>
          </button>
          <button type="button" onclick={() => (startMode = "empty")} class={choice(startMode === "empty")}>
            <Database class={cn("size-6", startMode === "empty" ? "text-accent" : "text-faint")} />
            <div class="mt-3 text-sm font-semibold">{t("Leer starten")}</div>
            <div class="mt-1 text-xs leading-relaxed text-muted">{t("Direkt mit deinen echten Daten loslegen.")}</div>
          </button>
        </div>
        <div class="flex gap-3">
          <Button variant="secondary" class="flex-1" onclick={() => (step = 1)} disabled={busy}>{t("Zurück")}</Button>
          <Button class="flex-1" onclick={finish} disabled={busy}>{busy ? t("Einen Moment …") : t("Los geht's")}</Button>
        </div>
      </div>
    {/if}
  </Card>
</AuthFrame>
