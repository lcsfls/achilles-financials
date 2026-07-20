"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Briefcase, AlertTriangle, Info, Save, Pencil, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR0, fmtNum, fmtDate } from "@/lib/utils";
import { valuate, DEFAULT_MULTIPLE, type BusinessInput, type Valuation } from "@/lib/business";

type Saved = {
  id: number; label: string; kind: "own" | "target"; note: string | null;
  created_at: string; inputs: BusinessInput; result: Valuation;
};

const EMPTY: BusinessInput = {
  revenue: 0, ebitda: 0, assets: 0, netDebt: 0,
  ownerDependency: "medium", employees: "1-4", secondLevel: false,
  concentration: "medium", recurring: "medium", growth: "flat", documented: false,
};

/** Labels for the drivers, so the result explains itself. */
const DRIVER_LABEL: Record<string, string> = {
  ownerDependency: "Inhaberabhängigkeit",
  employees: "Mitarbeitende",
  secondLevel: "Zweite Führungsebene",
  concentration: "Kundenkonzentration",
  recurring: "Wiederkehrende Umsätze",
  growth: "Entwicklung",
  documented: "Dokumentierte Prozesse",
  size: "Größenklasse",
};

export default function BusinessPage() {
  const { t } = useI18n();
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [form, setForm] = useState<BusinessInput>(EMPTY);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"own" | "target">("own");
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);

  const load = useCallback(() => apiJson<{ businesses: Saved[] }>("/api/businesses").then((d) => setSaved(d.businesses)), []);
  useEffect(() => { load(); }, [load]);

  // German input: 1.234.567,89
  const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const [raw, setRaw] = useState({ revenue: "", ebitda: "", assets: "", netDebt: "" });

  const current: BusinessInput = {
    ...form,
    revenue: num(raw.revenue),
    ebitda: num(raw.ebitda),
    assets: num(raw.assets),
    netDebt: num(raw.netDebt),
  };
  // Recalculated on every keystroke — the point is to see what each answer does.
  const result = valuate(current);

  const save = async () => {
    setError(null);
    if (!label.trim()) { setError(t("Bezeichnung erforderlich")); return; }
    const body = { id: editId ?? undefined, label, kind, inputs: current };
    const res = await fetch("/api/businesses", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    setEditId(null);
    setLabel("");
    load();
  };

  const edit = (b: Saved) => {
    setForm(b.inputs);
    setRaw({
      revenue: String(b.inputs.revenue).replace(".", ","),
      ebitda: String(b.inputs.ebitda).replace(".", ","),
      assets: String(b.inputs.assets).replace(".", ","),
      netDebt: String(b.inputs.netDebt).replace(".", ","),
    });
    setLabel(b.label);
    setKind(b.kind);
    setEditId(b.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (b: Saved) => {
    if (!confirm(t("„{name}“ löschen?", { name: b.label }))) return;
    await fetch(`/api/businesses?id=${b.id}`, { method: "DELETE" });
    if (editId === b.id) { setEditId(null); setLabel(""); }
    load();
  };

  const field = (key: keyof typeof raw, labelText: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label>{labelText}</Label>
      <Input inputMode="decimal" placeholder={placeholder} value={raw[key]} onChange={(e) => setRaw({ ...raw, [key]: e.target.value })} />
    </div>
  );

  const choice = <K extends keyof BusinessInput>(key: K, labelText: string, options: Array<[BusinessInput[K], string]>) => (
    <div className="space-y-1.5">
      <Label>{labelText}</Label>
      <Select value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value as BusinessInput[K] })}>
        {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Unternehmenswert")}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-2">
            {t("Eine Orientierungs-Bandbreite für dein eigenes Unternehmen oder einen Kaufkandidaten — nach dem Multiplikatorverfahren, wie es im Mittelstand üblich ist.")}
          </p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setMethodOpen(true)}>
          <Info className="h-3.5 w-3.5" /> {t("Methode")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Fragebogen */}
        <Card className="rise rise-1 p-6">
          <div className="text-sm font-semibold">{t("Zahlen")}</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {field("revenue", t("Jahresumsatz (€)"), "1.200.000")}
            {field("ebitda", t("EBITDA bereinigt (€)"), "180.000")}
            {field("assets", t("Vermögen (€)"), "150.000")}
            {field("netDebt", t("Nettoverschuldung (€)"), "50.000")}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
            {t("Bereinigt heißt: ein marktübliches Geschäftsführergehalt ist abgezogen, private und einmalige Posten sind heraus. Nettoverschuldung = Schulden minus Kasse; sie mindert, was beim Verkauf bei dir ankommt.")}
          </p>

          <div className="hairline my-5" />
          <div className="text-sm font-semibold">{t("Läuft es ohne dich?")}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-2">
            {t("Das ist bei kleinen Unternehmen der größte Werthebel — größer als die Branche.")}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {choice("ownerDependency", t("Ohne dich läuft …"), [
              ["critical", t("gar nichts — alles hängt an mir")],
              ["high", t("wenig — ich bin täglich nötig")],
              ["medium", t("einiges — für Wochen ginge es")],
              ["low", t("alles — Führung ist eingesetzt")],
            ])}
            {choice("employees", t("Mitarbeitende"), [
              ["none", t("keine — Einzelunternehmen")],
              ["1-4", "1–4"],
              ["5-19", "5–19"],
              ["20+", "20+"],
            ])}
            {choice("concentration", t("Größter Kunde"), [
              ["high", t("über 50 % vom Umsatz")],
              ["medium", t("20–50 %")],
              ["low", t("unter 20 %")],
            ])}
            {choice("recurring", t("Wiederkehrende Umsätze"), [
              ["low", t("kaum — Projektgeschäft")],
              ["medium", t("teilweise")],
              ["high", t("überwiegend — Verträge, Abos")],
            ])}
            {choice("growth", t("Entwicklung"), [
              ["shrinking", t("rückläufig")],
              ["flat", t("stabil")],
              ["growing", t("wachsend")],
            ])}
            <div className="space-y-1.5">
              <Label>{t("Übergabefähigkeit")}</Label>
              <div className="flex gap-2">
                {([["secondLevel", t("2. Ebene")], ["documented", t("Prozesse dok.")]] as const).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, [k]: !form[k] })}
                    className={cn(
                      "flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-xs transition-all",
                      form[k] ? "border-gold/40 bg-gold/10 text-gold-bright" : "border-white/10 text-muted hover:border-white/20"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Ergebnis */}
        <Card className="rise rise-2 p-6">
          <div className="text-sm font-semibold">{t("Ergebnis")}</div>

          {current.ebitda <= 0 ? (
            <p className="mt-6 text-sm text-muted-2">
              {t("Trage Umsatz und bereinigtes EBITDA ein — ohne Ertrag lässt sich kein Ertragswert bilden.")}
            </p>
          ) : (
            <>
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Bandbreite (Eigenkapitalwert)")}</div>
                <div className="num mt-1 text-3xl font-semibold tracking-tight gold-text">
                  {fmtEUR0(Math.max(0, result.equityLow))} – {fmtEUR0(Math.max(0, result.equityHigh))}
                </div>
                <div className="mt-1 text-xs text-muted-2">
                  {t("Mittelwert {mid} · {mult}× EBITDA", { mid: fmtEUR0(result.equityMid), mult: fmtNum(result.multiple, 1) })}
                </div>
              </div>

              {/* Der ehrlichste Teil des Rechners */}
              {result.ownerBound && (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div className="text-xs leading-relaxed text-muted">
                    {t("Ohne dich läuft nichts, und es gibt niemanden, der übernehmen könnte. Für einen Käufer ist der Ertrag dann nicht übertragbar — realistisch verkaufst du eher die Substanz als das Unternehmen. Wer den Wert heben will, fängt genau hier an: jemanden aufbauen, Prozesse dokumentieren.")}
                  </div>
                </div>
              )}

              {result.onFloor && !result.ownerBound && (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-sky-soft/25 bg-sky-soft/5 p-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-soft" />
                  <div className="text-xs leading-relaxed text-muted">
                    {t("Der Ertragswert liegt unter dem Substanzwert von {v}. Ein Käufer zahlt kaum weniger als das, was er beim Weiterverkauf der Vermögenswerte bekäme.", { v: fmtEUR0(result.assetFloor) })}
                  </div>
                </div>
              )}

              <div className="hairline my-5" />
              <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Was den Multiplikator bewegt")}</div>
              <div className="mt-2 space-y-1.5">
                {[...result.drivers]
                  .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
                  .map((d) => (
                    <div key={d.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-2">{t(DRIVER_LABEL[d.key] ?? d.key)}</span>
                      <span className="num font-semibold" style={{ color: d.effect > 0 ? "#34d399" : d.effect < 0 ? "#fb7185" : "#6b7280" }}>
                        {d.effect > 0 ? "+" : ""}{Math.round(d.effect * 100)} %
                      </span>
                    </div>
                  ))}
              </div>

              <div className="hairline my-5" />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1 space-y-1.5">
                  <Label>{t("Speichern als")}</Label>
                  <Input placeholder={t("Meine GmbH")} value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
                <Select value={kind} onChange={(e) => setKind(e.target.value as "own" | "target")} className="w-36">
                  <option value="own">{t("eigenes")}</option>
                  <option value="target">{t("Kaufkandidat")}</option>
                </Select>
                <Button onClick={save}>
                  <Save className="h-4 w-4" /> {editId ? t("Aktualisieren") : t("Speichern")}
                </Button>
                {editId !== null && (
                  <Button variant="glass" onClick={() => { setEditId(null); setLabel(""); }} title={t("Bearbeiten abbrechen")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {error && <div className="mt-2 text-xs text-rose-soft">{error}</div>}
            </>
          )}
        </Card>
      </div>

      {/* Gespeicherte Bewertungen */}
      {saved && saved.length > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {saved.map((b, i) => (
            <Card key={b.id} className={cn("glass-hover rise group p-5", `rise-${(i % 5) + 1}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{b.label}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge color={b.kind === "own" ? "#34d399" : "#38bdf8"}>
                      {b.kind === "own" ? t("eigenes") : t("Kaufkandidat")}
                    </Badge>
                    {b.result.ownerBound && <Badge color="#fbbf24">{t("inhabergebunden")}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => edit(b)} className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100 cursor-pointer" title={t("Bearbeiten")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-rose-soft/10 hover:text-rose-soft group-hover:opacity-100 cursor-pointer" title={t("Löschen")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="num mt-3 text-xl font-semibold tracking-tight">
                {fmtEUR0(Math.max(0, b.result.equityLow))} – {fmtEUR0(Math.max(0, b.result.equityHigh))}
              </div>
              <div className="mt-1 text-[11px] text-muted-2">
                {t("{mult}× EBITDA · erfasst {date}", { mult: fmtNum(b.result.multiple, 1), date: fmtDate(b.created_at) })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Methode */}
      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-gold" /> {t("Wie gerechnet wird")}</DialogTitle>
          <DialogDescription>
            {t("Multiplikatorverfahren: bereinigtes EBITDA × Multiplikator, abzüglich Nettoverschuldung. Der Multiplikator startet beim Branchendurchschnitt und wird durch deine Antworten angepasst.")}
          </DialogDescription>
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
            <p>
              {t("Der Ausgangswert von {m}× ist der branchenübergreifende Mittelstands-Durchschnitt (DUB KMU-Multiples Q1/2026); der übliche Korridor liegt bei 4,1–7,3×.", { m: String(DEFAULT_MULTIPLE) })}
            </p>
            <p>
              {t("Kleinstunternehmen erzielen 30–50 % niedrigere Multiplikatoren als größere Betriebe derselben Branche — das ist als Größenabschlag hinterlegt.")}
            </p>
            <p>
              {t("Die Inhaberabhängigkeit wiegt am schwersten. Der AWH-Standard des Handwerks bildet sie mit Kapitalisierungszinsen von 15–25 % ab, was Multiplikatoren von nur 4–6,7× entspricht — noch bevor andere Risiken einfließen.")}
            </p>
            <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                {t("Das ist eine Orientierung, kein Gutachten und keine Anlageberatung. Ein tatsächlicher Preis hängt von Verhandlung, Käufertyp, Finanzierung und Due Diligence ab. Für eine belastbare Bewertung — etwa für Nachfolge, Finanzierung oder Steuer — brauchst du eine Fachperson.")}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
