import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { AccountOutput, CreateAccountInput } from "@openmonetis/validators/accounts";
import { getLogoLabel } from "@/lib/logo-catalog";

export { formatCurrency, parseCurrencyInput } from "@/lib/money-presentation";

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

export function getCurrentAccountPeriod() {
  return getCurrentPeriodInBrazil();
}

export function formatAccountPeriod(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), { month: "long", year: "numeric" });
}
