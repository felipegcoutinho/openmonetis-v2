import type { InboxItemStatus } from "@openmonetis/domain/inbox";
import { inboxSourceAppNameMaximumLength } from "@openmonetis/domain/inbox";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { InboxPage } from "@/features/inbox/components/inbox-page";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "Caixa de entrada · OpenMonetis" }] }),
  component: InboxRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    status: ["pending", "processed", "discarded"].includes(String(search.status))
      ? (search.status as InboxItemStatus)
      : undefined,
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) > 1
        ? Number(search.page)
        : undefined,
    app:
      typeof search.app === "string" &&
      search.app.trim().length > 0 &&
      search.app.length <= inboxSourceAppNameMaximumLength
        ? search.app.trim()
        : undefined,
    date: isInboxNotificationDate(search.date) ? search.date : undefined,
    rule:
      typeof search.rule === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search.rule)
        ? search.rule
        : undefined,
  }),
});

function InboxRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <InboxPage
          onSearchChange={(next) =>
            navigate({
              replace: true,
              search: (previous) => ({ ...previous, ...next }),
            })
          }
          page={search.page ?? 1}
          notificationDate={search.date}
          ruleId={search.rule}
          sourceAppName={search.app}
          status={search.status ?? "pending"}
        />
      </main>
    </ProtectedRoute>
  );
}

function isInboxNotificationDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}
