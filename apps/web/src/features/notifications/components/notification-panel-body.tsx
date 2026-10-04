import type {
  NotificationOutput,
  NotificationsOutput,
} from "@openmonetis/validators/notifications";

import type { UpdateNotificationVariables } from "../notifications.mutations";
import { NotificationList } from "./notification-list";
import type { NotificationView } from "./notification-panel.types";
import {
  NotificationPanelEmpty,
  NotificationPanelError,
  NotificationPanelLoading,
} from "./notification-panel-states";

export function NotificationPanelBody({
  busyKey,
  data,
  isError,
  isLoading,
  onNavigate,
  onRetry,
  onStateChange,
  view,
}: {
  busyKey: string | null;
  data: NotificationsOutput | undefined;
  isError: boolean;
  isLoading: boolean;
  onNavigate: (notification: NotificationOutput) => void;
  onRetry: () => void;
  onStateChange: (state: UpdateNotificationVariables) => void;
  view: NotificationView;
}) {
  if (isLoading) return <NotificationPanelLoading />;
  if (isError) return <NotificationPanelError onRetry={onRetry} />;
  if (!data) return null;

  const items = data.items.filter((item) =>
    view === "archived" ? item.isArchived : !item.isArchived,
  );
  if (items.length === 0) return <NotificationPanelEmpty view={view} />;

  return (
    <NotificationList
      busyKey={busyKey}
      items={items}
      onNavigate={onNavigate}
      onStateChange={onStateChange}
      view={view}
    />
  );
}
