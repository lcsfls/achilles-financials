<script lang="ts" module>
  export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "soft";
  export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

  const BASE =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 select-none cursor-pointer disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0";

  const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-accent text-accent-ink hover:brightness-105 active:brightness-95 shadow-sm",
    secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong shadow-[var(--shadow-card)]",
    outline: "border border-line text-ink hover:bg-surface-2",
    ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
    soft: "bg-accent-soft text-accent hover:brightness-[0.98]",
    danger: "border border-neg/30 text-neg hover:bg-neg-soft",
  };

  const SIZES: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[13px] rounded-lg [&_svg]:size-3.5",
    md: "h-9.5 px-4 text-sm rounded-xl [&_svg]:size-4",
    lg: "h-11 px-6 text-[15px] rounded-xl [&_svg]:size-4.5",
    icon: "size-9 rounded-xl [&_svg]:size-4",
    "icon-sm": "size-7.5 rounded-lg [&_svg]:size-3.5",
  };

  export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
    return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let {
    variant = "primary",
    size = "md",
    href,
    target,
    class: klass = "",
    children,
    ...rest
  }: HTMLButtonAttributes & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    href?: string;
    target?: string;
    children?: Snippet;
  } = $props();
</script>

{#if href}
  <a {href} {target} rel={target === "_blank" ? "noopener noreferrer" : undefined} class={cn(buttonClass(variant, size), klass)}>
    {@render children?.()}
  </a>
{:else}
  <button type="button" class={cn(buttonClass(variant, size), klass)} {...rest}>
    {@render children?.()}
  </button>
{/if}
