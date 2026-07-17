"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Gem } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn, fmtEUR, fmtEUR0, fmtGrams, fmtDate, fmtPct } from "@/lib/utils";

type Lot = {
  id: number; grams: number; purchase_price_eur: number; purchase_date: string;
  vendor: string | null; note: string | null; currentValue: number | null; pl: number | null; plPct: number | null;
};
type Holding = {
  metal: string; name: string; color: string; totalGrams: number; totalCost: number;
  currentValue: number | null; eurPerGram: number | null; lots: Lot[];
};
type Spot = { symbol: string; name: string; eurPerGram: number; fetchedAt: string; stale: boolean };
type Data = { holdings: Holding[]; spot: Spot[]; totalValue: number; totalCost: number };

const EMPTY_FORM = { metal: "XAU", grams: "", purchase_price_eur: "", purchase_date: new Date().toISOString().slice(0, 10), vendor: "", note: "" };

export default function MetalsPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) =>
    fetch(`/api/metals${refresh ? "?refresh=1" : ""}`).then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    const res = await fetch("/api/metals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        grams: parseFloat(form.grams.replace(",", ".")),
        purchase_price_eur: parseFloat(form.purchase_price_eur.replace(",", ".")),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } else {
      alert((await res.json()).error || t("Fehler beim Speichern"));
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t("Diesen Kauf wirklich löschen?"))) return;
    await fetch(`/api/metals?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!data) return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Edelmetalle …")}</div>;

  const totalPL = data.totalValue - data.totalCost;

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Edelmetalle")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {t("Bestand")} <span className="num text-foreground">{fmtEUR0(data.totalValue)}</span> · {t("Einstand")} <span className="num">{fmtEUR0(data.totalCost)}</span> ·{" "}
            <span style={{ color: totalPL >= 0 ? "#34d399" : "#fb7185" }}>
              {totalPL >= 0 ? "+" : ""}{fmtEUR0(totalPL)} ({data.totalCost > 0 ? fmtPct((totalPL / data.totalCost) * 100) : "—"})
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" size="sm" disabled={refreshing} onClick={async () => { setRefreshing(true); await load(true); setRefreshing(false); }}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {t("Kurse aktualisieren")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> {t("Kauf erfassen")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{t("Edelmetall-Kauf erfassen")}</DialogTitle>
              <DialogDescription>{t("Jeder Kauf wird als eigene Position (Lot) mit Einstandspreis geführt.")}</DialogDescription>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>{t("Metall")}</Label>
                  <Select value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })}>
                    <option value="XAU">{t("Gold")}</option>
                    <option value="XAG">{t("Silber")}</option>
                    <option value="XPT">{t("Platin")}</option>
                    <option value="XPD">{t("Palladium")}</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Gewicht (Gramm)")}</Label>
                  <Input inputMode="decimal" placeholder="31,1" value={form.grams} onChange={(e) => setForm({ ...form, grams: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Kaufpreis gesamt (€)")}</Label>
                  <Input inputMode="decimal" placeholder="2350,00" value={form.purchase_price_eur} onChange={(e) => setForm({ ...form, purchase_price_eur: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Kaufdatum")}</Label>
                  <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Händler (optional)")}</Label>
                  <Input placeholder="Philoro, Degussa …" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>{t("Notiz (optional)")}</Label>
                  <Input placeholder={t("1 oz Krügerrand")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
              <Button className="mt-6 w-full" disabled={saving} onClick={submit}>
                {saving ? t("Speichern …") : t("Kauf speichern")}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Spot prices */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {data.spot.map((s, i) => (
          <Card key={s.symbol} className={cn("glass-hover rise p-5", `rise-${i + 1}`)}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">{t(s.name)} · {t("Spot")}</div>
            <div className="num mt-1.5 text-xl font-semibold">
              {fmtEUR(s.eurPerGram)}<span className="text-xs font-normal text-muted-2"> / g</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-2">
              {s.stale ? t("⚠ letzter bekannter Kurs") : t("Stand {time}", { time: new Date(s.fetchedAt).toLocaleTimeString(lang === "de" ? "de-DE" : "en-US", { hour: "2-digit", minute: "2-digit" }) })}
            </div>
          </Card>
        ))}
        {data.spot.length === 0 && (
          <Card className="col-span-full p-5 text-sm text-muted-2">{t("Spotpreise derzeit nicht verfügbar — Kurse werden automatisch nachgeladen.")}</Card>
        )}
      </div>

      {/* Holdings */}
      {data.holdings.length === 0 ? (
        <Card className="rise rise-2 flex flex-col items-center gap-4 p-14 text-center">
          <Gem className="h-10 w-10 text-gold/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">
            {t("Noch keine Bestände. Erfasse deinen ersten Kauf — Gold, Silber, Platin oder Palladium — mit Gewicht und Einstandspreis.")}
          </p>
        </Card>
      ) : (
        data.holdings.map((h, hi) => (
          <Card key={h.metal} className={cn("rise overflow-hidden", `rise-${hi + 2}`)}>
            <CardHeader className="flex-row items-center justify-between border-b border-white/[0.05] pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${h.color}14`, border: `1px solid ${h.color}30` }}>
                  <Gem className="h-5 w-5" style={{ color: h.color }} strokeWidth={1.6} />
                </span>
                <div>
                  <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">{t(h.name)}</CardTitle>
                  <div className="text-xs text-muted-2">
                    {fmtGrams(h.totalGrams)} · {h.eurPerGram !== null ? `${fmtEUR(h.eurPerGram)}/g` : t("kein Kurs")}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="num text-lg font-semibold">{h.currentValue !== null ? fmtEUR(h.currentValue) : "—"}</div>
                {h.currentValue !== null && (
                  <div className="text-xs" style={{ color: h.currentValue - h.totalCost >= 0 ? "#34d399" : "#fb7185" }}>
                    {h.currentValue - h.totalCost >= 0 ? "+" : ""}{fmtEUR(h.currentValue - h.totalCost)} · {fmtPct(((h.currentValue - h.totalCost) / h.totalCost) * 100)}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-2">
                    <th className="px-6 py-3 font-medium">{t("Kaufdatum")}</th>
                    <th className="px-4 py-3 font-medium">{t("Gewicht")}</th>
                    <th className="px-4 py-3 font-medium">{t("Einstand")}</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">{t("Einstand / g")}</th>
                    <th className="px-4 py-3 font-medium">{t("Aktueller Wert")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("G/V")}</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">{t("Händler / Notiz")}</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {h.lots.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-6 py-3.5">{fmtDate(l.purchase_date)}</td>
                      <td className="num px-4 py-3.5">{fmtGrams(l.grams)}</td>
                      <td className="num px-4 py-3.5">{fmtEUR(l.purchase_price_eur)}</td>
                      <td className="num hidden px-4 py-3.5 text-muted md:table-cell">{fmtEUR(l.purchase_price_eur / l.grams)}</td>
                      <td className="num px-4 py-3.5 font-medium">{l.currentValue !== null ? fmtEUR(l.currentValue) : "—"}</td>
                      <td className="num px-4 py-3.5 text-right font-medium" style={{ color: (l.pl ?? 0) >= 0 ? "#34d399" : "#fb7185" }}>
                        {l.pl !== null ? `${l.pl >= 0 ? "+" : ""}${fmtEUR(l.pl)}` : "—"}
                        {l.plPct !== null && <span className="ml-1.5 text-[11px] opacity-75">({fmtPct(l.plPct)})</span>}
                      </td>
                      <td className="hidden max-w-[200px] truncate px-4 py-3.5 text-xs text-muted-2 lg:table-cell">
                        {[l.vendor, l.note].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        <button onClick={() => remove(l.id)} className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft cursor-pointer" title={t("Löschen")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
