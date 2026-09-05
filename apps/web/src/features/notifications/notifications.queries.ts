import { queryOptions } from "@tanstack/react-query";
import { getNotifications } from "./notifications.api";

export const notificationKeys = {
  all: ["notifications"] as const,
};

export function notificationsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: notificationKeys.all,
    queryFn: getNotifications,
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
