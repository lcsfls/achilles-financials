<script lang="ts">
  let { items }: { items: Array<{ label: string; color: string; dashed?: boolean }> } = $props();
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
  {#each items as it (it.label)}
    <span class="flex items-center gap-1.5">
      {#if it.dashed}
        <span class="h-0 w-3.5 border-t-2 border-dashed" style="border-color: {it.color}"></span>
      {:else}
        <span class="size-2 rounded-full" style="background: {it.color}"></span>
      {/if}
      {it.label}
    </span>
  {/each}
</div>
