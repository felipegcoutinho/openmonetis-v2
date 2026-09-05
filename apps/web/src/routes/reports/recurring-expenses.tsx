import { createFileRoute } from "@tanstack/react-router";
import { RecurringExpensesReportPage } from "@/features/recurring-expenses/components/recurring-expenses-report-page";
import {
  resolveRecurringExpensesReportPeriod,
  validateRecurringExpensesReportSearch,
} from "@/features/recurring-expenses/recurring-expenses.presentation";

export const Route = createFileRoute("/reports/recurring-expenses")({
  component: RecurringExpensesReportRoute,
  validateSearch: validateRecurringExpensesReportSearch,
});

function RecurringExpensesReportRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <RecurringExpensesReportPage
      onPeriodChange={(period) => navigate({ replace: true, search: { period } })}
      period={resolveRecurringExpensesReportPeriod(search)}
    />
  );
}
