"use client";

import { useMemo, useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loanReportHtml, type ReportLoan } from "@/lib/loan-report";
import { useI18n } from "@/lib/i18n";
import { fmtEUR, fmtDate } from "@/lib/utils";

/**
 * Preview and print a loan report.
 *
 * The document lives in an iframe and is printed straight from it. Printing the
 * page itself would mean hiding the rest of the app with print CSS, which has
 * to guess the layout's DOM shape — guess wrong and the sheet comes out blank.
 * An iframe has no such ambiguity: what is in it is what prints, so the preview
 * on screen and the paper are the same document by construction.
 */
export function LoanReportDialog({ loan, onClose }: { loan: ReportLoan | null; onClose: () => void }) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => {
    if (!loan) return "";
    const months = loan.plan?.months ?? 0;
    return loanReportHtml({
      loan,
      today: new Date().toISOString().slice(0, 10),
      fmtEUR,
      fmtDate,
      s: {
        titleLent: t("Darlehen — verliehen"),
        titleBorrowed: t("Darlehen — aufgenommen"),
        asOf: t("Stand"),
        principal: t("Ursprüngliche Summe"),
        rate: t("Zinssatz"),
        noInterest: t("zinslos"),
        start: t("Beginn"),
        due: t("Fällig am"),
        agreedPayment: t("Vereinbarte Rate"),
        perMonth: t("Monat"),
        currentState: t("Aktueller Stand"),
        paidTotal: t("Gezahlt insgesamt"),
        ofWhichInterest: t("davon Zinsen"),
        principalLeft: t("Offenes Kapital"),
        accruedInterest: t("Aufgelaufene Zinsen"),
        outstanding: t("Offen gesamt"),
        paymentsMade: t("Geleistete Zahlungen"),
        noPayments: t("Noch keine Zahlungen erfasst."),
        date: t("Datum"),
        note: t("Notiz"),
        amount: t("Betrag"),
        total: t("Summe"),
        schedule: t("Tilgungsplan"),
        scheduleIntro: t("Vorausberechnet ab heute bei {rate} monatlich — {months} Raten, {interest} Zinsen, letzte Rate {date}.", {
          rate: fmtEUR(loan.monthly_payment_eur ?? 0),
          months: String(months),
          interest: fmtEUR(loan.plan?.totalInterest ?? 0),
          date: loan.plan?.payoffDate ? fmtDate(loan.plan.payoffDate) : "—",
        }),
        no: t("Nr."),
        dueCol: t("Fällig"),
        balance: t("Restschuld"),
        payment: t("Rate"),
        interest: t("Zinsen"),
        principalCol: t("Tilgung"),
        after: t("Danach offen"),
        footer: t("Erstellt mit Achilles Financials am {date}. Der Tilgungsplan ist eine Vorausberechnung, keine Forderungsaufstellung.", {
          date: fmtDate(new Date().toISOString().slice(0, 10)),
        }),
      },
    });
  }, [loan, t]);

  const print = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    // Focus first: without it some browsers print the parent document instead
    win.focus();
    win.print();
  };

  return (
    <Dialog open={Boolean(loan)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogTitle>{t("Kreditbericht · {name}", { name: loan?.counterparty ?? "" })}</DialogTitle>
        <DialogDescription>
          {t("Vorschau des Dokuments. Über „Drucken“ im Dialog „Als PDF sichern“ wählen.")}
        </DialogDescription>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white">
          <iframe
            ref={frameRef}
            srcDoc={html}
            title={t("Kreditbericht")}
            className="h-[60vh] w-full"
            // No scripts needed in the document; withholding the capability
            // keeps a note or a name from ever becoming executable.
            sandbox="allow-same-origin allow-modals"
          />
        </div>

        <Button className="mt-4 w-full" onClick={print}>
          <Printer className="h-4 w-4" /> {t("Drucken")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
