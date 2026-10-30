import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  getPeriodEndDateString,
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

export function formatAccountChartDate(date: string, short = false) {
  const formatted = formatDateInBrazil(dateOnlyToSafeInstant(date), {
    day: "2-digit",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" as const }),
  });
  return short ? formatted.replace(" de ", " ") : formatted;
}

export function formatAccountHistoryPeriod(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), { month: "long", year: "numeric" });
}

/** "Saldo em 31 de out." — the balance shown includes every posting through the period's end. */
export function formatAccountBalanceLabel(period: string) {
  const endDate = formatDateInBrazil(dateOnlyToSafeInstant(getPeriodEndDateString(period)), {
    day: "numeric",
    month: "short",
  });
  return `Saldo em ${endDate}`;
}

/** Account types whose main recurring movement is yield, so it is offered as the primary action. */
export function isYieldAccountType(type: AccountOutput["type"]) {
  return type === "savings" || type === "investment";
}
