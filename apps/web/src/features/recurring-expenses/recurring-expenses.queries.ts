import { queryOptions } from "@tanstack/react-query";
import { getRecurringExpenses, getRecurringExpensesReport } from "./recurring-expenses.api";

const recurringExpenseKeys = {
  all: ["recurring-expenses"] as const,
  period: (period: string) => [...recurringExpenseKeys.all, period] as const,
  report: (period: string) => [...recurringExpenseKeys.all, "report", period] as const,
};

export function recurringExpensesQueryOptions(period: string) {
  return queryOptions({
    queryKey: recurringExpenseKeys.period(period),
    queryFn: () => getRecurringExpenses(period),
  });
}

export function recurringExpensesReportQueryOptions(period: string) {
  return {
    queryKey: recurringExpenseKeys.report(period),
    queryFn: () => getRecurringExpensesReport(period),
  };
}
