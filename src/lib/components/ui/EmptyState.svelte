<script lang="ts">
  import type { Snippet, Component } from "svelte";
  import { cn } from "$lib/utils";

  let {
    icon: Icon,
    title,
    text,
    class: klass = "",
    children,
  }: { icon?: Component<{ class?: string }>; title: string; text?: string | null; class?: string; children?: Snippet } = $props();
</script>

<div class={cn("flex flex-col items-center justify-center px-6 py-12 text-center", klass)}>
  {#if Icon}
    <div class="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
      <Icon class="size-5.5" />
    </div>
  {/if}
  <h3 class="text-[15px] font-semibold text-ink">{title}</h3>
  {#if text}<p class="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{text}</p>{/if}
  {#if children}<div class="mt-5 flex flex-wrap justify-center gap-2">{@render children()}</div>{/if}
</div>
