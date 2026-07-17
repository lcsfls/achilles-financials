"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, TrendingUp, Pencil, RefreshCw, Upload, AlertTriangle, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR, fmtEUR0, fmtPct, fmtNum } from "@/lib/utils";

type ImportResult = {
  inserted: number; updated: number;
  skipped?: number;
  /** Nur beim CSV-Import gesetzt — der Depotabruf hat kein Dateiformat. */
  mode?: "positions" | "transactions";
  detected?: { delimiter: string; headerRow: number; mapping: Record<string, string> };
  convertedFrom: string[];
  noQuoteSymbols: string[];
  withoutCostBasis: string[];
  /** Nur beim FinTS-Abruf. */
  depots?: number;
};

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

export default function InvestmentsPage() {
  const { t } = useI18n();
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [priceEdit, setPriceEdit] = useState<{ id: number; value: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fintsAvailable, setFintsAvailable] = useState(false);

  const load = () => apiJson<{ investments: Inv[] }>("/api/investments").then((d) => setInvs(d.investments));
  useEffect(() => { load(); }, []);
  // Den Depotabruf nur zeigen, wenn FinTS eingerichtet ist — ein Knopf, der
  // sicher scheitert, ist keine Funktion.
  useEffect(() => {
    apiJson<{ available: boolean }>("/api/investments/fints").then((d) => setFintsAvailable(d.available)).catch(() => {});
  }, []);

  const refreshPrices = async () => {
    setRefreshing(true);
    setRefreshInfo(null);
    const res = await fetch("/api/investments/refresh", { method: "POST" });
    const d = await res.json();
    await load();
    setRefreshing(false);
    setRefreshInfo(t("{n} Kurse aktualisiert", { n: d.updated }));
    setTimeout(() => setRefreshInfo(null), 5000);
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const res = await fetch("/api/import/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: await file.text() }),
    });
    const d = await res.json();
    setImporting(false);
    if (!res.ok) { setImportError(t(d.error)); return; }
    setImportResult(d);
    load();
  };

  const fetchFints = async () => {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const res = await fetch("/api/investments/fints", { method: "POST" });
    const d = await res.json();
    setImporting(false);
    if (!res.ok) { setImportError(t(d.error)); return; }
    setImportResult(d);
    load();
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
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }}
          />
          <Button variant="glass" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> {importing ? t("Importiere …") : t("CSV importieren")}
          </Button>
          {fintsAvailable && (
            <Button variant="glass" size="sm" disabled={importing} onClick={fetchFints}>
              <Landmark className="h-3.5 w-3.5" /> {t("Depot abrufen")}
            </Button>
          )}
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

      {/* Import-Ergebnis */}
      <Dialog open={Boolean(importResult || importError)} onOpenChange={() => { setImportResult(null); setImportError(null); }}>
        <DialogContent>
          <DialogTitle>{importError ? t("Import fehlgeschlagen") : t("CSV importiert")}</DialogTitle>
          {importError ? (
            <DialogDescription>{importError}</DialogDescription>
          ) : importResult ? (
            <>
              <DialogDescription>
                {importResult.depots !== undefined
                  ? t("{n} Depot(s) über FinTS abgerufen.", { n: importResult.depots })
                  : importResult.mode === "transactions"
                    ? t("Orderliste erkannt — Käufe und Verkäufe wurden zu Positionen verrechnet.")
                    : t("Bestandsliste erkannt.")}
              </DialogDescription>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { n: importResult.inserted, label: t("neu") },
                  { n: importResult.updated, label: t("aktualisiert") },
                  { n: importResult.skipped ?? 0, label: t("übersprungen") },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl border border-white/10 px-3 py-2.5">
                    <div className="num text-xl font-semibold">{x.n}</div>
                    <div className="text-[11px] text-muted-2">{x.label}</div>
                  </div>
                ))}
              </div>

              {importResult.convertedFrom.length > 0 && (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="text-xs text-muted">
                    {t("Beträge in {cur} wurden zum heutigen Kurs in Euro umgerechnet. Für aktuelle Kurse stimmt das — der Einstand eines älteren Kaufs wird dadurch aber falsch, weil im Export kein historischer Wechselkurs steht. Prüfe diese Positionen.", { cur: importResult.convertedFrom.join(", ") })}
                  </div>
                </div>
              )}

              {importResult.noQuoteSymbols.length > 0 && (
                <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="text-xs text-muted">
                    {t("{sym} sind WKN oder ISIN. Der Kursabruf läuft über Yahoo Finance, das nur Kürzel kennt — „Kurse aktualisieren“ lässt diese Positionen aus. Trage das Yahoo-Symbol nach (z. B. AAPL statt 865985).", { sym: importResult.noQuoteSymbols.join(", ") })}
                  </div>
                </div>
              )}

              {importResult.withoutCostBasis.length > 0 && (
                <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="text-xs text-muted">
                    {t("Für {n} keinen Einstandskurs erhalten — als Platzhalter steht dort der aktuelle Kurs, die Wertentwicklung zeigt deshalb 0 %. Bitte den echten Kaufkurs nachtragen.", { n: importResult.withoutCostBasis.join(", ") })}
                  </div>
                </div>
              )}

              {/* Erkannte Zuordnung offenlegen, damit ein unbekannter Export
                  überprüfbar ist statt nur geglaubt werden zu müssen */}
              {importResult.detected && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-2">{t("Erkannte Spalten")}</div>
                <div className="mt-1.5 space-y-1">
                  {Object.entries(importResult.detected!.mapping).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-xs">
                      <span className="text-muted-2">{k}</span>
                      <span className="num truncate text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
