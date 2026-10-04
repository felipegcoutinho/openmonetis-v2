import type { NotificationOutput } from "@openmonetis/validators/notifications";

import type { UpdateNotificationVariables } from "../notifications.mutations";

import type { NotificationView } from "./notification-panel.types";
import { NotificationRow } from "./notification-row";

export function NotificationList({
  busyKey,
  items,
  onNavigate,
  onStateChange,
  view,
}: {
  busyKey: string | null;
  items: NotificationOutput[];
  onNavigate: (notification: NotificationOutput) => void;
  onStateChange: (state: UpdateNotificationVariables) => void;
  view: NotificationView;
}) {
  const urgent = items.filter((item) => item.severity === "critical");
  const upcoming = items.filter((item) => item.severity !== "critical");
  const sections =
    view === "archived"
      ? [{ label: "Arquivadas", items }]
      : [
          { label: "Precisa de atenção", items: urgent },
          { label: "Próximos passos", items: upcoming },
        ];

  return (
    <div className="grid gap-5 px-4 py-5">
      {sections.map((section) =>
        section.items.length > 0 ? (
          <section className="grid gap-2" key={section.label}>
            <h2 className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {section.label}
            </h2>
            <ul className="grid gap-2">
              {section.items.map((notification) => (
                <NotificationRow
                  busy={busyKey === notification.notificationKey}
                  key={notification.notificationKey}
                  notification={notification}
                  onNavigate={onNavigate}
                  onStateChange={onStateChange}
                />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
