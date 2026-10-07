<script lang="ts">
  import { cn } from "$lib/utils";

  /** Pill-style toggle between a few options — range pickers, view modes. */
  let {
    value = $bindable(""),
    options,
    onchange,
    class: klass = "",
    size = "md",
  }: {
    value?: string;
    options: Array<{ value: string; label: string }>;
    onchange?: (v: string) => void;
    class?: string;
    size?: "sm" | "md";
  } = $props();
</script>

<div role="radiogroup" class={cn("inline-flex items-center gap-0.5 rounded-xl bg-surface-3 p-0.5", klass)}>
  {#each options as o (o.value)}
    <button
      type="button"
      role="radio"
      aria-checked={o.value === value}
      class={cn(
        "cursor-pointer rounded-[10px] font-medium transition-all",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
        o.value === value ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink"
      )}
      onclick={() => { value = o.value; onchange?.(o.value); }}
    >
      {o.label}
    </button>
  {/each}
</div>
