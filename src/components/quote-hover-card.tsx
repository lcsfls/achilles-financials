"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { useI18n } from "@/lib/i18n";
import { fmtNum, fmtPct } from "@/lib/utils";

type Point = { t: number; c: number };

const CARD_W = 300;
const CARD_H = 210;
const OFFSET = 16;

/**
 * Kursverlauf-Karte, die am Cursor klebt.
 *
 * Bewusst per Portal an den Body: In der Karte selbst säße sie im
 * overflow-Kontext der Kachel und würde abgeschnitten. Position wird an den
 * Viewport-Rändern gespiegelt, damit sie nie halb draußen hängt.
 */
export function QuoteHoverCard({
  symbol, name, cursor, currency,
}: {
  symbol: string;
  name: string;
  cursor: { x: number; y: number } | null;
  currency: string;
}) {
  const { t } = useI18n();
  const [points, setPoints] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Symbolwechsel: alten Verlauf verwerfen. Ohne das zeigte die Karte den
  // Chart des zuvor überfahrenen Werts weiter — mit neuem Namen und neuer
  // Währung beschriftet, also falsche Kurse als richtige ausgegeben.
  useEffect(() => {
    setPoints(null);
    setFailed(false);
  }, [symbol]);

  useEffect(() => {
    if (!cursor || points || failed) return;
    let cancelled = false;
    fetch(`/api/watchlist/history?symbol=${encodeURIComponent(symbol)}&range=6mo`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setPoints(d.points); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [cursor, symbol, points, failed]);

  if (!mounted || !cursor) return null;

  // An den Rändern spiegeln statt überlaufen zu lassen
  const flipX = cursor.x + OFFSET + CARD_W > window.innerWidth;
  const flipY = cursor.y + OFFSET + CARD_H > window.innerHeight;
  const left = flipX ? cursor.x - CARD_W - OFFSET : cursor.x + OFFSET;
  const top = flipY ? Math.max(8, cursor.y - CARD_H - OFFSET) : cursor.y + OFFSET;

  const first = points?.[0]?.c;
  const last = points?.[points.length - 1]?.c;
  const changePct = first && last ? ((last - first) / first) * 100 : null;
  const up = (changePct ?? 0) >= 0;
  const color = up ? "#34d399" : "#fb7185";

  return createPortal(
    <div
      className="glass-float pointer-events-none fixed z-[100] rounded-glass p-4"
      style={{ left, top, width: CARD_W }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="num text-[10px] text-muted-2">{symbol}</div>
        </div>
        {changePct !== null && (
          <div className="num shrink-0 text-xs font-semibold" style={{ color }}>
            {fmtPct(changePct)}
          </div>
        )}
      </div>

      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-2">{t("6 Monate")}</div>

      <div className="mt-2 h-[120px]">
        {points ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`hover-${symbol.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Skala eng an den Daten — sonst wirkt jede Bewegung flach */}
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Area
                type="monotone"
                dataKey="c"
                stroke={color}
                strokeWidth={1.8}
                fill={`url(#hover-${symbol.replace(/[^a-z0-9]/gi, "")})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-2">
            {failed ? t("Kein Verlauf verfügbar") : <span className="animate-pulse">{t("Lade Verlauf …")}</span>}
          </div>
        )}
      </div>

      {points && first && last && (
        <div className="mt-1 flex justify-between text-[10px] text-muted-2">
          <span className="num">{fmtNum(first)} {currency}</span>
          <span className="num" style={{ color }}>{fmtNum(last)} {currency}</span>
        </div>
      )}
    </div>,
    document.body
  );
}
