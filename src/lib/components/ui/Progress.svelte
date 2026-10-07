<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    value,
    color = "var(--accent)",
    class: klass = "",
    height = 8,
  }: { value: number; color?: string; class?: string; height?: number } = $props();

  const pct = $derived(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
</script>

<div class={cn("w-full overflow-hidden rounded-full bg-surface-3", klass)} style="height: {height}px">
  <div class="h-full rounded-full transition-[width] duration-700 ease-out" style="width: {pct}%; background: {color}"></div>
</div>
