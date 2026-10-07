<script lang="ts" module>
  export type Series = { key: string; label: string; color: string; dashed?: boolean; fill?: boolean };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { niceTicks, linear, monotonePath, compact } from "./scale";
  import { prefs } from "$lib/prefs.svelte";

  /**
   * Line/area chart with a hover crosshair. Data is an array of rows; each
   * series reads one numeric key, the x label comes from `x`.
   */
  type Row = Record<string, unknown>;
  let {
    data,
    series,
    x,
    height = 260,
    yFormat,
    valueFormat,
    xTicks = 6,
    refLine,
    zeroBased = false,
    tooltip,
    showYAxis = true,
  }: {
    data: Row[];
    series: Series[];
    x: string;
    height?: number;
    yFormat?: (v: number) => string;
    valueFormat?: (v: number) => string;
    xTicks?: number;
    refLine?: { value: number; label?: string; color?: string } | null;
    zeroBased?: boolean;
    tooltip?: Snippet<[Row]>;
    showYAxis?: boolean;
  } = $props();

  let width = $state(0);
  let hover = $state<number | null>(null);
  const uid = `ac-${Math.random().toString(36).slice(2, 8)}`;

  const pad = $derived({ top: 12, right: 8, bottom: 26, left: showYAxis ? 48 : 8 });
  const innerW = $derived(Math.max(0, width - pad.left - pad.right));
  const innerH = $derived(height - pad.top - pad.bottom);

  const values = $derived(
    data.flatMap((r) => series.map((s) => Number(r[s.key])).filter((v) => Number.isFinite(v)))
  );
  const ticks = $derived.by(() => {
    let lo = values.length ? Math.min(...values) : 0;
    let hi = values.length ? Math.max(...values) : 1;
    if (refLine) { lo = Math.min(lo, refLine.value); hi = Math.max(hi, refLine.value); }
    if (zeroBased) lo = Math.min(0, lo);
    return niceTicks(lo, hi, 4);
  });
  const y = $derived(linear(ticks[0], ticks[ticks.length - 1], pad.top + innerH, pad.top));
  const xs = $derived(linear(0, Math.max(1, data.length - 1), pad.left, pad.left + innerW));

  const paths = $derived(
    series.map((s) => {
      const pts: Array<[number, number]> = [];
      data.forEach((r, i) => {
        const v = Number(r[s.key]);
        if (Number.isFinite(v)) pts.push([xs(i), y(v)]);
      });
      const line = monotonePath(pts);
      const base = y(Math.max(ticks[0], Math.min(0, ticks[ticks.length - 1])));
      const area = pts.length ? `${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z` : "";
      return { s, line, area };
    })
  );

  const xLabelIdx = $derived.by(() => {
    const n = data.length;
    // Never more labels than fit: roughly 72px per label.
    const k = Math.max(2, Math.min(xTicks, Math.floor(innerW / 72)));
    if (n <= k) return data.map((_, i) => i);
    const step = (n - 1) / (k - 1);
    return Array.from({ length: k }, (_, i) => Math.round(i * step));
  });

  const fmtY = $derived(yFormat ?? ((v: number) => compact(v, prefs.locale)));
  const fmtV = $derived(valueFormat ?? fmtY);

  function onMove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (data.length === 0) return;
    const i = Math.round(((px - pad.left) / Math.max(1, innerW)) * (data.length - 1));
    hover = Math.max(0, Math.min(data.length - 1, i));
  }

  const tipLeft = $derived(hover === null ? 0 : xs(hover));
</script>

<div class="relative w-full select-none" bind:clientWidth={width} style="height: {height}px">
  {#if width > 0}
    <svg {width} {height} role="img" class="overflow-visible" onpointermove={onMove} onpointerleave={() => (hover = null)}>
      <defs>
        {#each series as s (s.key)}
          <linearGradient id="{uid}-{s.key}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={s.color} stop-opacity="0.22" />
            <stop offset="100%" stop-color={s.color} stop-opacity="0" />
          </linearGradient>
        {/each}
      </defs>

      {#each ticks as tk (tk)}
        <line x1={pad.left} x2={pad.left + innerW} y1={y(tk)} y2={y(tk)} stroke="var(--chart-grid)" stroke-dasharray={tk === 0 ? "" : "3 4"} />
        {#if showYAxis}
          <text x={pad.left - 8} y={y(tk)} dy="0.32em" text-anchor="end" class="fill-faint text-[11px] num">{fmtY(tk)}</text>
        {/if}
      {/each}

      {#each xLabelIdx as i (i)}
        <text
          x={xs(i)}
          y={height - 6}
          text-anchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          class="fill-faint text-[11px]">{String(data[i]?.[x] ?? "")}</text
        >
      {/each}

      {#if refLine}
        <line x1={pad.left} x2={pad.left + innerW} y1={y(refLine.value)} y2={y(refLine.value)} stroke={refLine.color ?? "var(--warn)"} stroke-dasharray="5 4" stroke-width="1.5" />
        {#if refLine.label}
          <text x={pad.left + innerW} y={y(refLine.value) - 6} text-anchor="end" class="text-[11px] font-medium" fill={refLine.color ?? "var(--warn)"}>{refLine.label}</text>
        {/if}
      {/if}

      {#each paths as p (p.s.key)}
        {#if p.s.fill !== false}<path d={p.area} fill="url(#{uid}-{p.s.key})" />{/if}
        <path d={p.line} fill="none" stroke={p.s.color} stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={p.s.dashed ? "6 5" : undefined} />
      {/each}

      {#if hover !== null}
        <line x1={xs(hover)} x2={xs(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--line-strong)" />
        {#each series as s (s.key)}
          {@const v = Number(data[hover]?.[s.key])}
          {#if Number.isFinite(v)}
            <circle cx={xs(hover)} cy={y(v)} r="4.5" fill="var(--surface)" stroke={s.color} stroke-width="2.25" />
          {/if}
        {/each}
      {/if}
    </svg>

    {#if hover !== null && data[hover]}
      <div
        class="pointer-events-none absolute top-1 z-10 min-w-40 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-pop)]"
        style="left: {tipLeft}px; transform: translateX({tipLeft > width / 2 ? 'calc(-100% - 12px)' : '12px'})"
      >
        {#if tooltip}
          {@render tooltip(data[hover])}
        {:else}
          <div class="mb-1.5 font-medium text-muted">{String(data[hover][x] ?? "")}</div>
          {#each series as s (s.key)}
            {@const v = Number(data[hover][s.key])}
            {#if Number.isFinite(v)}
              <div class="flex items-center justify-between gap-5 py-0.5">
                <span class="flex items-center gap-1.5 text-ink-2"><span class="size-2 rounded-full" style="background: {s.color}"></span>{s.label}</span>
                <span class="num font-semibold text-ink">{fmtV(v)}</span>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  {/if}
</div>
