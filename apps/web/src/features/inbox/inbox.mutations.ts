import type { TransactionInput } from "@openmonetis/validators/transactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "@/features/notifications/notifications.queries";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { confirmInboxItem, deleteInboxItem, discardInboxItem, restoreInboxItem } from "./inbox.api";
import { inboxKeys } from "./inbox.queries";

function useInboxMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
      ]),
  });
}

export function useDiscardInboxItemMutation() {
  return useInboxMutation(discardInboxItem);
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
