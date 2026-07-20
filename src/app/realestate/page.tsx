"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Home, MapPin, ImagePlus, Pencil, CalendarClock, Ruler } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { apiJson, cn, fmtEUR, fmtEUR0, fmtNum, fmtDate, fmtPct } from "@/lib/utils";

type Property = {
  id: number; label: string; address: string | null; value_eur: number;
  value_source: string | null; valued_on: string | null;
  purchase_price_eur: number | null; purchase_date: string | null;
  size_sqm: number | null; share_pct: number; note: string | null; created_at: string;
  photoIds: number[]; myValue: number; myPurchase: number | null; gain: number | null; gainPct: number | null;
};
type Data = { properties: Property[]; total: number };

const EMPTY = {
  label: "", address: "", value_eur: "", value_source: "",
  valued_on: new Date().toISOString().slice(0, 10),
  purchase_price_eur: "", purchase_date: "", size_sqm: "", share_pct: "100", note: "",
};

/**
 * Downscale in the browser before upload.
 *
 * Photos are stored in the database so the encrypted backup genuinely contains
 * them — which only stays affordable if they aren't 5 MB phone originals.
 * 1600px on the long edge is plenty for a dashboard tile and a lightbox.
 */
async function shrink(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 600_000) return file; // already small enough
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality)
  );
}

