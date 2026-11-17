import { getCurrentPeriodInBrazil, isCalendarPeriod } from "@openmonetis/shared/date-time";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/features/calendar/components/calendar-page";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendário · OpenMonetis" }] }),
  component: CalendarRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    period: isCalendarPeriod(search.period) ? search.period : undefined,
  }),
});

function CalendarRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <CalendarPage
      onPeriodChange={(nextPeriod) =>
        navigate({ replace: true, search: (previous) => ({ ...previous, period: nextPeriod }) })
      }
      period={search.period ?? getCurrentPeriodInBrazil()}
    />
  );
}
