<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Donut with a hover state: the hovered slice lifts, the centre shows it.
   * Without a hover the centre shows whatever `center` renders (usually the total).
   */
  type Seg = { key: string; label: string; value: number; color: string };
  let {
    segments,
    size = 180,
    thickness = 22,
    center,
    format = (v: number) => String(v),
    active = $bindable<string | null>(null),
  }: {
    segments: Seg[];
    size?: number;
    thickness?: number;
    center?: Snippet;
    format?: (v: number) => string;
    active?: string | null;
  } = $props();

  const total = $derived(segments.reduce((s, g) => s + Math.max(0, g.value), 0));
  const r = $derived(size / 2 - 4);
  const ri = $derived(r - thickness);
  const GAP = 0.025; // radians between slices

  function arc(a0: number, a1: number, ro: number, rin: number) {
    const c = size / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rr: number) => `${c + rr * Math.sin(a)},${c - rr * Math.cos(a)}`;
    return `M${p(a0, ro)}A${ro},${ro} 0 ${large} 1 ${p(a1, ro)}L${p(a1, rin)}A${rin},${rin} 0 ${large} 0 ${p(a0, rin)}Z`;
  }

  const arcs = $derived.by(() => {
    let a = 0;
    const n = segments.filter((s) => s.value > 0).length;
    return segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const span = total > 0 ? (s.value / total) * Math.PI * 2 : 0;
        const g = n > 1 ? Math.min(GAP, span / 3) : 0;
        const out = { s, a0: a + g / 2, a1: a + span - g / 2 };
        a += span;
        return out;
      });
  });

  const hovered = $derived(segments.find((s) => s.key === active));
</script>

<div class="relative shrink-0" style="width: {size}px; height: {size}px">
  <svg width={size} height={size} role="img">
    {#if total <= 0}
      <circle cx={size / 2} cy={size / 2} r={r - thickness / 2} fill="none" stroke="var(--surface-3)" stroke-width={thickness} />
    {:else if arcs.length === 1}
      <circle cx={size / 2} cy={size / 2} r={r - thickness / 2} fill="none" stroke={arcs[0].s.color} stroke-width={thickness}
        role="presentation" onpointerenter={() => (active = arcs[0].s.key)} onpointerleave={() => (active = null)} />
    {:else}
      {#each arcs as a (a.s.key)}
        <path
          role="presentation"
          d={arc(a.a0, a.a1, active === a.s.key ? r + 3 : r, ri)}
          fill={a.s.color}
          opacity={active && active !== a.s.key ? 0.4 : 1}
          class="cursor-pointer transition-opacity"
          onpointerenter={() => (active = a.s.key)}
          onpointerleave={() => (active = null)}
        />
      {/each}
    {/if}
  </svg>
  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
    {#if hovered}
      <span class="max-w-full truncate text-[11px] text-muted">{hovered.label}</span>
      <span class="num text-base font-semibold text-ink">{format(hovered.value)}</span>
      <span class="num text-[11px] text-faint">{total > 0 ? Math.round((hovered.value / total) * 100) : 0} %</span>
    {:else}
      {@render center?.()}
    {/if}
  </div>
</div>
