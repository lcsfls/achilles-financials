"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Landmark, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, fmtEUR0, fmtDate } from "@/lib/utils";

type Notice = {
  id: number; notice_date: string; kind: "renteninformation" | "rentenbescheid";
  disability_eur: number | null; earned_eur: number | null; projected_eur: number | null;
  points: number | null; note: string | null;
};

const EMPTY = {
  notice_date: new Date().toISOString().slice(0, 10),
  kind: "renteninformation" as "renteninformation" | "rentenbescheid",
  earned_eur: "", projected_eur: "", disability_eur: "", points: "", note: "",
};

/**
 * German statutory pension notices.
 *
 * Shown next to the private contracts but never summed with them: a monthly
 * entitlement is income, not capital. Saying so on screen matters more than
 * the numbers — adding these to net worth is the obvious mistake.
 */
export function PensionStatutory() {
  const { t } = useI18n();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => apiJson<{ notices: Notice[] }>("/api/pension/statutory").then((d) => setNotices(d.notices)), []);
  useEffect(() => { load(); }, [load]);

  const num = (s: string) => (s.trim() ? parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0 : null);

  const save = async () => {
    setError(null);
    const res = await fetch("/api/pension/statutory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notice_date: form.notice_date, kind: form.kind,
        earned_eur: num(form.earned_eur), projected_eur: num(form.projected_eur),
        disability_eur: num(form.disability_eur), points: num(form.points),
        note: form.note,
      }),
    });
    if (!res.ok) { setError(t((await res.json()).error || "Fehler beim Speichern")); return; }
    setOpen(false); setForm(EMPTY); load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("Diesen Bescheid wirklich löschen?"))) return;
    await fetch(`/api/pension/statutory?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!notices) return null;
  const latest = notices[0];

  return (
    <Card className="rise rise-4">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-soft/20 bg-sky-soft/10">
            <Landmark className="h-5 w-5 text-sky-soft" strokeWidth={1.7} />
          </div>
          <div>
            <CardTitle className="normal-case text-base font-semibold tracking-normal text-foreground">
              {t("Gesetzliche Rente")}
            </CardTitle>
            <div className="text-xs text-muted-2">{t("Renteninformation & Rentenbescheid")}</div>
          </div>
        </div>
        <Button variant="glass" size="sm" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> {t("Bescheid erfassen")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* The point that keeps someone from double-counting their retirement */}
        <div className="flex gap-2.5 rounded-xl border border-sky-soft/15 bg-sky-soft/[0.06] p-3.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-soft" />
          <span>
            {t("Diese Beträge sind monatliche Ansprüche, kein Guthaben — sie fließen bewusst nicht ins Gesamtvermögen ein. Man kann eine Rente nicht verkaufen; sie ersetzt später Einkommen, statt Kapital zu sein.")}
          </span>
        </div>

        {notices.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-2">
            {t("Noch kein Bescheid erfasst. Die Werte stehen auf deiner jährlichen Renteninformation der Deutschen Rentenversicherung.")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: t("Bisher erreicht"), value: latest.earned_eur, hint: t("ohne weitere Beiträge") },
                { label: t("Hochrechnung"), value: latest.projected_eur, hint: t("bei gleichem Beitrag") },
                { label: t("Erwerbsminderung"), value: latest.disability_eur, hint: t("volle Erwerbsminderung") },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-white/[0.06] p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-2">{k.label}</div>
                  <div className="num mt-1.5 text-xl font-semibold">
                    {k.value != null ? `${fmtEUR0(k.value)}` : "—"}
                    {k.value != null && <span className="text-xs font-normal text-muted-2">{t("/Monat")}</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-2">{k.hint}</div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {notices.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <span>{fmtDate(n.notice_date)}</span>
                    <span className="ml-2 text-xs text-muted-2">
                      {n.kind === "rentenbescheid" ? t("Rentenbescheid") : t("Renteninformation")}
                      {n.points != null && ` · ${n.points.toLocaleString("de-DE")} ${t("Entgeltpunkte")}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="num text-xs text-muted">{n.projected_eur != null ? `${fmtEUR0(n.projected_eur)}${t("/Monat")}` : "—"}</span>
                    <button onClick={() => remove(n.id)} className="cursor-pointer rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-rose-soft/10 hover:text-rose-soft" title={t("Löschen")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
        <DialogContent>
          <DialogTitle>{t("Bescheid erfassen")}</DialogTitle>
          <DialogDescription>
            {t("Die Werte stehen auf der Renteninformation der Deutschen Rentenversicherung. Alle Felder außer dem Datum sind optional.")}
          </DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("Datum des Bescheids")}</Label>
              <Input type="date" value={form.notice_date} onChange={(e) => setForm({ ...form, notice_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Art")}</Label>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
                <option value="renteninformation">{t("Renteninformation")}</option>
                <option value="rentenbescheid">{t("Rentenbescheid")}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Bisher erreichte Rente (€/Monat)")}</Label>
              <Input inputMode="decimal" placeholder="842,15" value={form.earned_eur} onChange={(e) => setForm({ ...form, earned_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Hochgerechnete Rente (€/Monat)")}</Label>
              <Input inputMode="decimal" placeholder="1.640,00" value={form.projected_eur} onChange={(e) => setForm({ ...form, projected_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Volle Erwerbsminderung (€/Monat)")}</Label>
              <Input inputMode="decimal" placeholder="1.120,00" value={form.disability_eur} onChange={(e) => setForm({ ...form, disability_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Entgeltpunkte")}</Label>
              <Input inputMode="decimal" placeholder="24,5" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("Notiz (optional)")}</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
          <Button className="mt-6 w-full" onClick={save}>{t("Speichern")}</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
