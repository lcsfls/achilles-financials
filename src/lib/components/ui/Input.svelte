<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let {
    value = $bindable(),
    el = $bindable(),
    class: klass = "",
    ...rest
  }: HTMLInputAttributes & { el?: HTMLInputElement } = $props();
</script>

<input
  bind:this={el}
  bind:value
  class={cn(
    "h-9.5 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors",
    "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15",
    "disabled:cursor-not-allowed disabled:opacity-55",
    klass
  )}
  {...rest}
/>
