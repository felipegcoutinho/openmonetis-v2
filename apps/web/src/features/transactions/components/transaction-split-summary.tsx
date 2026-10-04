import { CheckCircle2, CircleAlert } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";

import { formatPercentageInput } from "./transaction-split-input";

export function TransactionSplitSummary({
  draft,
  splitMode,
  total,
  allocation,
  allocationExceeded,
  canSave,
  differenceCents,
  distributedPercentage,
  hasAllocationIssue,
  hasInvalidAllocation,
  percentageDifferenceBasisPoints,
}: {
  draft: ReturnType<typeof useTransactionSplitEditor>["draft"];
  splitMode: ReturnType<typeof useTransactionSplitEditor>["splitMode"];
  total: ReturnType<typeof useTransactionSplitEditor>["total"];
  allocation: ReturnType<typeof useTransactionSplitEditor>["allocation"];
  allocationExceeded: ReturnType<typeof useTransactionSplitEditor>["allocationExceeded"];
  canSave: ReturnType<typeof useTransactionSplitEditor>["canSave"];
  differenceCents: ReturnType<typeof useTransactionSplitEditor>["differenceCents"];
  distributedPercentage: ReturnType<typeof useTransactionSplitEditor>["distributedPercentage"];
  hasAllocationIssue: ReturnType<typeof useTransactionSplitEditor>["hasAllocationIssue"];
  hasInvalidAllocation: ReturnType<typeof useTransactionSplitEditor>["hasInvalidAllocation"];
  percentageDifferenceBasisPoints: ReturnType<
    typeof useTransactionSplitEditor
  >["percentageDifferenceBasisPoints"];
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-4",
        canSave
          ? "border-success/20 bg-success/5"
          : hasAllocationIssue
            ? "border-destructive/30 bg-destructive/5"
            : "border-info/20 bg-info/5",
      )}
    >
      <div>
        <p className="text-muted-foreground text-xs">Total do lançamento</p>
        <MoneyValue amount={total} className="font-semibold text-lg" />
      </div>

      <Progress
        aria-label={`${Math.round(distributedPercentage)}% do valor distribuído`}
        indicatorClassName={cn(
          canSave && "bg-success",
          !canSave && allocationExceeded && "bg-destructive",
          !canSave && !allocationExceeded && "bg-info",
        )}
        value={distributedPercentage}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            canSave ? "text-success" : hasAllocationIssue ? "text-destructive" : "text-info",
          )}
        >
          {canSave ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-4" />
          )}
          {draft.length < 2 ? (
            "Selecione pelo menos mais uma pessoa"
          ) : hasInvalidAllocation ? (
            splitMode === "percentage" ? (
              "Informe um percentual entre 0% e 100% para cada pessoa"
            ) : (
              "Informe um valor para cada pessoa"
            )
          ) : splitMode === "percentage" && percentageDifferenceBasisPoints > 0 ? (
            `Falta distribuir ${formatPercentageInput(percentageDifferenceBasisPoints / 100)}%`
          ) : splitMode === "percentage" && percentageDifferenceBasisPoints < 0 ? (
            `Excedeu ${formatPercentageInput(Math.abs(percentageDifferenceBasisPoints) / 100)}%`
          ) : differenceCents > 0 ? (
            <>
              Falta distribuir <MoneyValue amount={differenceCents / 100} />
            </>
          ) : differenceCents < 0 ? (
            <>
              Excedeu <MoneyValue amount={Math.abs(differenceCents) / 100} />
            </>
          ) : (
            "Valor totalmente distribuído"
          )}
        </span>
        <span className="text-muted-foreground">
          {splitMode === "percentage" ? (
            `Distribuído: ${formatPercentageInput(allocation.percentageBasisPoints / 100)}%`
          ) : (
            <>
              Distribuído: <MoneyValue amount={allocation.allocatedCents / 100} />
            </>
          )}
        </span>
      </div>
    </div>
  );
}
