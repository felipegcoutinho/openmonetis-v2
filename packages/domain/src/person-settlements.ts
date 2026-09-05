export const personSettlementStatuses = ["receivable", "settled", "credit"] as const;

export type PersonSettlementStatus = (typeof personSettlementStatuses)[number];

export type PersonBalanceEntry = {
  amount: number;
  kind: "expense" | "refund" | "settlement";
};

export type PersonBalance = {
  assignedAmount: number;
  refundedAmount: number;
  settledAmount: number;
  balanceAmount: number;
  receivableAmount: number;
  creditAmount: number;
  status: PersonSettlementStatus;
};

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(amount: number) {
  return amount / 100;
}

export function calculatePersonBalance(entries: PersonBalanceEntry[]): PersonBalance {
  let assignedCents = 0;
  let refundedCents = 0;
  let settledCents = 0;

  for (const entry of entries) {
    const amountCents = Math.abs(toCents(entry.amount));
    if (entry.kind === "expense") assignedCents += amountCents;
    if (entry.kind === "refund") refundedCents += amountCents;
    if (entry.kind === "settlement") settledCents += amountCents;
  }

  const balanceCents = assignedCents - refundedCents - settledCents;
  const receivableCents = Math.max(0, balanceCents);
  const creditCents = Math.max(0, -balanceCents);

  return {
    assignedAmount: fromCents(assignedCents),
    refundedAmount: fromCents(refundedCents),
    settledAmount: fromCents(settledCents),
    balanceAmount: fromCents(balanceCents),
    receivableAmount: fromCents(receivableCents),
    creditAmount: fromCents(creditCents),
    status: balanceCents > 0 ? "receivable" : balanceCents < 0 ? "credit" : "settled",
  };
}
