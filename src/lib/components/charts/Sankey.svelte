<script lang="ts" module>
  export type SankeyNode = { key: string; label: string; value: number; color: string; clickable?: boolean };
</script>

<script lang="ts">
  /**
   * Three-column flow diagram: sources on the left feed one node in the
   * middle, which splits into the targets on the right. Both sides must add
   * up to the middle — the caller balances them (a deficit becomes a source,
   * savings a target).
   *
   * Plain SVG like the other charts. Band widths are proportional to the
   * amount; labels are spread apart so small flows stay readable.
   */
  let {
    left,
    right,
    center,
    format,
    height: minHeight = 440,
    onnode,
  }: {
    left: SankeyNode[];
    right: SankeyNode[];
    center: { label: string; value: number; color: string };
    format: (v: number) => string;
    height?: number;
    onnode?: (key: string) => void;
  } = $props();

  let width = $state(0);
  let hover = $state<string | null>(null);
  let tip = $state<{ x: number; y: number; title: string; value: number } | null>(null);

  const NODE_W = 10;
  const LABEL_W = 190;
  const LINE = 40; // minimum vertical room per label
  /** Share of the height the flows may fill; the rest is air between nodes. */
  const FILL = 0.6;

  const total = $derived(Math.max(center.value, 1e-9));
  // Height follows the width (a wide screen gets a taller diagram instead of
  // stretched, chunky bands), and always leaves room for every label.
  const height = $derived(
    Math.max(minHeight, Math.min(760, Math.round(width * 0.5)), Math.max(left.length, right.length) * LINE + 48)
  );
  const top = 36; // room for the centre label above the middle node
  const usable = $derived(height - top - 12);

  /** Gap between nodes of one column: the unfilled height spread out, within sane bounds. */
  const gapFor = (n: number) => (n > 1 ? Math.min(44, Math.max(10, (usable * (1 - FILL)) / (n - 1))) : 0);
  const gapL = $derived(gapFor(left.length));
  const gapR = $derived(gapFor(right.length));

  // One scale for all columns so a euro is equally thick everywhere.
  const k = $derived(
    Math.min(
      (usable * FILL) / total,
      (usable - gapL * Math.max(0, left.length - 1)) / total,
      (usable - gapR * Math.max(0, right.length - 1)) / total
    )
  );

  const xL = $derived(LABEL_W);
  const xC = $derived(width / 2 - NODE_W / 2);
  const xR = $derived(width - LABEL_W - NODE_W);

  type Placed = SankeyNode & { y: number; h: number };

  function stack(nodes: SankeyNode[], gap: number): Placed[] {
    const sum = nodes.reduce((s, n) => s + n.value * k, 0) + gap * Math.max(0, nodes.length - 1);
    let y = top + (usable - sum) / 2;
    return nodes.map((n) => {
      const h = Math.max(1.5, n.value * k);
      const out = { ...n, y, h };
      y += h + gap;
      return out;
    });
  }

  const L = $derived(stack(left, gapL));
  const R = $derived(stack(right, gapR));
  const centerH = $derived(total * k);
  const centerY = $derived(top + (usable - centerH) / 2);

  /** Where each band enters/leaves the centre node, stacked in order. */
  function offsets(nodes: Placed[]) {
    let y = centerY;
    return nodes.map((n) => {
      const h = n.value * k;
      const o = { y0: y, y1: y + h };
      y += h;
      return o;
    });
  }
  const inL = $derived(offsets(L));
  const outR = $derived(offsets(R));

  function band(x1: number, a0: number, a1: number, x2: number, b0: number, b1: number) {
    const m = (x1 + x2) / 2;
    return `M${x1},${a0}C${m},${a0} ${m},${b0} ${x2},${b0}L${x2},${b1}C${m},${b1} ${m},${a1} ${x1},${a1}Z`;
  }

  /**
   * Label positions: centred on the node, then pushed apart so neighbours
   * never overlap — small categories get a leader line to their sliver.
   */
  function spread(nodes: Placed[]) {
    const ys = nodes.map((n) => n.y + n.h / 2);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LINE);
    const overflow = ys.length ? ys[ys.length - 1] - (height - LINE / 2) : 0;
    if (overflow > 0) for (let i = ys.length - 1; i >= 0; i--) {
      ys[i] -= overflow;
      if (i > 0 && ys[i - 1] > ys[i] - LINE) ys[i - 1] = ys[i] - LINE;
    }
    return ys;
  }
  const labL = $derived(spread(L));
  const labR = $derived(spread(R));

  const pct = (v: number) => `${Math.round((v / total) * 100)} %`;
  const dim = (key: string) => (hover && hover !== key ? 0.18 : 1);

  function move(e: PointerEvent, title: string, value: number, key: string) {
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    hover = key;
    tip = { x: e.clientX - rect.left, y: e.clientY - rect.top, title, value };
  }
  function leave() {
    hover = null;
    tip = null;
  }
