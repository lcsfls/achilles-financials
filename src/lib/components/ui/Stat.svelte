<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { cn } from "$lib/utils";

  /** A KPI tile: label, big number, one line of context. */
  let {
    label,
    value,
    sub,
    usd,
    icon: Icon,
    color,
    subTone,
    valueTone,
    href,
    class: klass = "",
    children,
  }: {
    label: string;
    value: string;
    sub?: string | null;
    usd?: string | null;
    icon?: Component<{ class?: string; style?: string }>;
    color?: string;
    subTone?: "pos" | "neg" | "muted";
    valueTone?: "pos" | "neg";
    href?: string;
    class?: string;
    children?: Snippet;
  } = $props();

  const TONE = { pos: "text-pos", neg: "text-neg", muted: "text-muted" } as const;
</script>

<svelte:element
  this={href ? "a" : "div"}
  {href}
  class={cn(
    "group block rounded-2xl border border-line bg-surface p-4.5 shadow-[var(--shadow-card)] transition-colors",
    href && "hover:border-line-strong",
    klass
  )}
>
  <div class="flex items-center justify-between gap-2">
    <span class="truncate text-[13px] font-medium text-muted">{label}</span>
    {#if Icon}
      <span
        class="flex size-7 shrink-0 items-center justify-center rounded-lg"
        style={color ? `background: color-mix(in srgb, ${color} 13%, transparent); color: ${color}` : undefined}
      >
        <Icon class="size-3.5" />
      </span>
    {/if}
  </div>
  <div class={cn("num mt-2 truncate text-[22px] font-semibold tracking-tight text-ink", valueTone && TONE[valueTone])}>{value}</div>
  {#if usd}<div class="num text-[11px] text-faint">{usd}</div>{/if}
  {#if sub}<div class={cn("mt-1 truncate text-xs", TONE[subTone ?? "muted"])}>{sub}</div>{/if}
  {@render children?.()}
</svelte:element>
