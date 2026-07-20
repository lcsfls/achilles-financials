/**
 * Kredite — verliehen und aufgenommen.
 *
 * Zinsmodell, damit die Zahlen nachvollziehbar sind statt nur plausibel:
 *
 *  - Zinsen laufen auf den JEWEILIGEN Restbetrag, nicht auf die Anfangssumme.
 *    Wer die Hälfte getilgt hat, zahlt danach nur noch auf die Hälfte Zinsen.
 *  - Taggenau nach act/365 (tatsächliche Tage / 365) — die übliche Konvention
 *    für private Darlehen und einfach zu prüfen.
 *  - Einfache Verzinsung: Aufgelaufene Zinsen werden nicht selbst verzinst.
 *    Ein Privatdarlehen mit Zinseszins wäre die Ausnahme, nicht die Regel.
 *  - Eine Zahlung tilgt erst die aufgelaufenen Zinsen, dann das Kapital.
 *    So rechnet auch eine Bank; andersherum entstünden stille Restzinsen.
 *
 * Das ist bewusst kein Tilgungsplan mit fester Rate: Erfasst wird, was
 * tatsächlich gezahlt wurde, nicht was gezahlt werden sollte.
 */

export type Payment = { id: number; paid_on: string; amount_eur: number; note: string | null };

export type Loan = {
  id: number;
  direction: "lent" | "borrowed";
  counterparty: string;
  kind: "private" | "bank";
  principal_eur: number;
  interest_pct: number;
  start_date: string;
  due_date: string | null;
  note: string | null;
  closed: number;
  /** Vereinbarte Monatsrate; ohne sie gibt es keinen Tilgungsplan. */
  monthly_payment_eur: number | null;
};

export type LoanState = {
  /** Summe aller erfassten Zahlungen. */
  paid: number;
  /** Davon auf Zinsen entfallen. */
  paidInterest: number;
  /** Noch offenes Kapital. */
  principalLeft: number;
  /** Bis heute aufgelaufene, noch nicht bezahlte Zinsen. */
  interestDue: number;
  /** Was heute insgesamt offen ist (Kapital + offene Zinsen). */
  outstanding: number;
  /** Zinsen insgesamt bisher (bezahlt + offen). */
  interestTotal: number;
  /** Mehr gezahlt als geschuldet — dann ist outstanding 0 und hier steht der Überhang. */
  overpaid: number;
  /** Anteil des getilgten Kapitals, 0..1 */
  progress: number;
};

const DAY_MS = 24 * 3600 * 1000;

function days(from: string, to: string): number {
  const d = (Date.parse(to) - Date.parse(from)) / DAY_MS;
  // Zahlungen vor dem Startdatum ergeben keine negativen Zinsen
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Stand eines Kredits zu einem Stichtag.
 * `asOf` ist ein Parameter statt "heute", damit die Rechnung testbar ist.
 */
export function loanState(loan: Loan, payments: Payment[], asOf: string): LoanState {
  const rate = (loan.interest_pct || 0) / 100;
  const ordered = [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on));

  let principalLeft = loan.principal_eur;
  let interestDue = 0;
  let paid = 0;
  let paidInterest = 0;
  let cursor = loan.start_date;

  const accrue = (until: string) => {
    if (rate > 0 && principalLeft > 0) {
      interestDue += principalLeft * rate * (days(cursor, until) / 365);
    }
    cursor = until;
  };

  for (const p of ordered) {
    accrue(p.paid_on);
    paid += p.amount_eur;

    // Erst Zinsen, dann Kapital
    const toInterest = Math.min(p.amount_eur, interestDue);
    interestDue -= toInterest;
    paidInterest += toInterest;
    principalLeft -= p.amount_eur - toInterest;
  }
  accrue(asOf);

  // Überzahlung nicht als negative Schuld ausgeben — das läse sich wie ein Guthaben
  const overpaid = principalLeft < 0 ? -principalLeft : 0;
  if (principalLeft < 0) principalLeft = 0;

  const outstanding = principalLeft + interestDue;
  return {
    paid,
    paidInterest,
    principalLeft,
    interestDue,
    outstanding,
    interestTotal: paidInterest + interestDue,
    overpaid,
    progress: loan.principal_eur > 0 ? Math.min(1, (loan.principal_eur - principalLeft) / loan.principal_eur) : 1,
  };
}
