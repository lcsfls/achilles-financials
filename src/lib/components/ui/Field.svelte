<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  /**
   * Label + control + optional hint, the unit every form is built from. The
   * root is the <label>, so clicking the caption focuses the control inside.
   */
  let { label, hint, class: klass = "", children }: { label?: string; hint?: string | null; class?: string; children?: Snippet } = $props();
</script>

<label class={cn("block min-w-0", klass)}>
  {#if label}<span class="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>{/if}
  {@render children?.()}
  {#if hint}<span class="mt-1 block text-[11px] leading-snug text-muted">{hint}</span>{/if}
</label>
