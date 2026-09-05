import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { importExternalExpense } from "./external-expenses.api";
import { externalExpenseKeys } from "./external-expenses.queries";

function useExternalExpenseMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: externalExpenseKeys.all });
      await refreshFinancialQueries(client);
    },
  });
}

export const useImportExternalExpenseMutation = () =>
  useExternalExpenseMutation(importExternalExpense);
