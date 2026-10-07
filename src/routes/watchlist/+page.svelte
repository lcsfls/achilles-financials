<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { Plus, Trash2, Eye, RefreshCw, TrendingUp, TrendingDown, CalendarPlus, Pin, GripVertical } from "@lucide/svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";
  import Loading from "$lib/components/ui/Loading.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Sparkline from "$lib/components/charts/Sparkline.svelte";
  import InstrumentSearch from "$lib/components/InstrumentSearch.svelte";
  import QuoteDetailDialog, { type DetailItem } from "$lib/components/QuoteDetailDialog.svelte";
  import { t } from "$lib/i18n";
  import { apiJson, cn, displayCurrency, fmtEUR, fmtNum, fmtPct, fmtDate, fmtDateTime } from "$lib/utils";

  type WatchItem = DetailItem & {
    pinned: boolean;
    priceAtAdd: number | null; priceEurAtAdd: number | null; currencyAtAdd: string | null;
  };

  let items = $state<WatchItem[] | null>(null);
  let symbol = $state("");
  let busy = $state(false);
  let refreshing = $state(false);
  let error = $state<string | null>(null);
  let detail = $state<WatchItem | null>(null);
  let detailOpen = $state(false);
  /** 6-month closes per symbol, for the sparkline on each tile. */
  let spark = $state<Record<string, number[] | null>>({});

  // Drag & drop over pointer events instead of the HTML5 drag API: only that
  // lets the whole tile lift off and follow the hand. `engaged` gates the lift
  // behind a small movement so a plain click still opens the details and the
  // pin/trash buttons still work.
  let gesture: { id: number; pinned: boolean; startX: number; startY: number; engaged: boolean } | null = null;
  let drag = $state<{ id: number; pinned: boolean } | null>(null);
  let offset = $state({ dx: 0, dy: 0 });
  let overId = $state<number | null>(null);

  /**
   * cached: what the server has stored, at once — for the first paint.
   * live:   quotes older than five minutes fetched again.
   * force:  every quote fetched again (the refresh button).
   */
  async function load(mode: "cached" | "live" | "force" = "live") {
    const q = mode === "cached" ? "?cached=1" : mode === "force" ? "?refresh=1" : "";
    const d = await apiJson<{ watchlist: WatchItem[]; outdated?: boolean }>(`/api/watchlist${q}`);
    items = d.watchlist;
    return d.outdated === true;
  }

  /** All sparklines in one request; the server answers from its cache. */
  async function loadSparks() {
    for (const w of items ?? []) if (!(w.symbol in spark)) spark[w.symbol] = null;
    try {
      const d = await apiJson<{ sparklines: Record<string, number[]> }>("/api/watchlist/sparklines");
      for (const w of items ?? []) spark[w.symbol] = d.sparklines[w.symbol] ?? [];
    } catch {
      for (const w of items ?? []) if (spark[w.symbol] === null) spark[w.symbol] = [];
    }
  }

  onMount(async () => {
    // Paint from the cache first, then bring stale prices up to date in the
    // background — the page no longer waits on Yahoo before showing anything.
    const outdated = await load("cached");
    loadSparks();
    if (outdated) {
      refreshing = true;
      await load("live").catch(() => {});
      refreshing = false;
    }
  });

  async function add(explicit?: string) {
    const sym = (explicit ?? symbol).trim();
    if (!sym) return;
    busy = true;
    error = null;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: sym }),
    });
    busy = false;
    if (!res.ok) { error = t((await res.json()).error); return; }
    symbol = "";
    await load();
    loadSparks();
  }

  /** Same order as the backend (pinned DESC, sort_order). */
  const sorted = (list: WatchItem[]) =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || list.indexOf(a) - list.indexOf(b));

  /**
   * Swap two tiles — within the same group only: pinned tiles always sort
   * first, so swapping across the boundary would leave the dragged tile where
   * it was and only make the other one jump.
   */
  async function swap(srcId: number, targetId: number) {
    if (!items || srcId === targetId) return;
    const next = [...items];
    const a = next.findIndex((i) => i.id === srcId);
    const b = next.findIndex((i) => i.id === targetId);
    if (a < 0 || b < 0 || next[a].pinned !== next[b].pinned) return;
    [next[a], next[b]] = [next[b], next[a]];
    items = next; // animate:flip slides both tiles into their new cells
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  }

  function onPointerDown(e: PointerEvent, w: WatchItem) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    gesture = { id: w.id, pinned: w.pinned, startX: e.clientX, startY: e.clientY, engaged: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const g = gesture;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    // Lift only once the pointer has actually travelled — below that it's a click.
    if (!g.engaged) {
      if (Math.hypot(dx, dy) < 6) return;
      g.engaged = true;
      drag = { id: g.id, pinned: g.pinned };
      document.body.style.userSelect = "none";
    }
    offset = { dx, dy };
    // The lifted tile has pointer-events:none, so elementFromPoint sees the tile underneath.
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-watch-id]") as HTMLElement | null;
    const tid = under ? Number(under.dataset.watchId) : null;
    overId = tid && tid !== g.id ? tid : null;
  }

  function endDrag() {
    const g = gesture;
    gesture = null;
    const target = overId != null ? items?.find((i) => i.id === overId) : null;
    if (g?.engaged && target && target.pinned === g.pinned) swap(g.id, target.id);
    else if (g && !g.engaged) {
      // Pressed and released without passing the threshold — a click: show details.
      const clicked = items?.find((i) => i.id === g.id);
      if (clicked) { detail = clicked; detailOpen = true; }
    }
    drag = null;
    overId = null;
    offset = { dx: 0, dy: 0 };
    document.body.style.userSelect = "";
  }

  async function togglePin(w: WatchItem) {
    // Re-sort at once and save afterwards: a pin is a tiny change nobody wants
    // to wait on the server for. Same order as the backend, so nothing jumps.
    items = sorted((items ?? []).map((i) => (i.id === w.id ? { ...i, pinned: !i.pinned } : i)));
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, pinned: !w.pinned }),
    });
  }

  async function remove(id: number) {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    load("cached");
  }

  async function refresh() {
    refreshing = true;
    await load("force");
    refreshing = false;
  }

  const withQuotes = $derived((items ?? []).filter((i) => i.quote));
  const gainers = $derived(withQuotes.filter((i) => (i.quote!.changePct ?? 0) > 0).length);
  const losers = $derived(withQuotes.filter((i) => (i.quote!.changePct ?? 0) < 0).length);
  const lastFetch = $derived(withQuotes.map((i) => i.quote!.fetchedAt).sort().at(-1));
