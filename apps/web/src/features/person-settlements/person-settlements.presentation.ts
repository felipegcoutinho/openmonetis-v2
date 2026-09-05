import type { PersonBalanceOutput } from "@openmonetis/validators/person-settlements";

export function formatPersonBalance(balance: PersonBalanceOutput) {
  const amount = balance.status === "credit" ? balance.creditAmount : balance.receivableAmount;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

export function personBalanceLabel(status: PersonBalanceOutput["status"]) {
  if (status === "credit") return "Crédito da pessoa";
  if (status === "receivable") return "A receber";
  return "Acertado";
}
