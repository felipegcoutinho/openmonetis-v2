import type {
  NotificationsOutput,
  UpdateNotificationStateInput,
} from "@openmonetis/validators/notifications";
import { requestApi } from "@/lib/api-client";

export function getNotifications() {
  return requestApi<NotificationsOutput>("/notifications");
}

export function updateNotificationState(
  notificationKey: string,
  input: UpdateNotificationStateInput,
) {
  return requestApi<{ notificationKey: string; isRead: boolean; isArchived: boolean }>(
    `/notifications/${encodeURIComponent(notificationKey)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
