<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  let { for: htmlFor, class: klass = "", children }: { for?: string; class?: string; children?: Snippet } = $props();
</script>

<label for={htmlFor} class={cn("mb-1.5 block text-xs font-medium text-ink-2", klass)}>{@render children?.()}</label>
