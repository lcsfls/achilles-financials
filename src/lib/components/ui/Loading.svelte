<script lang="ts">
  /** Skeleton placeholder in the shape of a typical page: header, tiles, panel. */
  let { rows = 1 }: { rows?: number } = $props();
</script>

<div class="space-y-6" aria-busy="true">
  <div class="space-y-2">
    <div class="skeleton h-7 w-56"></div>
    <div class="skeleton h-4 w-80 max-w-full"></div>
  </div>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {#each [0, 1, 2, 3] as i (i)}<div class="skeleton h-24 rounded-2xl"></div>{/each}
  </div>
  {#each Array(rows) as _, i (i)}<div class="skeleton h-72 rounded-2xl"></div>{/each}
</div>
