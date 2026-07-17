"use client";

import { useState } from "react";
import { Check, X, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type Requirement = { kind: "need" | "warn" | "good"; text: string };

/**
 * Integrationskachel mit Schalter.
 *
 * Vor dem Einschalten kommt ein Hinweisfenster: Beide Wege haben harte
 * Voraussetzungen (öffentliche HTTPS-Domain bzw. Produktregistrierung), die
 * man kennen muss, bevor man Zugangsdaten einträgt — nicht erst, wenn die Bank
 * ablehnt.
 */
export function IntegrationCard({
  icon, title, subtitle, enabled, configured, requirements, docsUrl, docsLabel,
  onToggle, children, accent = "#d4af37",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  configured: boolean;
  requirements: Requirement[];
  docsUrl?: string;
  docsLabel?: string;
  onToggle: (on: boolean) => void | Promise<void>;
  children?: React.ReactNode;
  accent?: string;
}) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = async (on: boolean) => {
    setBusy(true);
    await onToggle(on);
    setBusy(false);
    setConfirmOpen(false);
  };

  const ICONS: Record<Requirement["kind"], React.ReactNode> = {
    need: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />,
    warn: <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-soft" />,
    good: <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-soft" />,
  };

  return (
    <>
      <Card className={cn("rise transition-opacity", !enabled && "opacity-70")}>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate normal-case text-base font-semibold tracking-normal text-foreground">
                {title}
              </CardTitle>
              <div className="truncate text-xs text-muted-2">{subtitle}</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {enabled && (configured
              ? <Badge color="#34d399"><Check className="h-3 w-3" /> {t("Bereit")}</Badge>
              : <Badge color="#fbbf24">{t("Einrichten")}</Badge>)}

            {/* Schalter */}
            <button
              role="switch"
              aria-checked={enabled}
              disabled={busy}
              onClick={() => (enabled ? apply(false) : setConfirmOpen(true))}
              className={cn(
                "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:opacity-50",
                enabled ? "border-gold/40 bg-gold/30" : "border-white/12 bg-white/[0.06]"
              )}
              title={enabled ? t("Deaktivieren") : t("Aktivieren")}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full transition-all",
                  enabled ? "left-[22px] bg-gold shadow-[0_0_10px_rgba(212,175,55,0.7)]" : "left-0.5 bg-muted-2"
                )}
              />
            </button>
          </div>
        </CardHeader>

        {enabled && children && <CardContent className="space-y-4">{children}</CardContent>}

        {!enabled && (
          <CardContent>
            <ul className="space-y-1.5">
              {requirements.slice(0, 3).map((r, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-2">
                  {ICONS[r.kind]}
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Hinweise vor dem Aktivieren */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogTitle className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
            >
              {icon}
            </span>
            {t("{name} aktivieren", { name: title })}
          </DialogTitle>
          <DialogDescription>{t("Was du dafür brauchst — bitte vorher lesen:")}</DialogDescription>

          <div className="mt-5 space-y-3">
            <ul className="space-y-2.5">
              {requirements.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                    r.kind === "need" ? "border-amber-400/25 bg-amber-400/8 text-amber-200"
                      : r.kind === "warn" ? "border-sky-soft/25 bg-sky-soft/8 text-sky-soft"
                      : "border-emerald-soft/20 bg-emerald-soft/5 text-muted"
                  )}
                >
                  {ICONS[r.kind]}
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>

            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gold-bright hover:underline"
              >
                {docsLabel ?? t("Zur Dokumentation")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)} disabled={busy}>
              <X className="h-4 w-4" /> {t("Abbrechen")}
            </Button>
            <Button className="flex-1" onClick={() => apply(true)} disabled={busy}>
              <Check className="h-4 w-4" /> {busy ? t("Aktiviere …") : t("Verstanden, aktivieren")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
