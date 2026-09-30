import type { RecurrenceFrequency } from "@openmonetis/domain/transactions";
import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
} from "@openmonetis/shared/date-time";

export const recurringFrequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export function formatRecurringExpenseDate(date: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(date), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).replace(/^1 de /, "1º de ");
}

export function formatRecurringExpenseCompactDate(date: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(date), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(".", "");
}

type RecurringExpensesReportSearch = { period?: string };

export function validateRecurringExpensesReportSearch(
  search: Record<string, unknown>,
): RecurringExpensesReportSearch {
  return typeof search.period === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(search.period)
    ? { period: search.period }
    : {};
}

export function resolveRecurringExpensesReportPeriod(search: RecurringExpensesReportSearch) {
  return search.period ?? getCurrentPeriodInBrazil();
}
