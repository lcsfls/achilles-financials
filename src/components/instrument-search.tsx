"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isIsin, type Hit } from "@/lib/search";

/**
 * Search field for instruments, by name, ticker or ISIN.
 *
 * ISIN is what a European fact sheet actually prints — the Yahoo ticker rarely
 * appears anywhere the user would look. Typing IE00BK5BQT80 has to work; the
 * ticker is then resolved here rather than looked up by hand.
 */
export function InstrumentSearch({
  value,
  onChange,
  onPick,
  onSubmit,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called with the resolved ticker when a hit is chosen. */
  onPick: (symbol: string) => void;
  /** Enter without a selected hit — take the raw input as a ticker. */
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setHits([]); setLoading(false); return; }

    // Debounced, and every response checks whether it is still the current
    // query — otherwise a slow early request can overwrite a newer result.
    let current = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { hits?: Hit[] };
        if (!current) return;
        setHits(data.hits ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        if (current) setHits([]);
      } finally {
        if (current) setLoading(false);
      }
    }, 280);

    return () => { current = false; clearTimeout(timer); };
  }, [value]);

  // Close on an outside click — the list overlays the tiles below it
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (hit: Hit) => {
    setOpen(false);
    setHits([]);
    onPick(hit.symbol);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) {
      if (e.key === "Enter") onSubmit?.();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const looksLikeIsin = isIsin(value);

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
        <Input
          className="pl-10"
          placeholder={placeholder ?? t("Name, Symbol oder ISIN — z. B. VWCE.DE oder IE00BK5BQT80")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-2" />}
      </div>

      {open && (hits.length > 0 || (!loading && value.trim().length >= 2)) && (
        <div className="absolute z-[100] mt-2 w-full overflow-hidden rounded-xl border border-white/12 bg-[#0c0e14]/95 shadow-2xl backdrop-blur-xl">
          {looksLikeIsin && (
            <div className="border-b border-white/[0.06] px-4 py-2 text-[11px] text-muted-2">
              {t("ISIN erkannt — handelbare Börsenplätze zuerst")}
            </div>
          )}
          {hits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-2">{t("Nichts gefunden")}</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.symbol}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors",
                  i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{h.name}</div>
                  <div className="text-xs text-muted-2">
                    {h.symbol}
                    {h.exchange && ` · ${h.exchange}`}
                  </div>
                </div>
                {h.type && (
                  <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-2">
                    {h.type}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