export default function RealEstatePage() {
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [edit, setEdit] = useState({ label: "", address: "", value_eur: "", value_source: "", valued_on: "", share_pct: "" });
  const [uploadFor, setUploadFor] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Returns the fresh data so callers can also refresh a copy they are holding
  const load = useCallback(
    () => apiJson<Data>("/api/properties").then((d) => { setData(d); return d; }),
    []
  );
  useEffect(() => { load(); }, [load]);

  // German input: 350.000,50 → 350000.50
  const num = (s: string) => (s.trim() === "" ? "" : parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);

  const submit = async () => {
    setError(null);
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        value_eur: num(form.value_eur),
        purchase_price_eur: num(form.purchase_price_eur),
        size_sqm: num(form.size_sqm),
        share_pct: form.share_pct === "" ? 100 : num(form.share_pct),
      }),
    });
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    setOpen(false);
    setForm(EMPTY);
    load();
  };

  const saveValue = async () => {
    if (!editing) return;
    const res = await fetch("/api/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, label: edit.label, address: edit.address, value_eur: num(edit.value_eur), value_source: edit.value_source, valued_on: edit.valued_on, share_pct: edit.share_pct === "" ? undefined : num(edit.share_pct) }),
    });
    if (!res.ok) { setError(t((await res.json()).error)); return; }
    setEditing(null);
    load();
  };

  const upload = async (propertyId: number, files: FileList) => {
    for (const file of Array.from(files)) {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("propertyId", String(propertyId));
      fd.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
      const res = await fetch("/api/properties/photo", { method: "POST", body: fd });
      if (!res.ok) { setError(t((await res.json()).error)); break; }
    }
    const fresh = await load();
    // The edit dialog renders its own copy of the property, so a new photo
    // would not show up there until the dialog is reopened.
    setEditing((prev) => (prev ? fresh?.properties.find((p) => p.id === prev.id) ?? prev : prev));
  };

  const removePhoto = async (id: number) => {
    await fetch(`/api/properties/photo?id=${id}`, { method: "DELETE" });
    load();
  };

  const remove = async (p: Property) => {
    if (!confirm(t("„{name}“ mit allen Fotos löschen?", { name: p.label }))) return;
    await fetch(`/api/properties?id=${p.id}`, { method: "DELETE" });
    load();
  };

  if (!data) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-muted-2 animate-pulse">{t("Lade Immobilien …")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text">{t("Immobilien")}</h1>
          <p className="mt-1 text-sm text-muted-2">
            {data.properties.length === 0
              ? t("Adresse, Wert und Fotos — der Wert wird von Hand gepflegt.")
              : <>
                  {t("{n} Objekte", { n: data.properties.length })}
                  {" · "}
                  <span className="num text-foreground">{fmtEUR0(data.total)}</span>
                </>}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> {t("Immobilie erfassen")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{t("Immobilie erfassen")}</DialogTitle>
            <DialogDescription>
              {t("Den Wert trägst du selbst ein — eine automatische Marktbewertung bräuchte einen kostenpflichtigen Dienst, und amtliche Bodenrichtwerte bewerten nur den Boden, nicht das Gebäude. Notiere daher, woher deine Zahl stammt.")}
            </DialogDescription>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Bezeichnung")}</Label>
                <Input placeholder={t("Wohnung Berlin")} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Adresse (optional)")}</Label>
                <Input placeholder="Musterstraße 1, 10115 Berlin" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Aktueller Wert (€)")}</Label>
                <Input inputMode="decimal" placeholder="350.000" value={form.value_eur} onChange={(e) => setForm({ ...form, value_eur: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Woher stammt der Wert?")}</Label>
                <Input placeholder={t("Gutachten, Portal, Schätzung …")} value={form.value_source} onChange={(e) => setForm({ ...form, value_source: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Kaufpreis (€, optional)")}</Label>
                <Input inputMode="decimal" placeholder="290.000" value={form.purchase_price_eur} onChange={(e) => setForm({ ...form, purchase_price_eur: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Kaufdatum (optional)")}</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Wohnfläche m² (optional)")}</Label>
                <Input inputMode="decimal" placeholder="82" value={form.size_sqm} onChange={(e) => setForm({ ...form, size_sqm: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Wert vom")}</Label>
                <Input type="date" value={form.valued_on} onChange={(e) => setForm({ ...form, valued_on: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Dein Anteil in %")}</Label>
                <Input inputMode="decimal" placeholder="100" value={form.share_pct} onChange={(e) => setForm({ ...form, share_pct: e.target.value })} />
                <p className="text-[11px] leading-relaxed text-muted-2">
                  {t("Gehört dir nur ein Teil, trage ihn hier ein — Wert, Gewinn und Gesamtvermögen zählen dann nur deinen Anteil. 100 % = alleiniges Eigentum.")}
                </p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("Notiz (optional)")}</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
            <Button className="mt-6 w-full" onClick={submit}>{t("Speichern")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Hidden picker, shared by every tile */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (uploadFor && e.target.files?.length) upload(uploadFor, e.target.files);
          e.target.value = "";
        }}
      />

      {data.properties.length === 0 ? (
        <Card className="rise rise-2 flex flex-col items-center gap-4 p-14 text-center">
          <Home className="h-10 w-10 text-gold/60" strokeWidth={1.2} />
          <p className="max-w-sm text-sm text-muted">
            {t("Noch nichts erfasst. Trage eine Immobilie mit Adresse und Wert ein — Fotos kannst du danach hinzufügen.")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
          {data.properties.map((p, i) => (
            <Card key={p.id} className={cn("glass-hover rise group overflow-hidden", `rise-${(i % 5) + 1}`)}>
              {/* Cover photo, or a placeholder that invites adding one */}
              {p.photoIds.length > 0 ? (
                <button
                  onClick={() => setLightbox(p.photoIds[0])}
                  className="relative block h-40 w-full cursor-pointer overflow-hidden"
                  title={t("Foto ansehen")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/properties/photo?id=${p.photoIds[0]}`} alt={p.label} className="h-full w-full object-cover" />
                  {p.photoIds.length > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] text-white">
                      +{p.photoIds.length - 1}
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex h-40 items-center justify-center border-b border-white/[0.06] bg-white/[0.02]">
                  <Home className="h-8 w-8 text-muted-2/50" strokeWidth={1.2} />
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.label}</div>
                    {p.address && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-2">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => { setUploadFor(p.id); fileRef.current?.click(); }}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100 cursor-pointer"
                      title={t("Foto hinzufügen")}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditing(p); setEdit({ label: p.label, address: p.address ?? "", value_eur: String(p.value_eur).replace(".", ","), value_source: p.value_source ?? "", valued_on: p.valued_on ?? new Date().toISOString().slice(0, 10), share_pct: String(p.share_pct ?? 100).replace(".", ",") }); }}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100 cursor-pointer"
                      title={t("Wert aktualisieren")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="rounded-lg p-1.5 text-muted-2 opacity-0 transition-all hover:bg-rose-soft/10 hover:text-rose-soft group-hover:opacity-100 cursor-pointer"
                      title={t("Löschen")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-2">{t("Wert")}</div>
                    <div className="num text-2xl font-semibold tracking-tight">{fmtEUR0(p.myValue)}</div>
                    {p.share_pct < 100 && (
                      // Say both numbers — otherwise a halved figure looks wrong
                      <div className="mt-0.5 text-[11px] text-muted-2">
                        {t("{share} % von {full}", { share: fmtNum(p.share_pct, 0), full: fmtEUR0(p.value_eur) })}
                      </div>
                    )}
                  </div>
                  {p.gain !== null && p.gainPct !== null && (
                    <div className="text-right text-[11px]">
                      <div className="num font-semibold" style={{ color: p.gain >= 0 ? "#34d399" : "#fb7185" }}>
                        {p.gain >= 0 ? "+" : ""}{fmtEUR0(p.gain)}
                      </div>
                      <div className="text-muted-2">{fmtPct(p.gainPct)} {t("seit Kauf")}</div>
                    </div>
                  )}
                </div>

                <div className="hairline my-3" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-2">
                  {p.size_sqm ? (
                    <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{p.size_sqm} m²</span>
                  ) : null}
                  {p.size_sqm ? <span className="num">{fmtEUR0(p.value_eur / p.size_sqm)}/m²</span> : null}
                  {p.share_pct < 100 && <span className="num text-gold/80">{fmtNum(p.share_pct, 0)} %</span>}
                  {p.valued_on && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {t("Wert vom {date}", { date: fmtDate(p.valued_on) })}
                    </span>
                  )}
                </div>
                {/* Naming the source keeps a hand-entered number honest */}
                {p.value_source && <div className="mt-1 text-[11px] text-muted-2">{t("Quelle: {src}", { src: p.value_source })}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Update the value */}
      <Dialog open={Boolean(editing)} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogTitle>{t("Immobilie bearbeiten")}</DialogTitle>
          <DialogDescription>
            {t("Ein Immobilienwert altert. Halte fest, wann und woher — das unterscheidet eine gepflegte Zahl von einer geratenen.")}
          </DialogDescription>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Bezeichnung")}</Label>
              <Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Adresse")}</Label>
              <Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Aktueller Wert (€)")}</Label>
              <Input inputMode="decimal" value={edit.value_eur} onChange={(e) => setEdit({ ...edit, value_eur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Woher stammt der Wert?")}</Label>
              <Input value={edit.value_source} onChange={(e) => setEdit({ ...edit, value_source: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Wert vom")}</Label>
              <Input type="date" value={edit.valued_on} onChange={(e) => setEdit({ ...edit, valued_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Dein Anteil in %")}</Label>
              <Input inputMode="decimal" value={edit.share_pct} onChange={(e) => setEdit({ ...edit, share_pct: e.target.value })} />
            </div>
          </div>

          {/* Photos, managed where everything else about the property is edited */}
          <div className="mt-5 space-y-2">
            <Label>{t("Fotos")}</Label>
            <div className="flex flex-wrap gap-2">
              {editing?.photoIds.map((pid) => (
                <div key={pid} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/properties/photo?id=${pid}`} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={async () => {
                      if (!confirm(t("Dieses Foto wirklich löschen?"))) return;
                      await removePhoto(pid);
                      // The dialog holds a copy of the property, so refresh the
                      // one it renders or the deleted photo would linger.
                      setEditing((prev) => (prev ? { ...prev, photoIds: prev.photoIds.filter((x) => x !== pid) } : prev));
                    }}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100"
                    title={t("Foto löschen")}
                  >
                    <Trash2 className="h-4 w-4 text-rose-soft" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => { if (editing) { setUploadFor(editing.id); fileRef.current?.click(); } }}
                className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-muted-2 transition-colors hover:border-white/30 hover:text-foreground"
              >
                <ImagePlus className="h-4 w-4" />
                <span className="text-[10px]">{t("Hinzufügen")}</span>
              </button>
            </div>
          </div>

          {error && <div className="mt-3 text-xs text-rose-soft">{error}</div>}
          <Button className="mt-6 w-full" onClick={saveValue}>{t("Speichern")}</Button>
        </DialogContent>
      </Dialog>

      {/* Photo viewer with the other shots of the same property */}
      <Dialog open={lightbox !== null} onOpenChange={(o) => { if (!o) setLightbox(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">{t("Foto")}</DialogTitle>
          {lightbox !== null && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/properties/photo?id=${lightbox}`} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />
              {(() => {
                const owner = data.properties.find((p) => p.photoIds.includes(lightbox));
                if (!owner || owner.photoIds.length < 2) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {owner.photoIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => setLightbox(id)}
                        className={cn("h-14 w-20 overflow-hidden rounded-lg border transition-all cursor-pointer",
                          id === lightbox ? "border-gold/60" : "border-white/10 hover:border-white/25")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/properties/photo?id=${id}`} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                );
              })()}
              <Button
                variant="glass"
                size="sm"
                className="mt-4"
                onClick={async () => { await removePhoto(lightbox); setLightbox(null); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("Foto löschen")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
