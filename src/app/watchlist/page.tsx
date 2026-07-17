"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Eye, RefreshCw, TrendingUp, TrendingDown, CalendarPlus, Pin, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteHoverCard } from "@/components/quote-hover-card";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, displayCurrency, fmtEUR, fmtNum, fmtPct, fmtDate, fmtDateTime } from "@/lib/utils";

type WatchItem = {
  id: number; symbol: string; label: string | null; added_at: string; pinned: boolean;
  priceAtAdd: number | null; priceEurAtAdd: number | null; currencyAtAdd: string | null;
  quote: {
    name: string | null; price: number; prevClose: number | null; changePct: number | null;
    currency: string; priceEur: number | null; fetchedAt: string; stale: boolean;
  } | null;
  since: { pct: number; abs: number; currency: string } | null;
};

type XY = { x: number; y: number };

/** Duration of the swap slide; the array reorder is committed after it. */
const SLIDE_MS = 300;

export default function WatchlistPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<WatchItem | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Drag & drop over pointer events instead of the HTML5 drag API: only that
  // lets the whole tile lift off and follow the hand. The gesture in progress
  // lives in a ref (read synchronously on move/up); the state mirrors it for
  // rendering. `engaged` gates the lift behind a small movement so a plain
  // click on the pin/trash buttons still goes through.
  const dragRef = useRef<{ id: number; pinned: boolean; startX: number; startY: number; engaged: boolean } | null>(null);
  const [drag, setDrag] = useState<{ id: number; pinned: boolean } | null>(null);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  // Both a ref and state: endDrag reads the ref (its closure's state would be
  // stale if the last move and the release land in the same tick), the state
  // drives the target's highlight.
  const overIdRef = useRef<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  // Live references to the tile elements, used to measure their positions so a
  // swap can slide the two tiles toward each other instead of snapping.
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  // The swap in flight: the two ids and how far each must travel. Driven through
  // React state and a CSS transition (no requestAnimationFrame), so it can't get
  // stuck the way an imperative FLIP would if a frame never fires.
  const [sliding, setSliding] = useState<{ a: number; b: number; aShift: XY; bShift: XY } | null>(null);

  const load = useCallback((refresh = false) =>
    apiJson<{ watchlist: WatchItem[] }>(`/api/watchlist${refresh ? "?refresh=1" : ""}`).then((d) => setItems(d.watchlist)), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!symbol.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    setBusy(false);
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    setSymbol("");
    load();
  };

  /** Dieselbe Reihenfolge wie im Backend (pinned DESC, sort_order). */
  const sorted = (list: WatchItem[]) =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || list.indexOf(a) - list.indexOf(b));

  /**
   * Swap two tiles.
   *
   * Within the same group only: pinned tiles always sort first, so swapping
   * across the boundary would leave the dragged tile where it was and only make
   * the other one jump — which reads as broken.
   */
  const swap = async (srcId: number, targetId: number) => {
    if (!items || srcId === targetId) return;
    const src = items.find((i) => i.id === srcId);
    const target = items.find((i) => i.id === targetId);
    if (!src || !target || src.pinned !== target.pinned) return;

    // Slide the two tiles toward each other first, then commit the reorder.
    // Both cells stay occupied throughout (only a transform moves), so nothing
    // reflows and the page is never reloaded.
    const ra = cardRefs.current.get(srcId)?.getBoundingClientRect();
    const rb = cardRefs.current.get(targetId)?.getBoundingClientRect();
    if (ra && rb) {
      setSliding({
        a: srcId,
        b: targetId,
        aShift: { x: rb.left - ra.left, y: rb.top - ra.top },
        bShift: { x: ra.left - rb.left, y: ra.top - rb.top },
      });
      // After the slide, swap the array (the tiles are now visually in their new
      // cells) and drop the transforms in the same commit — no jump.
      window.setTimeout(() => {
        const next = [...items];
        const a = next.findIndex((i) => i.id === srcId);
        const b = next.findIndex((i) => i.id === targetId);
        [next[a], next[b]] = [next[b], next[a]];
        setItems(next);
        setSliding(null);
      }, SLIDE_MS);
    } else {
      // No measurements (e.g. a tile off-screen) — reorder without the slide.
      const next = [...items];
      const a = next.findIndex((i) => i.id === srcId);
      const b = next.findIndex((i) => i.id === targetId);
      [next[a], next[b]] = [next[b], next[a]];
      setItems(next);
    }

    const order = [...items].map((i) => i.id);
    const ia = order.indexOf(srcId);
    const ib = order.indexOf(targetId);
    [order[ia], order[ib]] = [order[ib], order[ia]];
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
  };

  /* ---------- Pick up, carry, swap ---------- */

  const onDragPointerDown = (e: React.PointerEvent, w: WatchItem) => {
    // Left button / touch / pen only, and never when a control was pressed.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { id: w.id, pinned: w.pinned, startX: e.clientX, startY: e.clientY, engaged: false };
    // Drop the price hover card the instant the tile is grabbed — before the
    // drag even engages — so it doesn't hang in the air over the moving tile.
    setHovered(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    // Lift only once the pointer has actually travelled — below that it's a click.
    if (!d.engaged) {
      if (Math.hypot(dx, dy) < 6) return;
      d.engaged = true;
      setDrag({ id: d.id, pinned: d.pinned });
      setHovered(null); // the price hover card must not fight the drag
      document.body.style.userSelect = "none";
    }
    setOffset({ dx, dy });

    // The lifted tile has pointer-events:none, so elementFromPoint sees the
    // tile underneath — that is the swap target.
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-watch-id]") as HTMLElement | null;
    const tid = under ? Number(under.dataset.watchId) : null;
    const next = tid && tid !== d.id ? tid : null;
    overIdRef.current = next;
    setOverId(next);
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    const target = overIdRef.current != null ? items?.find((i) => i.id === overIdRef.current) : null;
    if (d?.engaged && target && target.pinned === d.pinned) swap(d.id, target.id);
    overIdRef.current = null;
    setDrag(null);
    setOverId(null);
    setOffset({ dx: 0, dy: 0 });
    document.body.style.userSelect = "";
  };

  const togglePin = async (w: WatchItem) => {
    // Sofort umsortieren und erst danach speichern: Ein Pin ist eine winzige
    // Änderung, auf die man nicht auf den Server warten möchte. Dieselbe
    // Sortierung wie im Backend, damit das Ergebnis nicht springt.
    setItems((prev) => sorted((prev ?? []).map((i) => (i.id === w.id ? { ...i, pinned: !i.pinned } : i))));
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, pinned: !w.pinned }),
    });
  };

  const remove = async (id: number) => {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    load();
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  if (!items) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Watchlist …")}</div>;
  }

  const withQuotes = items.filter((i) => i.quote);
  const gainers = withQuotes.filter((i) => (i.quote!.changePct ?? 0) > 0).length;
  const losers = withQuotes.filter((i) => (i.quote!.changePct ?? 0) < 0).length;
  const lastFetch = withQuotes.map((i) => i.quote!.fetchedAt).sort().at(-1);

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Watchlist")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {items.length === 0
              ? t("Live-Kurse via Yahoo Finance · 5-Minuten-Cache")
              : <>
                  {t("{n} Werte", { n: items.length })}
                  {" · "}
                  <span className="text-emerald-soft">{t("{n} im Plus", { n: gainers })}</span>
                  {" · "}
                  <span className="text-rose-soft">{t("{n} im Minus", { n: losers })}</span>
                  {lastFetch && ` · ${t("Stand {time}", { time: fmtDateTime(lastFetch) })}`}
                </>}
          </p>
        </div>
        <Button variant="glass" size="sm" disabled={refreshing || items.length === 0} onClick={refresh}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {t("Kurse aktualisieren")}
        </Button>
      </div>

      <Card className="rise rise-1 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-[200px] flex-1"
            placeholder={t("Symbol, z. B. NVDA, VWCE.DE, BTC-EUR, ^GSPC")}
            value={symbol}
            onChange={(e) => { setSymbol(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button disabled={busy || !symbol.trim()} onClick={add}>
            {busy ? t("Prüfe …") : <><Plus className="h-4 w-4" /> {t("Hinzufügen")}</>}
          </Button>
        </div>
        {error && <div className="mt-2 text-xs text-rose-soft">{error}</div>}
      </Card>

      {items.length === 0 ? (
        <Card className="rise rise-2 flex flex-col items-center gap-4 p-14 text-center">
          <Eye className="h-10 w-10 text-sky-soft/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">
            {t("Noch leer — füge Symbole hinzu, um Kurse zu beobachten (Yahoo-Format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).")}
          </p>
        </Card>
      ) : (
        // auto-fill statt fester Spalten je Breakpoint: Das Raster legt so viele
        // Spalten an, wie bei mindestens 300px Kachelbreite hineinpassen, und
        // verteilt den Rest. Damit stimmt es auf jeder Fensterbreite, auch auf
        // Größen, für die ich sonst einen Breakpoint hätte raten müssen.
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {items.map((w, i) => {
            const q = w.quote;
            const dayUp = (q?.changePct ?? 0) >= 0;
            const dayColor = dayUp ? "#34d399" : "#fb7185";
            const sinceUp = (w.since?.pct ?? 0) >= 0;
            const sinceColor = sinceUp ? "#34d399" : "#fb7185";

            const lifted = drag?.id === w.id;
            // A valid drop target: under the pointer, not itself, same group.
            const isTarget = overId === w.id && drag != null && drag.id !== w.id && drag.pinned === w.pinned;
            // Mid-swap slide: this tile travels toward the other one's slot.
            const slide = sliding ? (sliding.a === w.id ? sliding.aShift : sliding.b === w.id ? sliding.bShift : null) : null;

            return (
              <Card
                key={w.id}
                ref={(el: HTMLDivElement | null) => {
                  if (el) cardRefs.current.set(w.id, el);
                  else cardRefs.current.delete(w.id);
                }}
                data-watch-id={w.id}
                onPointerDown={(e) => onDragPointerDown(e, w)}
                onPointerMove={onDragPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  touchAction: "none",
                  ...(lifted
                    ? {
                        // Carried in hand: follow the pointer 1:1, scale up, a
                        // touch of tilt, and lift above everything. transition
                        // is off so it tracks without lag; pointer-events off so
                        // elementFromPoint can see the tile beneath.
                        transform: `translate(${offset.dx}px, ${offset.dy}px) scale(1.05) rotate(1.2deg)`,
                        zIndex: 50,
                        position: "relative",
                        transition: "none",
                        pointerEvents: "none",
                        boxShadow: "0 30px 60px -12px rgba(0,0,0,0.75)",
                        cursor: "grabbing",
                        willChange: "transform",
                      }
                    : slide
                    ? {
                        // Sliding to the other tile's slot over SLIDE_MS, then the
                        // array reorder lands it there and this transform is cleared
                        // in the same commit — so it never jumps.
                        transform: `translate(${slide.x}px, ${slide.y}px)`,
                        transition: `transform ${SLIDE_MS}ms cubic-bezier(0.22,1,0.36,1)`,
                        zIndex: 10,
                        position: "relative",
                      }
                    : {
                        // Everyone else eases — the target's react and the origin
                        // slot sits empty as the "make room" gap.
                        transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.2s ease",
                        transform: isTarget ? "scale(0.96)" : undefined,
                      }),
                }}
                // Once the entrance animation ends, switch it off for good. A
                // finished `.rise` keeps holding transform:translateY(0), which
                // (animations outrank inline styles) would block the drag/FLIP
                // transform — and toggling a class off to free it would restart
                // the animation on every drop, making the whole grid replay its
                // entrance like a reload. Disabling it once avoids both.
                onAnimationEnd={(e) => { (e.currentTarget as HTMLElement).style.animation = "none"; }}
                className={cn(
                  "glass-hover rise group cursor-grab p-5 select-none active:cursor-grabbing", `rise-${(i % 5) + 1}`,
                  w.pinned && "border-gold/25",
                  isTarget && "border-gold/60 ring-2 ring-gold/40",
                )}
                // Update hovered on every move, not just enter — with fast tile
                // changes the enter event can be skipped and the card would keep
                // showing the previous symbol. Suppressed while dragging.
                // Also suppress while a tile is grabbed but not yet engaged
                // (dragRef set, drag state still null) — otherwise a move within
                // the threshold would bring the card back mid-grab.
                onMouseEnter={(e) => { if (!drag && !dragRef.current) { setHovered(w); setCursor({ x: e.clientX, y: e.clientY }); } }}
                onMouseMove={(e) => { if (!drag && !dragRef.current) { setHovered(w); setCursor({ x: e.clientX, y: e.clientY }); } }}
                onMouseLeave={() => { setHovered((prev) => (prev?.id === w.id ? null : prev)); setCursor(null); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{w.label || q?.name || w.symbol}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-2">
                      <span className="num">{w.symbol}</span>
                      {q?.stale && <span className="text-amber-400">{t("letzter bekannter Kurs")}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {/* Sichtbarer Anfasser: Dass eine Kachel ziehbar ist, sieht
                        man ihr sonst nicht an. */}
                    {/* Affordance only — the whole tile is draggable now. */}
                    <span className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all group-hover:opacity-100" title={t("Ziehen zum Tauschen")}>
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    {/* Angepinnt bleibt sichtbar — sonst wäre nicht erkennbar,
                        warum eine Kachel vorn steht. */}
                    <button
                      onClick={() => togglePin(w)}
                      className={cn(
                        "rounded-lg p-1.5 transition-all cursor-pointer",
                        w.pinned
                          ? "text-gold hover:bg-gold/10"
                          : "text-muted-2 opacity-0 hover:bg-white/5 hover:text-foreground group-hover:opacity-100"
                      )}
                      title={w.pinned ? t("Nicht mehr anpinnen") : t("Anpinnen")}
                    >
                      <Pin className={cn("h-3.5 w-3.5", w.pinned && "fill-current")} />
                    </button>
                    <button
                      onClick={() => remove(w.id)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-rose-soft/10 hover:text-rose-soft group-hover:opacity-100 cursor-pointer"
                      title={t("Entfernen")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {q ? (
                  <>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="num text-2xl font-semibold tracking-tight">
                          {fmtNum(q.price)} <span className="text-sm font-normal text-muted-2">{q.currency}</span>
                        </div>
                        {/* Umgerechnet nur zeigen, wenn der Kurs nicht ohnehin
                            schon in der Anzeigewährung notiert — sonst stünde
                            derselbe Betrag zweimal untereinander. */}
                        {q.priceEur !== null && q.currency !== displayCurrency() && (
                          <div className="num mt-0.5 text-xs text-muted-2">{fmtEUR(q.priceEur)}</div>
                        )}
                      </div>
                      {q.changePct !== null && (
                        <div
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold"
                          style={{ background: `${dayColor}14`, border: `1px solid ${dayColor}30`, color: dayColor }}
                          title={t("Veränderung heute")}
                        >
                          {dayUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          <span className="num">{fmtPct(q.changePct)}</span>
                        </div>
                      )}
                    </div>

                    {/* Zuwachs seit Aufnahme */}
                    <div className="hairline my-3" />
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-2">
                        <CalendarPlus className="h-3 w-3" />
                        {t("seit {date}", { date: fmtDate(w.added_at) })}
                      </span>
                      {w.since ? (
                        <span className="num font-semibold" style={{ color: sinceColor }}>
                          {fmtPct(w.since.pct)}
                          <span className="ml-1.5 font-normal opacity-75">
                            ({w.since.abs >= 0 ? "+" : ""}{fmtNum(w.since.abs)} {w.since.currency})
                          </span>
                        </span>
                      ) : (
                        // Vor der Einstandskurs-Erfassung hinzugefügt — ehrlich
                        // benennen statt 0 % zu behaupten
                        <span className="text-muted-2">{t("kein Einstandskurs erfasst")}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 text-xs text-muted-2">{t("kein Kurs")}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {hovered?.quote && !drag && (
        <QuoteHoverCard
          key={hovered.symbol}
          symbol={hovered.symbol}
          name={hovered.label || hovered.quote.name || hovered.symbol}
          currency={hovered.quote.currency}
          cursor={cursor}
        />
      )}
    </div>
  );
}
