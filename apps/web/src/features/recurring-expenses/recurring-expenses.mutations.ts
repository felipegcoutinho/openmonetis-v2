import type { UpdateRecurringExpenseInput } from "@openmonetis/validators/recurring-expenses";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { changeRecurringExpenseState, updateRecurringExpense } from "./recurring-expenses.api";

export function useUpdateRecurringExpenseMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      id: string;
      purchaseDate: string;
      input: UpdateRecurringExpenseInput;
    }) => updateRecurringExpense(variables.id, variables.purchaseDate, variables.input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useRecurringExpenseStateMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      action: "pause" | "resume" | "skip" | "stop";
      id: string;
      purchaseDate: string;
    }) => changeRecurringExpenseState(variables.action, variables.id, variables.purchaseDate),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