</script>

<div class="relative w-full select-none" bind:clientWidth={width} style="height: {height}px">
  {#if width > 0}
    <svg {width} {height} role="img">
      <!-- bands: sources → centre -->
      {#each L as n, i (n.key)}
        <path
          role="presentation"
          d={band(xL + NODE_W, n.y, n.y + n.value * k, xC, inL[i].y0, inL[i].y1)}
          fill={n.color}
          fill-opacity={0.32 * dim(n.key)}
          class="transition-[fill-opacity]"
          onpointermove={(e) => move(e, n.label, n.value, n.key)}
          onpointerleave={leave}
        />
      {/each}
      <!-- bands: centre → targets -->
      {#each R as n, i (n.key)}
        <path
          role="presentation"
          d={band(xC + NODE_W, outR[i].y0, outR[i].y1, xR, n.y, n.y + n.value * k)}
          fill={n.color}
          fill-opacity={0.32 * dim(n.key)}
          class={n.clickable ? "cursor-pointer transition-[fill-opacity]" : "transition-[fill-opacity]"}
          onpointermove={(e) => move(e, n.label, n.value, n.key)}
          onpointerleave={leave}
          onclick={() => n.clickable && onnode?.(n.key)}
        />
      {/each}

      <!-- nodes -->
      {#each L as n (n.key)}
        <rect x={xL} y={n.y} width={NODE_W} height={n.h} rx="3" fill={n.color} opacity={dim(n.key)} />
      {/each}
      <rect x={xC} y={centerY} width={NODE_W} height={centerH} rx="3" fill={center.color} />
      {#each R as n (n.key)}
        <rect x={xR} y={n.y} width={NODE_W} height={n.h} rx="3" fill={n.color} opacity={dim(n.key)} />
      {/each}

      <!-- labels, left -->
      {#each L as n, i (n.key)}
        {@const ly = labL[i]}
        {#if Math.abs(ly - (n.y + n.h / 2)) > 4}
          <path d="M{xL - 4},{n.y + n.h / 2}L{xL - 14},{ly}" stroke="var(--line-strong)" fill="none" />
        {/if}
        <text x={xL - 18} y={ly - 3} text-anchor="end" class="fill-ink text-[12px] font-medium" opacity={dim(n.key)}>{n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label}</text>
        <text x={xL - 18} y={ly + 12} text-anchor="end" class="num fill-muted text-[11px]" opacity={dim(n.key)}>{format(n.value)} · {pct(n.value)}</text>
      {/each}

      <!-- labels, right -->
      {#each R as n, i (n.key)}
        {@const ly = labR[i]}
        {#if Math.abs(ly - (n.y + n.h / 2)) > 4}
          <path d="M{xR + NODE_W + 4},{n.y + n.h / 2}L{xR + NODE_W + 14},{ly}" stroke="var(--line-strong)" fill="none" />
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
          role="presentation"
          class={n.clickable ? "cursor-pointer" : ""}
          opacity={dim(n.key)}
          onclick={() => n.clickable && onnode?.(n.key)}
          onpointerenter={() => (hover = n.key)}
          onpointerleave={() => (hover = null)}
        >
          <text x={xR + NODE_W + 18} y={ly - 3} class="fill-ink text-[12px] font-medium">{n.label}</text>
          <text x={xR + NODE_W + 18} y={ly + 12} class="num fill-muted text-[11px]">{format(n.value)} · {pct(n.value)}</text>
        </g>
      {/each}

      <!-- centre label -->
      <text x={xC + NODE_W / 2} y={Math.max(14, centerY - 22)} text-anchor="middle" class="fill-muted text-[11px] font-medium">{center.label}</text>
      <text x={xC + NODE_W / 2} y={Math.max(28, centerY - 8)} text-anchor="middle" class="num fill-ink text-[13px] font-semibold">{format(center.value)}</text>
    </svg>

    {#if tip}
      <div
        class="pointer-events-none absolute z-10 min-w-40 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
        style="left: {tip.x}px; top: {tip.y}px; transform: translate({tip.x > width / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)"
      >
        <div class="font-medium text-ink">{tip.title}</div>
        <div class="num mt-0.5 text-muted">{format(tip.value)} · {pct(tip.value)}</div>
      </div>
    {/if}
  {/if}
</div>
