import { createFileRoute } from "@tanstack/react-router";
import { getCurrentPeriod } from "@/components/month-navigation";
import { BudgetsPage } from "@/features/budgets/components/budgets-page";

export const Route = createFileRoute("/budgets")({
  component: BudgetsRoute,
  validateSearch: validateBudgetsSearch,
});

function BudgetsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const period = search.period ?? getCurrentPeriod();

  return (
    <BudgetsPage
      onPeriodChange={(nextPeriod) =>
        navigate({
          replace: true,
          search: (previous) => ({ ...previous, period: nextPeriod }),
        })
      }
      period={period}
    />
  );
}

function validateBudgetsSearch(search: Record<string, unknown>) {
  return {
    period:
      typeof search.period === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(search.period)
        ? search.period
        : undefined,
  };
}
