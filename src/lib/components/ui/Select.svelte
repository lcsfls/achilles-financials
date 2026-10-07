<script lang="ts" module>
  export type SelectOption = { value: string; label: string; disabled?: boolean; hint?: string };
</script>

<script lang="ts">
  import { ChevronDown, Check } from "@lucide/svelte";
  import { cn } from "$lib/utils";
  import { onMount, tick } from "svelte";

  /**
   * Custom listbox instead of a native <select>: the native list is painted by
   * the operating system and ignores the theme — unreadable in dark mode on
   * some platforms. This one is real DOM, keyboard-operable, and themed.
   */
  let {
    value = $bindable(""),
    options,
    placeholder = "—",
    disabled = false,
    class: klass = "",
    size = "md",
    onchange,
    ariaLabel,
    autoOpen = false,
    onclose,
  }: {
    value?: string;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    size?: "sm" | "md";
    onchange?: (value: string) => void;
    ariaLabel?: string;
    /** Open the list on mount — for inline editors that appear on click. */
    autoOpen?: boolean;
    /** Fires whenever the list closes, chosen or not. */
    onclose?: () => void;
  } = $props();

  let open = $state(false);
  let active = $state(-1);
  let root: HTMLDivElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let dropUp = $state(false);
  const id = `sel-${Math.random().toString(36).slice(2, 9)}`;

  onMount(() => {
    if (autoOpen) {
      root?.querySelector("button")?.focus();
      show();
    }
  });

  let wasOpen = false;
  $effect(() => {
    if (wasOpen && !open) onclose?.();
    wasOpen = open;
  });

  const current = $derived(options.find((o) => o.value === value));

  async function show() {
    if (disabled) return;
    open = true;
    active = Math.max(0, options.findIndex((o) => o.value === value));
    if (root) {
      const r = root.getBoundingClientRect();
      dropUp = window.innerHeight - r.bottom < 260 && r.top > 260;
    }
    await tick();
    list?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function choose(o: SelectOption) {
    if (o.disabled) return;
    open = false;
    if (o.value !== value) {
      value = o.value;
      onchange?.(o.value);
    }
  }

  function move(d: number) {
    if (!options.length) return;
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + d + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    active = i;
    list?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKey(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      show();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") { open = false; }
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) active = i;
    }
  }

  function onDocClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:document onclick={onDocClick} />

<div class={cn("relative w-full", klass)} bind:this={root}>
  <button
    type="button"
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={id}
    aria-label={ariaLabel}
    {disabled}
    onclick={() => (open ? (open = false) : show())}
    onkeydown={onKey}
    class={cn(
      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface text-left text-ink transition-colors",
      "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-55",
      size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9.5 px-3 text-sm",
      open && "border-accent ring-3 ring-accent/15"
    )}
  >
    <span class={cn("truncate", !current && "text-faint")}>{current?.label ?? placeholder}</span>
    <ChevronDown class={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
  </button>

  {#if open}
    <ul
      bind:this={list}
      {id}
      role="listbox"
      class={cn(
        "absolute z-[80] max-h-64 w-full min-w-[10rem] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]",
        dropUp ? "bottom-full mb-1" : "top-full mt-1"
      )}
    >
      {#each options as o, i (o.value)}
        <!-- Keyboard is handled on the combobox button (aria-activedescendant pattern). -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          data-i={i}
          role="option"
          aria-selected={o.value === value}
          aria-disabled={o.disabled}
          class={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-ink-2",
            i === active && "bg-surface-3 text-ink",
            o.value === value && "font-medium text-ink",
            o.disabled && "pointer-events-none opacity-45"
          )}
          onmouseenter={() => (active = i)}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(o)}
        >
          <span class="flex size-4 shrink-0 items-center justify-center">
            {#if o.value === value}<Check class="size-3.5 text-accent" />{/if}
          </span>
          <span class="min-w-0 flex-1 truncate">{o.label}</span>
          {#if o.hint}<span class="shrink-0 text-xs text-faint">{o.hint}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
