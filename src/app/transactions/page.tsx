"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/categorize";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR, fmtDate } from "@/lib/utils";

type Tx = {
  id: string;
  booking_date: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  category: string;
  pending: number;
};

export default function TransactionsPage() {
  const { t, lang } = useI18n();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; n: number }>>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (month) params.set("month", month);
    if (account) params.set("account", account);
    apiJson<{ transactions: Tx[]; months: string[]; accounts: typeof accounts }>(`/api/transactions?${params}`)
      .then((d) => { setTxs(d.transactions); setMonths(d.months); setAccounts(d.accounts); })
      .finally(() => setLoading(false));
  }, [q, category, month, account]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const setCat = async (id: string, cat: string) => {
    setTxs((prev) => prev.map((tx) => (tx.id === id ? { ...tx, category: cat } : tx)));
    setEditing(null);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category: cat }),
    });
  };

  const spent = txs.filter((tx) => tx.amount < 0).reduce((s, tx) => s - tx.amount, 0);
  const earned = txs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);

  const fmtMonth = (m: string) =>
    new Date(`${m}-01`).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Transaktionen")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {t("{n} Buchungen", { n: txs.length })} · <span className="text-rose-soft">−{fmtEUR(spent)}</span> · <span className="text-emerald-soft">+{fmtEUR(earned)}</span>
          </p>
        </div>
      </div>

      <Card className="rise rise-1 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input placeholder={t("Händler oder Beschreibung suchen …")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-56">
            <option value="">{t("Alle Kategorien")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </Select>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full sm:w-52">
            <option value="">{t("Alle Monate")}</option>
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </Select>
          {/* Erst ab zwei Konten: Bei nur einem wäre der Filter ein Auswahlfeld
              ohne Auswahl. */}
          {accounts.length > 1 && (
            <Select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full sm:w-56">
              <option value="">{t("Alle Konten")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.n})</option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      <Card className="rise rise-2 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-2 animate-pulse">{t("Lade Transaktionen …")}</div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-2">{t("Keine Transaktionen gefunden.")}</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                  style={{
                    background: `${CATEGORY_COLORS[tx.category] ?? "#6b7280"}14`,
                    color: CATEGORY_COLORS[tx.category] ?? "#6b7280",
                    border: `1px solid ${CATEGORY_COLORS[tx.category] ?? "#6b7280"}25`,
                  }}
                >
                  {(tx.merchant || tx.description || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{tx.merchant || tx.description || "—"}</span>
                    {tx.pending === 1 && <Badge color="#94a3b8">{t("ausstehend")}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-2">
                    {fmtDate(tx.booking_date)}{tx.merchant && tx.description ? ` · ${tx.description}` : ""}
                  </div>
                </div>
                <div className="shrink-0">
                  {editing === tx.id ? (
                    <Select
                      autoFocus
                      value={tx.category}
                      onChange={(e) => setCat(tx.id, e.target.value)}
                      onBlur={() => setEditing(null)}
                      className="h-8 w-52 text-xs"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                    </Select>
                  ) : (
                    <button onClick={() => setEditing(tx.id)} className="cursor-pointer" title={t("Kategorie ändern")}>
                      <Badge color={CATEGORY_COLORS[tx.category] ?? "#6b7280"}>{t(tx.category)}</Badge>
                    </button>
                  )}
                </div>
                <span className={cn("num w-28 shrink-0 text-right text-sm font-semibold", tx.amount > 0 ? "text-emerald-soft" : "text-foreground")}>
                  {tx.amount > 0 ? "+" : ""}{fmtEUR(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
