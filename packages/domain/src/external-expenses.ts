import { calculateInstallmentAllocationTotal } from "./installments";

export const externalExpenseStatuses = ["pending", "imported", "ignored"] as const;
export type ExternalExpenseStatus = (typeof externalExpenseStatuses)[number];
export const externalExpenseSourceKinds = [
  "transaction",
  "installmentSeries",
  "recurringOccurrence",
] as const;
export type ExternalExpenseSourceKind = (typeof externalExpenseSourceKinds)[number];

export function canUpdateExternalExpenseSnapshot(status: ExternalExpenseStatus) {
  return status === "pending" || status === "ignored";
}

export type ExternalExpenseSnapshot = {
  name: string;
  amount: string;
  purchaseDate: string;
  period: string;
  dueDate: string | null;
  paymentMethod:
    | "credit_card"
    | "debit_card"
    | "pix"
    | "cash"
    | "boleto"
    | "benefits"
    | "bank_transfer";
  condition: "single" | "installment" | "recurring";
  installmentCount: number | null;
  currentInstallment: number | null;
  sourceLabel: string | null;
};

export function preserveExternalExpenseInstallmentBoundary(
  current: ExternalExpenseSnapshot,
  next: ExternalExpenseSnapshot,
): ExternalExpenseSnapshot {
  if (
    current.condition !== "installment" ||
    next.condition !== "installment" ||
    current.currentInstallment === null ||
    next.currentInstallment === null ||
    current.currentInstallment <= next.currentInstallment
  ) {
    return next;
  }

  return {
    ...next,
    purchaseDate: current.purchaseDate,
    period: current.period,
    dueDate: current.dueDate,
    currentInstallment: current.currentInstallment,
  };
}

export function selectNewExternalExpenseAssignmentKeys(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
) {
  return new Set([...after].filter((key) => !before.has(key)));
}

export function calculateExternalInstallmentTotal(input: {
  originalAmount: string | number;
  totalInstallments: number;
  trackedFromInstallment: number;
  trackedAmounts: Array<string | number>;
}) {
  const originalCents = toCents(input.originalAmount);
  const trackedCents = input.trackedAmounts.reduce<number>(
    (total, amount) => total + toCents(amount),
    0,
  );

  if (input.trackedFromInstallment <= 1) return trackedCents / 100;

  const baseInstallmentCents = Math.floor(originalCents / input.totalInstallments);
  const remainder = originalCents % input.totalInstallments;
  let originalTrackedCents = 0;

  for (
    let installment = input.trackedFromInstallment;
    installment <= input.totalInstallments;
    installment += 1
  ) {
    originalTrackedCents += baseInstallmentCents + (installment <= remainder ? 1 : 0);
  }

  return (originalCents - originalTrackedCents + trackedCents) / 100;
}

export function calculateExternalInstallmentAllocationTotal(input: {
  originalTransactionAmount: string | number;
  totalInstallments: number;
  trackedFromInstallment: number;
  trackedTransactionAmounts: Array<string | number>;
  trackedAllocationAmounts: Array<string | number>;
}) {
  return calculateInstallmentAllocationTotal(input);
}

function toCents(value: string | number) {
  const amount = Math.abs(Number(value));
  if (!Number.isFinite(amount)) throw new RangeError("invalid_external_expense_amount");
  return Math.round(amount * 100);
}

export function canReviewExternalExpense(
  status: ExternalExpenseStatus,
  action: "ignore" | "restore",
) {
  return action === "ignore" ? status === "pending" : status === "ignored";
}
