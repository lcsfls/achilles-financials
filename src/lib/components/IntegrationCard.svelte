<script lang="ts" module>
  export type Requirement = { kind: "need" | "warn" | "good"; text: string };
</script>

<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { Check, X, ExternalLink } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Switch from "$lib/components/ui/Switch.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { t } from "$lib/i18n";
  import { cn } from "$lib/utils";

  /**
   * Integration tile with a switch.
   *
   * Turning it on first shows the requirements: both routes have hard
   * prerequisites (a public HTTPS domain or a product registration) that you
   * need to know before entering credentials — not once the bank refuses.
   */
  let {
    icon: Icon, title, subtitle, enabled, configured, requirements, docsUrl, docsLabel,
    ontoggle, children, accent = "var(--accent)",
  }: {
    icon: Component<{ class?: string }>;
    title: string;
    subtitle: string;
    enabled: boolean;
    configured: boolean;
    requirements: Requirement[];
    docsUrl?: string;
    docsLabel?: string;
    ontoggle: (on: boolean) => void | Promise<void>;
    children?: Snippet;
    accent?: string;
  } = $props();

  let confirmOpen = $state(false);
  let busy = $state(false);

  async function apply(on: boolean) {
    busy = true;
    await ontoggle(on);
    busy = false;
    confirmOpen = false;
  }

  const TONE = { need: "warn", warn: "info", good: "pos" } as const;
</script>

<Card class={cn("transition-opacity", !enabled && "opacity-80")}>
  <div class="flex items-center justify-between gap-3 px-5 py-4">
    <div class="flex min-w-0 items-center gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-xl" style="background: color-mix(in srgb, {accent} 13%, transparent); color: {accent}">
        <Icon class="size-4.5" />
      </span>
      <div class="min-w-0">
        <h3 class="truncate text-[15px] font-semibold">{title}</h3>
        <div class="truncate text-xs text-muted">{subtitle}</div>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2.5">
      {#if enabled}
        {#if configured}<Badge tone="pos"><Check class="size-3" /> {t("Bereit")}</Badge>{:else}<Badge tone="warn">{t("Einrichten")}</Badge>{/if}
      {/if}
      <Switch
        checked={enabled}
        disabled={busy}
        label={enabled ? t("Deaktivieren") : t("Aktivieren")}
        onchange={() => (enabled ? apply(false) : (confirmOpen = true))}
      />
    </div>
  </div>

  {#if enabled && children}
    <div class="space-y-4 border-t border-line px-5 py-5">{@render children()}</div>
  {:else if !enabled}
    <ul class="space-y-1.5 border-t border-line px-5 py-4">
      {#each requirements.slice(0, 3) as r, i (i)}
        <li class="flex gap-2 text-xs leading-relaxed text-muted">
          <span class={cn("mt-1.5 size-1.5 shrink-0 rounded-full", r.kind === "need" ? "bg-warn" : r.kind === "warn" ? "bg-info" : "bg-pos")}></span>
          <span>{r.text}</span>
        </li>
      {/each}
    </ul>
  {/if}
</Card>

<Dialog bind:open={confirmOpen} title={t("{name} aktivieren", { name: title })} description={t("Was du dafür brauchst — bitte vorher lesen:")}>
  <div class="space-y-2.5">
    {#each requirements as r, i (i)}
      <Alert tone={TONE[r.kind]}>{r.text}</Alert>
    {/each}
    {#if docsUrl}
      <a href={docsUrl} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-accent hover:underline">
        {docsLabel ?? t("Zur Dokumentation")} <ExternalLink class="size-3" />
      </a>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (confirmOpen = false)} disabled={busy}><X /> {t("Abbrechen")}</Button>
    <Button onclick={() => apply(true)} disabled={busy}><Check /> {busy ? t("Aktiviere …") : t("Verstanden, aktivieren")}</Button>
  {/snippet}
</Dialog>
