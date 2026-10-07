<script lang="ts">
  import type { Snippet } from "svelte";
  import { Shield } from "@lucide/svelte";
  import { cn } from "$lib/utils";

  /** Centred frame for the pages outside the app shell: login and first-run setup. */
  let { width = "max-w-sm", children }: { width?: string; children: Snippet } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-canvas p-4">
  <div class={cn("rise w-full", width)}>
    <div class="mb-7 flex flex-col items-center gap-3 text-center">
      <span class="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-sm">
        <Shield class="size-6" strokeWidth={2.2} />
      </span>
      <div>
        <div class="text-xl font-semibold tracking-tight">Achilles Financials</div>
        <div class="mt-0.5 text-xs text-muted">Private Wealth Dashboard</div>
      </div>
    </div>
    {@render children()}
  </div>
</div>
