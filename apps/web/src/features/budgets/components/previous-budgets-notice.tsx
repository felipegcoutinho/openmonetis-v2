import { getPreviousBudgetPeriod } from "@openmonetis/domain/budgets";
import { useQuery } from "@tanstack/react-query";
import { Repeat } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeCopyableBudgets, getCopyableBudgets } from "../budgets.presentation";
import { budgetsQueryOptions } from "../budgets.queries";

/**
 * Shows up only while the previous month has one-off limits missing here, so the copy flow is
 * offered when there is something to bring and fades away once limits become recurring.
 */
export function PreviousBudgetsNotice({
  currentCategoryIds,
  onOpen,
  period,
}: {
  currentCategoryIds: string[];
  onOpen: () => void;
  period: string;
}) {
  const previousPeriod = getPreviousBudgetPeriod(period);
  const previousQuery = useQuery(budgetsQueryOptions(previousPeriod));
  const count = previousQuery.data
    ? getCopyableBudgets(previousQuery.data.items, currentCategoryIds).length
    : 0;
  if (count === 0) return null;

  return (
    // Neutral card surface and a single row, so the notice reads as part of the list.
    <Alert
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Repeat aria-hidden="true" className="size-4" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <AlertTitle>{describeCopyableBudgets(count, previousPeriod)}</AlertTitle>
          <AlertDescription>
            {count === 1
              ? "Traga esse limite para este mês e deixe que se repita nos próximos."
              : "Traga esses limites para este mês e deixe que se repitam nos próximos."}
          </AlertDescription>
        </div>
      </div>
      <Button
        className="shrink-0 self-start sm:self-auto"
        onClick={onOpen}
        size="sm"
        type="button"
        variant="outline"
      >
        <Repeat aria-hidden="true" />
        {count === 1 ? "Repetir este limite" : "Repetir esses limites"}
      </Button>
    </Alert>
  );
}
