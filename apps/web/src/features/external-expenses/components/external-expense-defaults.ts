import type { ExternalExpenseOutput } from "@openmonetis/validators/external-expenses";

export function createDefaultsFor(item: ExternalExpenseOutput) {
  const snapshot = item.snapshot;
  return {
    amount: String(snapshot.amount),
    condition: item.sourceKind === "recurringOccurrence" ? "single" : snapshot.condition,
    dueDate: snapshot.dueDate ?? "",
    installmentCount: String(snapshot.installmentCount ?? 2),
    invoicePeriod: snapshot.period,
    isSettled: snapshot.paymentMethod === "credit_card" ? "true" : "false",
    name: snapshot.name,
    paymentMethod: snapshot.paymentMethod,
    purchaseDate: snapshot.purchaseDate,
    startInstallment: String(snapshot.currentInstallment ?? 1),
  } as const;
}
