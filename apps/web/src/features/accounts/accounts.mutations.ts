import type {
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
  ReplaceAccountInput,
  UpdateAccountInput,
} from "@openmonetis/validators/accounts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  addAccountYield,
  adjustAccountBalance,
  createAccount,
  deleteAccount,
  replaceAccount,
  updateAccount,
} from "./accounts.api";

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useReplaceAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplaceAccountInput }) =>
      replaceAccount(id, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useArchiveAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      updateAccount(id, { isArchived: true } satisfies UpdateAccountInput),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useAdjustAccountBalanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustAccountBalanceInput }) =>
      adjustAccountBalance(id, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useAddAccountYieldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddAccountYieldInput }) =>
      addAccountYield(id, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
