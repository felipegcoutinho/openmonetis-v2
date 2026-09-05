import type { UpdateBudgetInput } from "@openmonetis/validators/budgets";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { copyPreviousBudgets, createBudget, deleteBudget, updateBudget } from "./budgets.api";

export function useCreateBudgetMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createBudget,
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useUpdateBudgetMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput; period: string }) =>
      updateBudget(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteBudgetMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; period: string }) => deleteBudget(id),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useCopyPreviousBudgetsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: copyPreviousBudgets,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
