import type { RecurrenceFrequency } from "@openmonetis/domain/transactions";
import {
  type RecurringTransactionsSearch,
  RecurringTransactionsSearchSchema,
} from "@openmonetis/validators/recurring-transactions";

export const recurringStatusLabels = {
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
} as const;

/** Suffix placed after an occurrence amount, e.g. "R$ 50,00 /mês". */
export const recurringAmountSuffixLabels: Record<RecurrenceFrequency, string> = {
  weekly: "/semana",
  monthly: "/mês",
  bimonthly: "/bimestre",
  quarterly: "/trimestre",
  semiannual: "/semestre",
  annual: "/ano",
};

/** Old links may still carry `period`; the report no longer depends on it, so it is dropped. */
export function validateRecurringTransactionsSearch(
  search: Record<string, unknown>,
): RecurringTransactionsSearch {
  return RecurringTransactionsSearchSchema.parse(search);
}
