<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    checked = $bindable(false),
    disabled = false,
    onchange,
    label,
  }: { checked?: boolean; disabled?: boolean; onchange?: (v: boolean) => void; label?: string } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class={cn(
    "relative inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    checked ? "bg-accent" : "bg-line-strong"
  )}
  onclick={() => { checked = !checked; onchange?.(checked); }}
>
  <span class={cn("inline-block size-4.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")}></span>
</button>
