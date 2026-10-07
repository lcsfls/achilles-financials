<script lang="ts">
  import type { Snippet } from "svelte";
  import { Info, AlertTriangle, CheckCircle2, XCircle } from "@lucide/svelte";
  import { cn } from "$lib/utils";

  type Tone = "info" | "warn" | "pos" | "neg";
  let { tone = "info", class: klass = "", children }: { tone?: Tone; class?: string; children?: Snippet } = $props();

  const STYLE: Record<Tone, string> = {
    info: "bg-info-soft text-info",
    warn: "bg-warn-soft text-warn",
    pos: "bg-pos-soft text-pos",
    neg: "bg-neg-soft text-neg",
  };
  const ICON = { info: Info, warn: AlertTriangle, pos: CheckCircle2, neg: XCircle };
  const Icon = $derived(ICON[tone]);
</script>

<div class={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed", STYLE[tone], klass)}>
  <Icon class="mt-0.5 size-4 shrink-0" />
  <div class="min-w-0 flex-1 text-ink-2">{@render children?.()}</div>
</div>
