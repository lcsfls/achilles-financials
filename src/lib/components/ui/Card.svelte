<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let { class: klass = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div class={cn("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", klass)} {...rest}>
  {@render children?.()}
</div>
