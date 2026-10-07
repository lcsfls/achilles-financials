<script lang="ts">
  import type { Snippet } from "svelte";
  import { niceTicks, linear, compact } from "./scale";
  import { prefs } from "$lib/prefs.svelte";

  /**
   * Grouped bar chart — cash flow by month, income next to spending. Negative
   * values hang below the zero line.
   */
  type Row = Record<string, unknown>;
  let {
    data,
    series,
    x,
    height = 260,
    yFormat,
    valueFormat,
    tooltip,
    line,
  }: {
    data: Row[];
    series: Array<{ key: string; label: string; color: string }>;
    x: string;
    height?: number;
    yFormat?: (v: number) => string;
    valueFormat?: (v: number) => string;
    tooltip?: Snippet<[Row]>;
    /** Optional overlay line (e.g. net cash flow) drawn as dots + segments. */
    line?: { key: string; label: string; color: string } | null;
  } = $props();

  let width = $state(0);
  let hover = $state<number | null>(null);

  const pad = { top: 12, right: 8, bottom: 26, left: 48 };
  const innerW = $derived(Math.max(0, width - pad.left - pad.right));
  const innerH = $derived(height - pad.top - pad.bottom);

  const ticks = $derived.by(() => {
    const keys = [...series.map((s) => s.key), ...(line ? [line.key] : [])];
    const vals = data.flatMap((r) => keys.map((k) => Number(r[k]) || 0));
    return niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  });
  const y = $derived(linear(ticks[0], ticks[ticks.length - 1], pad.top + innerH, pad.top));
  const band = $derived(data.length ? innerW / data.length : 0);
  const groupW = $derived(Math.min(band * 0.64, 22 * series.length + 4 * (series.length - 1)));
  const barW = $derived(series.length ? (groupW - 4 * (series.length - 1)) / series.length : 0);
  const cx = (i: number) => pad.left + band * i + band / 2;

  const fmtY = $derived(yFormat ?? ((v: number) => compact(v, prefs.locale)));
  const fmtV = $derived(valueFormat ?? fmtY);

  function bar(v: number) {
    const y0 = y(0), y1 = y(v);
    return { top: Math.min(y0, y1), h: Math.max(1, Math.abs(y1 - y0)) };
  }

  function onMove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - pad.left) / Math.max(1, band));
    hover = i >= 0 && i < data.length ? i : null;
  }
</script>

<div class="relative w-full select-none" bind:clientWidth={width} style="height: {height}px">
  {#if width > 0}
    <svg {width} {height} role="img" onpointermove={onMove} onpointerleave={() => (hover = null)}>
      {#each ticks as tk (tk)}
        <line x1={pad.left} x2={pad.left + innerW} y1={y(tk)} y2={y(tk)} stroke={tk === 0 ? "var(--line-strong)" : "var(--chart-grid)"} stroke-dasharray={tk === 0 ? "" : "3 4"} />
        <text x={pad.left - 8} y={y(tk)} dy="0.32em" text-anchor="end" class="fill-faint text-[11px] num">{fmtY(tk)}</text>
      {/each}

      {#each data as r, i (i)}
        {#if hover === i}
          <rect x={pad.left + band * i + 2} y={pad.top} width={band - 4} height={innerH} rx="8" fill="var(--surface-3)" opacity="0.7" />
        {/if}
        {#each series as s, j (s.key)}
          {@const v = Number(r[s.key]) || 0}
          {@const b = bar(v)}
          <rect
            x={cx(i) - groupW / 2 + j * (barW + 4)}
            y={b.top}
            width={barW}
            height={b.h}
            rx={Math.min(5, barW / 2)}
            fill={s.color}
            opacity={hover === null || hover === i ? 1 : 0.45}
            class="transition-opacity"
          />
        {/each}
        {#if band >= 34 || i % Math.ceil(34 / Math.max(1, band)) === 0}
          <text x={cx(i)} y={height - 6} text-anchor="middle" class="fill-faint text-[11px]">{String(r[x] ?? "")}</text>
        {/if}
      {/each}

      {#if line && data.length > 1}
        <polyline
          points={data.map((r, i) => `${cx(i)},${y(Number(r[line.key]) || 0)}`).join(" ")}
          fill="none" stroke={line.color} stroke-width="2" stroke-linejoin="round"
        />
        {#each data as r, i (i)}
          <circle cx={cx(i)} cy={y(Number(r[line.key]) || 0)} r="3.5" fill="var(--surface)" stroke={line.color} stroke-width="2" />
        {/each}
      {/if}
    </svg>

    {#if hover !== null && data[hover]}
      {@const left = cx(hover)}
      <div
        class="pointer-events-none absolute top-1 z-10 min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-pop)]"
        style="left: {left}px; transform: translateX({left > width / 2 ? `calc(-100% - ${band / 2}px)` : `${band / 2}px`})"
      >
        {#if tooltip}
          {@render tooltip(data[hover])}
        {:else}
          <div class="mb-1.5 font-medium text-muted">{String(data[hover][x] ?? "")}</div>
          {#each [...series, ...(line ? [line] : [])] as s (s.key)}
            <div class="flex items-center justify-between gap-5 py-0.5">
              <span class="flex items-center gap-1.5 text-ink-2"><span class="size-2 rounded-full" style="background: {s.color}"></span>{s.label}</span>
              <span class="num font-semibold text-ink">{fmtV(Number(data[hover][s.key]) || 0)}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
</div>
