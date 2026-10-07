<script lang="ts">
  import { Printer } from "@lucide/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Dialog from "$lib/components/ui/Dialog.svelte";
  import { loanReportHtml, type ReportLoan } from "$lib/loan-report";
  import { t } from "$lib/i18n";
  import { fmtEUR, fmtDate } from "$lib/utils";

  /**
   * Preview and print a loan report.
   *
   * The document lives in an iframe and is printed straight from it. Printing
   * the page itself would mean hiding the rest of the app with print CSS, which
   * has to guess the layout's DOM shape. An iframe has no such ambiguity: what
   * is in it is what prints, so preview and paper are the same document.
   */
  let { loan = $bindable(null) }: { loan: ReportLoan | null } = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  let open = $state(false);
  $effect(() => { open = Boolean(loan); });

  const html = $derived.by(() => {
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
  });

  function print() {
    const win = frame?.contentWindow;
    if (!win) return;
    // Focus first: without it some browsers print the parent document instead
    win.focus();
    win.print();
  }
</script>

<Dialog
  bind:open
  onclose={() => (loan = null)}
  title={t("Kreditbericht · {name}", { name: loan?.counterparty ?? "" })}
  description={t("Vorschau des Dokuments. Über „Drucken“ im Dialog „Als PDF sichern“ wählen.")}
  class="max-w-4xl"
>
  <div class="overflow-hidden rounded-xl border border-line bg-white">
    <!-- No scripts needed in the document; withholding the capability keeps a
         note or a name from ever becoming executable. -->
    <iframe bind:this={frame} srcdoc={html} title={t("Kreditbericht")} class="h-[60vh] w-full" sandbox="allow-same-origin allow-modals"></iframe>
  </div>
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (open = false)}>{t("Schließen")}</Button>
    <Button onclick={print}><Printer /> {t("Drucken")}</Button>
  {/snippet}
</Dialog>
