import type { TransactionInput } from "@openmonetis/validators/transactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/features/dashboard/dashboard.queries";
import { notificationKeys } from "@/features/notifications/notifications.queries";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  clearInboxItems,
  confirmInboxItem,
  deleteInboxItem,
  discardInboxItem,
  discardInboxItems,
  restoreInboxItem,
} from "./inbox.api";
import { inboxKeys } from "./inbox.queries";

function useInboxMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  });
}

export function useDiscardInboxItemMutation() {
  return useInboxMutation(discardInboxItem);
}

export function useDiscardInboxItemsMutation() {
  return useInboxMutation(discardInboxItems);
}

export function useRestoreInboxItemMutation() {
  return useInboxMutation(restoreInboxItem);
}

export function useConfirmInboxItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionInput }) =>
      confirmInboxItem(id, data),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useDeleteInboxItemMutation() {
  return useInboxMutation(deleteInboxItem);
}

export function useClearInboxItemsMutation() {
  return useInboxMutation(clearInboxItems);
}
