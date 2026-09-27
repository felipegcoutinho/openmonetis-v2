import type { UpdateGoalInput } from "@openmonetis/validators/goals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createGoal, deleteGoal, updateGoal } from "./goals.api";

export function useCreateGoalMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createGoal, onSuccess: () => refreshFinancialQueries(client) });
}

export function useUpdateGoalMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGoalInput }) => updateGoal(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteGoalMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteGoal, onSuccess: () => refreshFinancialQueries(client) });
}
