import type { CreateGoalContributionInput, UpdateGoalInput } from "@openmonetis/validators/goals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  createGoal,
  createGoalContribution,
  deleteGoal,
  deleteGoalContribution,
  updateGoal,
} from "./goals.api";
import { goalKeys } from "./goals.queries";

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

export function useCreateGoalContributionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateGoalContributionInput }) =>
      createGoalContribution(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: goalKeys.all }),
  });
}

export function useDeleteGoalContributionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, contributionId }: { id: string; contributionId: string }) =>
      deleteGoalContribution(id, contributionId),
    onSuccess: () => client.invalidateQueries({ queryKey: goalKeys.all }),
  });
}
