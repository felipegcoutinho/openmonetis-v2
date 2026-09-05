import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { AccountOutput, CreateAccountInput } from "@openmonetis/validators/accounts";
import { getLogoLabel } from "@/lib/logo-catalog";

export const accountTypeLabels: Record<AccountOutput["type"], string> = {
  checking: "Conta Corrente",
  savings: "Conta Poupança",
  investment: "Conta Investimento",
  cash: "Dinheiro",
  benefits: "Pré-Pago | VR/VA",
  other: "Outros",
};

export const accountTypeOptions: Array<{ value: CreateAccountInput["type"]; label: string }> = (
  Object.entries(accountTypeLabels) as Array<[CreateAccountInput["type"], string]>
).map(([value, label]) => ({ value, label }));

export function getLogoDisplayName(logo?: string | null) {
  return getLogoLabel(logo);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function parseCurrencyInput(value: string) {
  const compactValue = value.replace(/[^\d,.-]/g, "");
  const normalized = compactValue.includes(",")
    ? compactValue.replace(/\./g, "").replace(",", ".")
    : compactValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCurrentAccountPeriod() {
  return getCurrentPeriodInBrazil();
}