</script>

<svelte:head><title>{t("Watchlist")} · Achilles</title></svelte:head>

{#if !items}
  <Loading />
{:else}
  <div class="rise space-y-6">
    <PageHeader
      title={t("Watchlist")}
      subtitle={items.length === 0
        ? t("Live-Kurse via Yahoo Finance · 5-Minuten-Cache")
        : `${t("{n} Werte", { n: items.length })} · ${t("{n} im Plus", { n: gainers })} · ${t("{n} im Minus", { n: losers })}${lastFetch ? ` · ${t("Stand {time}", { time: fmtDateTime(lastFetch) })}` : ""}`}
    >
      {#snippet actions()}
        <Button variant="secondary" size="sm" disabled={refreshing || items?.length === 0} onclick={refresh}>
          <RefreshCw class={refreshing ? "animate-spin" : ""} /> {t("Kurse aktualisieren")}
        </Button>
      {/snippet}
    </PageHeader>

    <Card class="relative z-20 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <InstrumentSearch
          class="min-w-[200px] flex-1"
          bind:value={symbol}
          onpick={(sym) => { symbol = sym; add(sym); }}
          onsubmit={() => add()}
        />
        <Button disabled={busy || !symbol.trim()} onclick={() => add()}>
          {#if busy}{t("Prüfe …")}{:else}<Plus /> {t("Hinzufügen")}{/if}
        </Button>
      </div>
      {#if error}<div class="mt-2 text-xs text-neg">{error}</div>{/if}
    </Card>

    {#if items.length === 0}
      <Card>
        <EmptyState icon={Eye} title={t("Watchlist")} text={t("Noch leer — suche nach Name, Symbol oder ISIN, um Kurse zu beobachten.")} />
      </Card>
    {:else}
      <!-- auto-fill instead of fixed columns per breakpoint: as many columns as fit at 300px+ per tile. -->
      <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {#each items as w (w.id)}
          {@const q = w.quote}
          {@const dayUp = (q?.changePct ?? 0) >= 0}
          {@const lifted = drag?.id === w.id}
          {@const isTarget = overId === w.id && drag != null && drag.id !== w.id && drag.pinned === w.pinned}
          <div
            animate:flip={{ duration: 300 }}
            data-watch-id={w.id}
            role="button"
            tabindex="0"
            onpointerdown={(e) => onPointerDown(e, w)}
            onpointermove={onPointerMove}
            onpointerup={endDrag}
            onpointercancel={endDrag}
            onkeydown={(e) => { if (e.key === "Enter") { detail = w; detailOpen = true; } }}
            style="touch-action: none; {lifted
              ? `transform: translate(${offset.dx}px, ${offset.dy}px) scale(1.04) rotate(1deg); z-index: 50; position: relative; pointer-events: none; box-shadow: var(--shadow-pop); cursor: grabbing;`
              : `transition: transform .2s, border-color .2s; ${isTarget ? 'transform: scale(0.97);' : ''}`}"
            class={cn(
              "group cursor-grab select-none rounded-2xl border bg-surface p-4.5 shadow-[var(--shadow-card)] hover:border-line-strong",
              w.pinned ? "border-accent/35" : "border-line",
              isTarget && "border-accent ring-3 ring-accent/20"
            )}
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold">{w.label || q?.name || w.symbol}</div>
                <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span class="num">{w.symbol}</span>
                  {#if q?.stale}<span class="text-warn">{t("letzter bekannter Kurs")}</span>{/if}
                </div>
              </div>
              <div class="-mr-1.5 -mt-1 flex shrink-0 items-center">
                <span class="rounded-lg p-1.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" title={t("Ziehen zum Tauschen")}>
                  <GripVertical class="size-3.5" />
                </span>
                <!-- Pinned stays visible — otherwise you couldn't tell why a tile sits first. -->
                <button
                  type="button"
                  onclick={() => togglePin(w)}
                  class={cn(
                    "cursor-pointer rounded-lg p-1.5 transition-all",
                    w.pinned ? "text-accent hover:bg-accent-soft" : "text-faint opacity-0 hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
                  )}
                  title={w.pinned ? t("Nicht mehr anpinnen") : t("Anpinnen")}
                >
                  <Pin class={cn("size-3.5", w.pinned && "fill-current")} />
                </button>
                <button
                  type="button"
                  onclick={() => remove(w.id)}
                  class="cursor-pointer rounded-lg p-1.5 text-faint opacity-0 transition-all hover:bg-neg-soft hover:text-neg group-hover:opacity-100"
                  title={t("Entfernen")}
                >
                  <Trash2 class="size-3.5" />
                </button>
              </div>
            </div>

            {#if q}
              <div class="mt-3 flex items-end justify-between gap-3">
                <div class="min-w-0">
                  <div class="num text-2xl font-semibold tracking-tight">
                    {fmtNum(q.price)} <span class="text-sm font-normal text-muted">{q.currency}</span>
                  </div>
                  <!-- Converted only when the quote isn't in the display currency anyway. -->
                  {#if q.priceEur !== null && q.currency !== displayCurrency()}
                    <div class="num mt-0.5 text-xs text-muted">{fmtEUR(q.priceEur)}</div>
                  {/if}
                  {#if q.changePct !== null}
                    <div class={cn("num mt-1 flex items-center gap-1 text-xs font-semibold", dayUp ? "text-pos" : "text-neg")} title={t("Veränderung heute")}>
                      {#if dayUp}<TrendingUp class="size-3.5" />{:else}<TrendingDown class="size-3.5" />{/if}
                      {fmtPct(q.changePct)} <span class="font-normal text-muted">{t("heute")}</span>
                    </div>
                  {/if}
                </div>
                {#if spark[w.symbol]?.length}
                  <Sparkline values={spark[w.symbol] ?? []} width={110} height={40} />
                {:else if spark[w.symbol] === null}
                  <div class="skeleton h-10 w-[110px]"></div>
                {/if}
              </div>

              <!-- Gain since added -->
              <div class="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11px]">
                <span class="flex items-center gap-1.5 text-muted">
                  <CalendarPlus class="size-3" />
                  {t("seit {date}", { date: fmtDate(w.added_at) })}
                </span>
                {#if w.since}
                  <span class={cn("num font-semibold", w.since.pct >= 0 ? "text-pos" : "text-neg")}>
                    {fmtPct(w.since.pct)}
                    <span class="ml-1 font-normal opacity-75">({w.since.abs >= 0 ? "+" : ""}{fmtNum(w.since.abs)} {w.since.currency})</span>
                  </span>
                {:else}
                  <span class="text-muted">{t("kein Einstandskurs erfasst")}</span>
                {/if}
              </div>
            {:else}
              <div class="mt-4 text-xs text-muted">{t("kein Kurs")}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<QuoteDetailDialog item={detail} bind:open={detailOpen} />
