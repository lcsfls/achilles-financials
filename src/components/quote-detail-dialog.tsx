"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, CalendarPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChartTooltip } from "@/components/chart-tooltip";
import { useI18n } from "@/lib/i18n";
import { cn, displayCurrency, fmtEUR, fmtNum, fmtPct, fmtDate, fmtDateTime } from "@/lib/utils";

type Point = { t: number; c: number };

export type DetailItem = {
  id: number; symbol: string; label: string | null; added_at: string;
  quote: {
    name: string | null; price: number; prevClose: number | null; changePct: number | null;
    currency: string; priceEur: number | null; fetchedAt: string; stale: boolean;
  } | null;
  since: { pct: number; abs: number; currency: string } | null;
};

/** Selectable ranges — the labels stay short so they fit on a phone. */
const RANGES = [
  { key: "1d", label: "1T", en: "1D" },
  { key: "5d", label: "1W", en: "1W" },
  { key: "1mo", label: "1M", en: "1M" },
  { key: "6mo", label: "6M", en: "6M" },
  { key: "1y", label: "1J", en: "1Y" },
  { key: "5y", label: "5J", en: "5Y" },
] as const;

export function QuoteDetailDialog({
  item, open, onOpenChange,
}: {
  item: DetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<string>("6mo");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);

  // A new symbol must not show the previous one's chart — reset before loading.
  useEffect(() => {
    setPoints(null);
    setFailed(false);
  }, [item?.symbol, range]);

  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    fetch(`/api/watchlist/history?symbol=${encodeURIComponent(item.symbol)}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setPoints(d.points); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, item, range]);

  // Reopening on another tile should start from the default range again.
  useEffect(() => { if (open) setRange("6mo"); }, [open, item?.symbol]);

  if (!item) return null;
  const q = item.quote;

  const first = points?.[0]?.c;
  const last = points?.[points.length - 1]?.c;
  // Change over the *selected* range — not the daily change, which is separate.
  const rangePct = first && last ? ((last - first) / first) * 100 : null;
  const up = (rangePct ?? 0) >= 0;
  const color = up ? "#34d399" : "#fb7185";
  const gid = `detail-${item.symbol.replace(/[^a-z0-9]/gi, "")}`;

  // Intraday ranges want a time, longer ones a date.
  const intraday = range === "1d" || range === "5d";
  const fmtAxis = (ms: number) =>
    intraday
      ? new Date(ms).toLocaleTimeString(lang === "de" ? "de-DE" : "en-US", { hour: "2-digit", minute: "2-digit" })
      : new Date(ms).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="flex flex-wrap items-baseline gap-x-3">
          <span>{item.label || q?.name || item.symbol}</span>
          <span className="num text-xs font-normal text-muted-2">{item.symbol}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">{t("Kursdetails und Verlauf")}</DialogDescription>

        {/* Price header */}
        {q && (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="num text-3xl font-semibold tracking-tight">
                {fmtNum(q.price)} <span className="text-base font-normal text-muted-2">{q.currency}</span>
              </div>
              {q.priceEur !== null && q.currency !== displayCurrency() && (
                <div className="num mt-0.5 text-xs text-muted-2">{fmtEUR(q.priceEur)}</div>
              )}
            </div>
            {q.changePct !== null && (
              <div
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                style={{
                  background: `${(q.changePct >= 0 ? "#34d399" : "#fb7185")}14`,
                  border: `1px solid ${(q.changePct >= 0 ? "#34d399" : "#fb7185")}30`,
                  color: q.changePct >= 0 ? "#34d399" : "#fb7185",
                }}
                title={t("Veränderung heute")}
              >
                {q.changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="num">{fmtPct(q.changePct)}</span>
                <span className="text-[11px] font-normal opacity-75">{t("heute")}</span>
              </div>
            )}
          </div>
        )}

        {/* Range switcher */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                range === r.key
                  ? "border-gold/40 bg-gold/10 text-gold-bright"
                  : "border-white/10 text-muted hover:border-white/20 hover:text-foreground"
              )}
            >
              {lang === "de" ? r.label : r.en}
            </button>
          ))}
          {/* The range's own change, so the buttons mean something */}
          {rangePct !== null && (
            <span className="num ml-auto self-center text-sm font-semibold" style={{ color }}>
              {fmtPct(rangePct)}
            </span>
          )}
        </div>

        <div className="mt-3 h-[280px]">
          {points && points.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="t"
                  tickFormatter={fmtAxis}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                  dy={8}
                  tick={{ fontSize: 11 }}
                />
                {/* Scale tight to the data — otherwise every move looks flat */}
                <YAxis domain={["dataMin", "dataMax"]} axisLine={false} tickLine={false} width={56} tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtNum(v, 0)} />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Point | undefined;
                    return (
                      <ChartTooltip active={active && Boolean(p)} width={190} height={80}>
                        <div className="mb-1 text-muted">{p ? fmtDateTime(new Date(p.t).toISOString()) : ""}</div>
                        <div className="num text-sm font-semibold">
                          {p ? fmtNum(p.c) : ""} <span className="text-xs font-normal text-muted-2">{q?.currency}</span>
                        </div>
                      </ChartTooltip>
                    );
                  }}
                />
                <Area type="monotone" dataKey="c" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-2">
              {failed
                ? t("Kein Verlauf für diesen Zeitraum verfügbar.")
                : <span className="animate-pulse">{t("Lade Verlauf …")}</span>}
            </div>
          )}
        </div>

        {/* Facts that belong to the position, not the market */}
        <div className="hairline my-4" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Auf der Watchlist seit")}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <CalendarPlus className="h-3 w-3 text-muted-2" />
              {fmtDate(item.added_at)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Seit Aufnahme")}</div>
            <div className="mt-0.5">
              {item.since ? (
                <span className="num font-semibold" style={{ color: item.since.pct >= 0 ? "#34d399" : "#fb7185" }}>
                  {fmtPct(item.since.pct)}
                  <span className="ml-1.5 font-normal text-muted-2">
                    ({item.since.abs >= 0 ? "+" : ""}{fmtNum(item.since.abs)} {item.since.currency})
                  </span>
                </span>
              ) : (
                // Added before entry prices were recorded — say so rather than claim 0 %
                <span className="text-muted-2">{t("kein Einstandskurs erfasst")}</span>
              )}
            </div>
          </div>
          {q && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Kurs von")}</div>
              <div className="mt-0.5 text-muted">
                {fmtDateTime(q.fetchedAt)}
                {q.stale && <span className="ml-1.5 text-amber-400">{t("(veraltet)")}</span>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
