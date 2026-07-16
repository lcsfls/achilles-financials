"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, Pencil, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn, fmtEUR, fmtEUR0, fmtPct, fmtNum } from "@/lib/utils";

type Inv = {
  id: number; name: string; symbol: string | null; units: number;
  buy_price_eur: number; current_price_eur: number | null; kind: string; updated_at: string | null;
};

const KIND_LABEL: Record<string, { label: string; color: string }> = {
  stock: { label: "Aktie", color: "#38bdf8" },
  etf: { label: "ETF", color: "#a78bfa" },
  crypto: { label: "Krypto", color: "#fbbf24" },
  other: { label: "Sonstiges", color: "#94a3b8" },
};

const EMPTY = { name: "", symbol: "", units: "", buy_price_eur: "", current_price_eur: "", kind: "etf" };

type WatchItem = {
  id: number; symbol: string; label: string | null;
  quote: { name: string | null; price: number; changePct: number | null; currency: string; priceEur: number | null; stale: boolean } | null;
};

export default function InvestmentsPage() {
  const { t } = useI18n();
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [priceEdit, setPriceEdit] = useState<{ id: number; value: string } | null>(null);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [wlSymbol, setWlSymbol] = useState("");
  const [wlBusy, setWlBusy] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);

  const load = () => fetch("/api/investments").then((r) => r.json()).then((d) => setInvs(d.investments));
  const loadWatchlist = (refresh = false) =>
    fetch(`/api/watchlist${refresh ? "?refresh=1" : ""}`).then((r) => r.json()).then((d) => setWatchlist(d.watchlist));
  useEffect(() => { load(); loadWatchlist(); }, []);

  const refreshPrices = async () => {
    setRefreshing(true);
    setRefreshInfo(null);
    const res = await fetch("/api/investments/refresh", { method: "POST" });
    const d = await res.json();
    await Promise.all([load(), loadWatchlist(true)]);
    setRefreshing(false);
    setRefreshInfo(t("{n} Kurse aktualisiert", { n: d.updated }));
    setTimeout(() => setRefreshInfo(null), 5000);
  };

  const addWatch = async () => {
    if (!wlSymbol.trim()) return;
    setWlBusy(true);
    setWlError(null);
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: wlSymbol }),
    });
    setWlBusy(false);
    if (!res.ok) { setWlError(t((await res.json()).error)); return; }
    setWlSymbol("");
    loadWatchlist();
  };

  const removeWatch = async (id: number) => {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    loadWatchlist();
  };

  const num = (s: string) => parseFloat(s.replace(",", "."));

  const submit = async () => {
    const res = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        symbol: form.symbol || null,
        units: num(form.units),
        buy_price_eur: num(form.buy_price_eur),
        current_price_eur: form.current_price_eur ? num(form.current_price_eur) : null,
        kind: form.kind,
      }),
    });
    if (res.ok) { setOpen(false); setForm(EMPTY); load(); }
    else alert((await res.json()).error || t("Fehler beim Speichern"));
  };

  const savePrice = async () => {
    if (!priceEdit) return;
    await fetch("/api/investments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: priceEdit.id, current_price_eur: num(priceEdit.value) }),
    });
    setPriceEdit(null);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("Position wirklich löschen?"))) return;
    await fetch(`/api/investments?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!invs) return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Investments …")}</div>;

  const totalValue = invs.reduce((s, i) => s + i.units * (i.current_price_eur ?? i.buy_price_eur), 0);
  const totalCost = invs.reduce((s, i) => s + i.units * i.buy_price_eur, 0);
  const pl = totalValue - totalCost;

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Investments")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {t("Depotwert")} <span className="num text-foreground">{fmtEUR0(totalValue)}</span> · {t("Einstand")} <span className="num">{fmtEUR0(totalCost)}</span> ·{" "}
            <span style={{ color: pl >= 0 ? "#34d399" : "#fb7185" }}>
              {pl >= 0 ? "+" : ""}{fmtEUR0(pl)}{totalCost > 0 ? ` (${fmtPct((pl / totalCost) * 100)})` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refreshInfo && <span className="text-xs text-emerald-soft">{refreshInfo}</span>}
          <Button variant="glass" size="sm" disabled={refreshing} onClick={refreshPrices}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {t("Kurse aktualisieren")}
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> {t("Position hinzufügen")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{t("Position hinzufügen")}</DialogTitle>
            <DialogDescription>
              {t("Mit Symbol im Yahoo-Format (AAPL, VWCE.DE, IWDA.AS, BTC-EUR) wird der Kurs über „Kurse aktualisieren“ automatisch gepflegt.")}
            </DialogDescription>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Name")}</Label>
                <Input placeholder="iShares Core MSCI World" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Symbol · Yahoo-Format (optional)")}</Label>
                <Input placeholder="VWCE.DE" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Typ")}</Label>
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="etf">ETF</option>
                  <option value="stock">{t("Aktie")}</option>
                  <option value="crypto">{t("Krypto")}</option>
                  <option value="other">{t("Sonstiges")}</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Anzahl")}</Label>
                <Input inputMode="decimal" placeholder="148" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Kaufkurs / Stück (€)")}</Label>
                <Input inputMode="decimal" placeholder="82,40" value={form.buy_price_eur} onChange={(e) => setForm({ ...form, buy_price_eur: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Aktueller Kurs / Stück (€, optional)")}</Label>
                <Input inputMode="decimal" placeholder="101,20" value={form.current_price_eur} onChange={(e) => setForm({ ...form, current_price_eur: e.target.value })} />
              </div>
            </div>
            <Button className="mt-6 w-full" onClick={submit}>{t("Position speichern")}</Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {invs.length === 0 ? (
        <Card className="rise rise-2 flex flex-col items-center gap-4 p-14 text-center">
          <TrendingUp className="h-10 w-10 text-violet-soft/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">{t("Noch keine Positionen. Füge dein Depot hinzu, um Wertentwicklung und Allokation zu sehen.")}</p>
        </Card>
      ) : (
        <Card className="rise rise-2 overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-2">
                  <th className="px-6 py-4 font-medium">{t("Position")}</th>
                  <th className="px-4 py-4 font-medium">{t("Typ")}</th>
                  <th className="num px-4 py-4 font-medium">{t("Anzahl")}</th>
                  <th className="num hidden px-4 py-4 font-medium md:table-cell">{t("Kaufkurs")}</th>
                  <th className="num px-4 py-4 font-medium">{t("Akt. Kurs")}</th>
                  <th className="num px-4 py-4 font-medium">{t("Wert")}</th>
                  <th className="num px-4 py-4 text-right font-medium">{t("G/V")}</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {invs.map((i) => {
                  const cur = i.current_price_eur ?? i.buy_price_eur;
                  const value = i.units * cur;
                  const cost = i.units * i.buy_price_eur;
                  const ipl = value - cost;
                  const kind = KIND_LABEL[i.kind] ?? KIND_LABEL.other;
                  return (
                    <tr key={i.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-6 py-4">
                        <div className="font-medium">{i.name}</div>
                        {i.symbol && <div className="text-xs text-muted-2">{i.symbol}</div>}
                      </td>
                      <td className="px-4 py-4"><Badge color={kind.color}>{t(kind.label)}</Badge></td>
                      <td className="num px-4 py-4">{fmtNum(i.units, 4)}</td>
                      <td className="num hidden px-4 py-4 text-muted md:table-cell">{fmtEUR(i.buy_price_eur)}</td>
                      <td className="num px-4 py-4">
                        {priceEdit?.id === i.id ? (
                          <Input
                            autoFocus
                            className="h-8 w-28 text-xs"
                            value={priceEdit.value}
                            onChange={(e) => setPriceEdit({ id: i.id, value: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && savePrice()}
                            onBlur={savePrice}
                          />
                        ) : (
                          <button
                            className="group flex cursor-pointer items-center gap-1.5"
                            onClick={() => setPriceEdit({ id: i.id, value: String(cur).replace(".", ",") })}
                            title={t("Kurs bearbeiten")}
                          >
                            {fmtEUR(cur)}
                            <Pencil className="h-3 w-3 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </td>
                      <td className="num px-4 py-4 font-medium">{fmtEUR(value)}</td>
                      <td className={cn("num px-4 py-4 text-right font-medium")} style={{ color: ipl >= 0 ? "#34d399" : "#fb7185" }}>
                        {ipl >= 0 ? "+" : ""}{fmtEUR(ipl)}
                        <span className="ml-1.5 text-[11px] opacity-75">({cost > 0 ? fmtPct((ipl / cost) * 100) : "—"})</span>
                      </td>
                      <td className="px-3 py-4">
                        <button onClick={() => remove(i.id)} className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer" title={t("Löschen")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Watchlist */}
      <Card className="rise rise-3">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-soft/10 border border-sky-soft/20">
              <Eye className="h-5 w-5 text-sky-soft" strokeWidth={1.7} />
            </div>
            <div>
              <div className="text-base font-semibold">{t("Watchlist")}</div>
              <div className="text-xs text-muted-2">{t("Live-Kurse via Yahoo Finance · 5-Minuten-Cache")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Symbol, z. B. NVDA, VWCE.DE")}
              className="h-9 w-56 text-xs"
              value={wlSymbol}
              onChange={(e) => { setWlSymbol(e.target.value); setWlError(null); }}
              onKeyDown={(e) => e.key === "Enter" && addWatch()}
            />
            <Button variant="glass" size="sm" disabled={wlBusy} onClick={addWatch}>
              {wlBusy ? t("Prüfe …") : <><Plus className="h-3.5 w-3.5" /> {t("Hinzufügen")}</>}
            </Button>
          </div>
        </div>
        {wlError && <div className="px-6 pb-2 text-xs text-rose-soft">{wlError}</div>}
        <div className="px-2 pb-3">
          {watchlist.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-2">
              {t("Noch leer — füge Symbole hinzu, um Kurse zu beobachten (Yahoo-Format: AAPL, VWCE.DE, IWDA.AS, BTC-EUR, ^GSPC).")}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {watchlist.map((w) => (
                <div key={w.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{w.label || w.quote?.name || w.symbol}</span>
                      <span className="text-[11px] text-muted-2">{w.symbol}</span>
                      {w.quote?.stale && <span className="text-[10px] text-amber-400">{t("letzter bekannter Kurs")}</span>}
                    </div>
                  </div>
                  {w.quote ? (
                    <>
                      <div className="num text-right text-sm font-semibold">
                        {fmtNum(w.quote.price)} {w.quote.currency}
                        {w.quote.priceEur !== null && w.quote.currency !== "EUR" && (
                          <div className="text-[11px] font-normal text-muted-2">{fmtEUR(w.quote.priceEur)}</div>
                        )}
                      </div>
                      <div
                        className="num w-20 shrink-0 text-right text-sm font-medium"
                        style={{ color: (w.quote.changePct ?? 0) >= 0 ? "#34d399" : "#fb7185" }}
                      >
                        {w.quote.changePct !== null ? fmtPct(w.quote.changePct) : "—"}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-2">{t("kein Kurs")}</span>
                  )}
                  <button onClick={() => removeWatch(w.id)} className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer" title={t("Entfernen")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
