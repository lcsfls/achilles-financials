<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  type Tone = "neutral" | "accent" | "pos" | "neg" | "warn" | "info";
  const TONES: Record<Tone, string> = {
    neutral: "bg-surface-3 text-ink-2",
    accent: "bg-accent-soft text-accent",
    pos: "bg-pos-soft text-pos",
    neg: "bg-neg-soft text-neg",
    warn: "bg-warn-soft text-warn",
    info: "bg-info-soft text-info",
  };

  let {
    tone = "neutral",
    color,
    class: klass = "",
    title,
    children,
  }: { tone?: Tone; color?: string; class?: string; title?: string; children?: Snippet } = $props();
</script>

<span
  {title}
  class={cn(
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
    !color && TONES[tone],
    klass
  )}
  style={color ? `background: color-mix(in srgb, ${color} 14%, transparent); color: ${color};` : undefined}
>
  {@render children?.()}
</span>
