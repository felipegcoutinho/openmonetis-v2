import type { PersonBalanceOutput } from "@openmonetis/validators/person-settlements";

/** Amount shown next to the balance label: the person's credit, or what is still receivable. */
export function getPersonBalanceAmount(balance: PersonBalanceOutput) {
  return balance.status === "credit" ? balance.creditAmount : balance.receivableAmount;
}

export function personBalanceLabel(status: PersonBalanceOutput["status"]) {
  if (status === "credit") return "Crédito da pessoa";
  if (status === "receivable") return "A receber";
  return "Acertado";
}

/** Floors the ratio so the UI never shows 100% while any amount is still pending. */
export function getSettlementProgressPercentage(coveredAmount: number, dueAmount: number) {
  const dueCents = Math.round(dueAmount * 100);
  if (dueCents <= 0) return 100;
  const percentage = Math.floor((Math.round(coveredAmount * 100) * 100) / dueCents);
  return Math.min(100, Math.max(0, percentage));
}

export function formatPendingPeopleCount(count: number) {
  return `${count} ${count === 1 ? "pendente" : "pendentes"}`;
}
