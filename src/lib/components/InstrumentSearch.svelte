<script lang="ts">
  import { Search, Loader2 } from "@lucide/svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { t } from "$lib/i18n";
  import { cn } from "$lib/utils";
  import { isIsin, type Hit } from "$lib/search";

  /**
   * Search field for instruments, by name, ticker or ISIN.
   *
   * ISIN is what a European fact sheet actually prints — the Yahoo ticker rarely
   * appears anywhere the user would look. Typing IE00BK5BQT80 has to work; the
   * ticker is then resolved here rather than looked up by hand.
   */
  let {
    value = $bindable(""),
    onpick,
    onsubmit,
    placeholder,
    class: klass = "",
    inputClass = "",
    compact = false,
  }: {
    value?: string;
    /** Called with the resolved ticker when a hit is chosen. */
    onpick: (symbol: string) => void;
    /** Enter without a selected hit — take the raw input as a ticker. */
    onsubmit?: () => void;
    placeholder?: string;
    class?: string;
    inputClass?: string;
    /** Denser layout for inline use next to other small fields. */
    compact?: boolean;
  } = $props();

  let hits = $state<Hit[]>([]);
  let loading = $state(false);
  let open = $state(false);
  let active = $state(0);
  let box: HTMLDivElement | undefined = $state();
  /*
   * The value a pick just wrote into the field. Choosing a hit sets the input
   * to the resolved ticker, which is a value change like any other and would
   * immediately fire a fresh search — reopening the list the pick just closed.
   */
  let picked: string | null = null;

  $effect(() => {
    const q = value.trim();
    if (q.length < 2) { hits = []; loading = false; return; }
    // Do not search for what a pick just filled in
    if (picked === q) { loading = false; return; }

    // Debounced, and every response checks whether it is still the current
    // query — otherwise a slow early request can overwrite a newer result.
    let current = true;
    loading = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { hits?: Hit[] };
        if (!current) return;
        hits = data.hits ?? [];
        active = 0;
        open = true;
      } catch {
        if (current) hits = [];
      } finally {
        if (current) loading = false;
      }
    }, 280);
    return () => { current = false; clearTimeout(timer); };
  });

  function pick(hit: Hit) {
    picked = hit.symbol;
    open = false;
    hits = [];
    loading = false;
    onpick(hit.symbol);
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open || hits.length === 0) {
      if (e.key === "Enter") onsubmit?.();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % hits.length; }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + hits.length) % hits.length; }
    else if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") open = false;
  }

  const looksLikeIsin = $derived(isIsin(value));
</script>

<!-- Close on an outside click — the list overlays the content below it -->
<svelte:document onmousedown={(e) => { if (box && !box.contains(e.target as Node)) open = false; }} />

<div bind:this={box} class={cn("relative", klass)}>
  <div class="relative">
    <Search class={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint", compact ? "left-2.5 size-3.5" : "left-3 size-4")} />
    <Input
      class={cn(compact ? "h-8.5 pl-8 text-[13px]" : "pl-9", inputClass)}
      placeholder={placeholder ?? t("Name, Symbol oder ISIN — z. B. VWCE.DE oder IE00BK5BQT80")}
      bind:value
      oninput={() => (picked = null)}
      onfocus={() => { if (hits.length > 0) open = true; }}
      onkeydown={onKeydown}
    />
    {#if loading}
      <Loader2 class={cn("absolute top-1/2 -translate-y-1/2 animate-spin text-faint", compact ? "right-2.5 size-3.5" : "right-3 size-4")} />
    {/if}
  </div>

  {#if open && (hits.length > 0 || (!loading && value.trim().length >= 2))}
    <div class="absolute z-[100] mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]">
      {#if looksLikeIsin}
        <div class="border-b border-line px-3.5 py-2 text-[11px] text-muted">{t("ISIN erkannt — handelbare Börsenplätze zuerst")}</div>
      {/if}
      {#if hits.length === 0}
        <div class="px-3.5 py-3 text-sm text-muted">{t("Nichts gefunden")}</div>
      {:else}
        {#each hits as h, i (h.symbol)}
          <button
            type="button"
            onmouseenter={() => (active = i)}
            onclick={() => pick(h)}
            class={cn("flex w-full cursor-pointer items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors", i === active && "bg-surface-3")}
          >
            <div class="min-w-0">
              <div class={cn("truncate text-ink", compact ? "text-xs" : "text-sm")}>{h.name}</div>
              <div class={compact ? "text-[10px] text-muted" : "text-xs text-muted"}>{h.symbol}{h.exchange ? ` · ${h.exchange}` : ""}</div>
            </div>
            {#if h.type}
              <span class="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">{h.type}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
