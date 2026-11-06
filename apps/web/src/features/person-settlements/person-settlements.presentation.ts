import type { PersonBalanceOutput } from "@openmonetis/validators/person-settlements";
import { formatCurrency } from "../../lib/money-presentation";

export function formatPersonBalance(balance: PersonBalanceOutput) {
  const amount = balance.status === "credit" ? balance.creditAmount : balance.receivableAmount;
  return formatCurrency(amount);
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
