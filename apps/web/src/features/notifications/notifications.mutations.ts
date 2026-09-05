import type { NotificationsOutput } from "@openmonetis/validators/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateNotificationState } from "./notifications.api";
import { notificationKeys } from "./notifications.queries";

export type UpdateNotificationVariables = {
  notificationKey: string;
  fingerprint: string;
  isRead?: boolean;
  isArchived?: boolean;
};

export function useUpdateNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notificationKey, ...input }: UpdateNotificationVariables) =>
      updateNotificationState(notificationKey, input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = queryClient.getQueryData<NotificationsOutput>(notificationKeys.all);
      if (!previous) return { previous };

      const changedAt = new Date().toISOString();
      const items = previous.items.map((item) => {
        if (item.notificationKey !== variables.notificationKey) return item;
        const isArchived = variables.isArchived ?? item.isArchived;
        const isRead = isArchived || (variables.isRead ?? item.isRead);
        return {
          ...item,
          isRead,
          isArchived,
          readAt: isRead ? (item.readAt ?? changedAt) : null,
          archivedAt: isArchived ? (item.archivedAt ?? changedAt) : null,
        };
      });
      const activeItems = items.filter((item) => !item.isArchived);

      queryClient.setQueryData<NotificationsOutput>(notificationKeys.all, {
        ...previous,
        items,
        activeCount: activeItems.length,
        archivedCount: items.length - activeItems.length,
        unreadCount: activeItems.filter((item) => !item.isRead).length,
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationKeys.all, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
