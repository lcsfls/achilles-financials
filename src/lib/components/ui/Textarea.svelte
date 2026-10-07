<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let { value = $bindable(), class: klass = "", ...rest }: HTMLTextareaAttributes = $props();
</script>

<textarea
  bind:value
  class={cn(
    "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint transition-colors",
    "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15",
    klass
  )}
  {...rest}
></textarea>
