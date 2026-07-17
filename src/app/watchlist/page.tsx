"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Eye, RefreshCw, TrendingUp, TrendingDown, CalendarPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteHoverCard } from "@/components/quote-hover-card";
import { useI18n } from "@/lib/i18n";
import { cn, displayCurrency, fmtEUR, fmtNum, fmtPct, fmtDate, fmtDateTime } from "@/lib/utils";

type WatchItem = {
  id: number; symbol: string; label: string | null; added_at: string;
  priceAtAdd: number | null; priceEurAtAdd: number | null; currencyAtAdd: string | null;
  quote: {
    name: string | null; price: number; prevClose: number | null; changePct: number | null;
    currency: string; priceEur: number | null; fetchedAt: string; stale: boolean;
  } | null;
  since: { pct: number; abs: number; currency: string } | null;
};

export default function WatchlistPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<WatchItem | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const load = useCallback((refresh = false) =>
    fetch(`/api/watchlist${refresh ? "?refresh=1" : ""}`).then((r) => r.json()).then((d) => setItems(d.watchlist)), []);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((w, i) => {
            const q = w.quote;
            const dayUp = (q?.changePct ?? 0) >= 0;
            const dayColor = dayUp ? "#34d399" : "#fb7185";
            const sinceUp = (w.since?.pct ?? 0) >= 0;
            const sinceColor = sinceUp ? "#34d399" : "#fb7185";

            return (
              <Card
                key={w.id}
                className={cn("glass-hover rise group p-5", `rise-${(i % 5) + 1}`)}
                // hovered auch bei jeder Bewegung setzen, nicht nur bei Enter:
                // bleibt das Enter-Event aus (schneller Wechsel, synthetische
                // Events), zeigte die Karte sonst den vorigen Wert weiter.
                onMouseEnter={(e) => { setHovered(w); setCursor({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => { setHovered(w); setCursor({ x: e.clientX, y: e.clientY }); }}
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
                  <button
                    onClick={() => remove(w.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-rose-soft/10 hover:text-rose-soft group-hover:opacity-100 cursor-pointer"
                    title={t("Entfernen")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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

      {hovered?.quote && (
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
