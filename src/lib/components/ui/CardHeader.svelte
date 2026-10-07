<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  let {
    title,
    subtitle,
    actions,
    class: klass = "",
  }: { title: string; subtitle?: string | null; actions?: Snippet; class?: string } = $props();
</script>

<div class={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-3", klass)}>
  <div class="min-w-0">
    <h3 class="text-[15px] font-semibold text-ink">{title}</h3>
    {#if subtitle}<p class="mt-0.5 text-xs text-muted">{subtitle}</p>{/if}
  </div>
  {#if actions}<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>{/if}
</div>
