"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Wallet, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/categorize";
import { useI18n } from "@/lib/i18n";
import { apiJson, fmtEUR } from "@/lib/utils";

type Account = {
  id: string; name: string; currency: string; balance: number;
  manual: number; provider: string; tx_count: number;
};

/**
 * Accounts and bookings kept by hand.
 *
 * Without this the app only works for someone whose bank speaks PSD2. A cash
 * box, a building society account, a bank with no API — all of it is entered
 * here. Manual accounts are kept apart from synced ones because a booking
 * written into a synced account would be wiped by the next sync.
 */
export function ManualAccounts({ onChange }: { onChange?: () => void }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [open, setOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const [acc, setAcc] = useState({ name: "", currency: "EUR", balance: "" });
  const [tx, setTx] = useState({
    account_id: "", booking_date: new Date().toISOString().slice(0, 10),
    amount: "", merchant: "", description: "", category: "", sign: "-" as "-" | "+",
  });

  const load = useCallback(
    () => apiJson<{ accounts: Account[] }>("/api/accounts").then((d) => setAccounts(d.accounts)),
    []
  );
  useEffect(() => { load(); }, [load]);

  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const refresh = () => { load(); onChange?.(); };

  const addAccount = async () => {
    setError(null);
    const res = await fetch("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: acc.name, currency: acc.currency, balance: acc.balance ? num(acc.balance) : 0 }),
    });
    if (!res.ok) { setError(t((await res.json()).error || "Fehler beim Speichern")); return; }
    setOpen(false); setAcc({ name: "", currency: "EUR", balance: "" }); refresh();
  };

  const addTx = async () => {
    setError(null);
    // Sign is a separate control: typing a minus is easy to forget, and an
    // expense entered as income is a silent error nobody notices.
    const amount = (tx.sign === "-" ? -1 : 1) * Math.abs(num(tx.amount));
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tx, amount }),
    });
    if (!res.ok) { setError(t((await res.json()).error || "Fehler beim Speichern")); return; }
    setTxOpen(false);
    setTx({ ...tx, amount: "", merchant: "", description: "" });
    refresh();
  };

  const saveBalance = async (id: string) => {
    await fetch("/api/accounts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, balance: num(editBalance) }),
    });
    setEditing(null); refresh();
  };

  const removeAccount = async (a: Account) => {
    if (!confirm(t("„{name}“ mit allen {n} Buchungen löschen?", { name: a.name, n: a.tx_count }))) return;
    await fetch(`/api/accounts?id=${a.id}`, { method: "DELETE" });
    refresh();
  };

  if (!accounts) return null;
  const manual = accounts.filter((a) => a.manual);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="glass" size="sm"
          disabled={manual.length === 0}
          onClick={() => { setError(null); setTx((v) => ({ ...v, account_id: v.account_id || manual[0]?.id || "" })); setTxOpen(true); }}
          title={manual.length === 0 ? t("Zuerst ein manuelles Konto anlegen") : undefined}
        >
          <Plus className="h-3.5 w-3.5" /> {t("Buchung erfassen")}
        </Button>
        <Button variant="glass" size="sm" onClick={() => { setError(null); setOpen(true); }}>
          <Wallet className="h-3.5 w-3.5" /> {t("Konten von Hand")}
        </Button>
      </div>

      {/* Konten verwalten */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setEditing(null); }}>
        <DialogContent>
          <DialogTitle>{t("Konten von Hand")}</DialogTitle>
          <DialogDescription>
            {t("Für alles ohne Bankanbindung — Bargeld, Konten bei Banken ohne API, Sparbücher. Der Kontostand wird hier direkt gepflegt und von keinem Abruf überschrieben.")}
          </DialogDescription>

          {manual.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {manual.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{a.name}</div>
                    <div className="text-[11px] text-muted-2">
                      {a.tx_count === 1 ? t("1 Buchung") : t("{n} Buchungen", { n: a.tx_count })} · {a.currency}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {editing === a.id ? (
                      <>
                        <Input
                          className="h-8 w-28 text-right"
                          inputMode="decimal"
                          value={editBalance}
                          autoFocus
                          onChange={(e) => setEditBalance(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveBalance(a.id)}
                        />
                        <button onClick={() => saveBalance(a.id)} className="cursor-pointer rounded-lg p-1.5 text-emerald-soft transition-colors hover:bg-emerald-soft/10">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="num text-sm font-medium">{fmtEUR(a.balance)}</span>
                        <button
                          onClick={() => { setEditing(a.id); setEditBalance(String(a.balance).replace(".", ",")); }}
                          className="cursor-pointer rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
                          title={t("Kontostand ändern")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => removeAccount(a)} className="cursor-pointer rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-4 rounded-xl border border-white/[0.06] p-4">
            <div className="text-xs font-medium text-muted">{t("Neues Konto")}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Name")}</Label>
                <Input placeholder={t("Bargeld")} value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Währung")}</Label>
                <Select value={acc.currency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>
                  {["EUR", "USD", "CHF", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Aktueller Stand")}</Label>
                <Input inputMode="decimal" placeholder="0,00" value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} />
              </div>
            </div>
            {error && <div className="text-xs text-rose-soft">{error}</div>}
            <Button className="w-full" disabled={!acc.name.trim()} onClick={addAccount}>{t("Konto anlegen")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buchung erfassen */}
      <Dialog open={txOpen} onOpenChange={(o) => { setTxOpen(o); setError(null); }}>
        <DialogContent>
          <DialogTitle>{t("Buchung erfassen")}</DialogTitle>
          <DialogDescription>
            {t("Die Buchung verändert den Kontostand des gewählten Kontos sofort. Nur bei manuell geführten Konten möglich.")}
          </DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>{t("Konto")}</Label>
              <Select value={tx.account_id} onChange={(e) => setTx({ ...tx, account_id: e.target.value })}>
                {manual.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Datum")}</Label>
              <Input type="date" value={tx.booking_date} onChange={(e) => setTx({ ...tx, booking_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Art")}</Label>
              <Select value={tx.sign} onChange={(e) => setTx({ ...tx, sign: e.target.value as "-" | "+" })}>
                <option value="-">{t("Ausgabe")}</option>
                <option value="+">{t("Einnahme")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Betrag (€)")}</Label>
              <Input inputMode="decimal" placeholder="24,90" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Kategorie")}</Label>
              <Select value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })}>
                <option value="">{t("automatisch")}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("Empfänger / Beschreibung")}</Label>
              <Input placeholder={t("z. B. Wochenmarkt")} value={tx.merchant} onChange={(e) => setTx({ ...tx, merchant: e.target.value })} />
            </div>
          </div>
          {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
          <Button className="mt-6 w-full" disabled={!tx.amount.trim() || !tx.account_id} onClick={addTx}>{t("Speichern")}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
