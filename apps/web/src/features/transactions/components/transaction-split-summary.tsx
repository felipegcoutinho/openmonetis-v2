import { CheckCircle2, CircleAlert } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";

import { formatPercentageInput } from "./transaction-split-input";

type SplitEditor = ReturnType<typeof useTransactionSplitEditor>;

/** Always-visible status bar above the dialog actions: what is left and whether it can be saved. */
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
  draft: SplitEditor["draft"];
  splitMode: SplitEditor["splitMode"];
  total: SplitEditor["total"];
  allocation: SplitEditor["allocation"];
  allocationExceeded: SplitEditor["allocationExceeded"];
  canSave: SplitEditor["canSave"];
  differenceCents: SplitEditor["differenceCents"];
  distributedPercentage: SplitEditor["distributedPercentage"];
  hasAllocationIssue: SplitEditor["hasAllocationIssue"];
  hasInvalidAllocation: SplitEditor["hasInvalidAllocation"];
  percentageDifferenceBasisPoints: SplitEditor["percentageDifferenceBasisPoints"];
}) {
  const needsMorePeople = draft.length < 2;
  const isPercentage = splitMode === "percentage";
  const tone = canSave
    ? "success"
    : hasAllocationIssue && !needsMorePeople
      ? "destructive"
      : "neutral";

  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <p
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            tone === "success" && "text-success",
            tone === "destructive" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {canSave ? (
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span>
            {needsMorePeople ? (
              "Marque mais uma pessoa para dividir"
            ) : hasInvalidAllocation ? (
              isPercentage ? (
                "Use percentuais entre 0% e 100%"
              ) : (
                "Informe o valor de cada pessoa"
              )
            ) : isPercentage && percentageDifferenceBasisPoints > 0 ? (
              `Faltam ${formatPercentageInput(percentageDifferenceBasisPoints / 100)}%`
            ) : isPercentage && percentageDifferenceBasisPoints < 0 ? (
              `Passou ${formatPercentageInput(Math.abs(percentageDifferenceBasisPoints) / 100)}%`
            ) : differenceCents > 0 ? (
              <>
                Faltam <MoneyValue amount={differenceCents / 100} />
              </>
            ) : differenceCents < 0 ? (
              <>
                Passou <MoneyValue amount={Math.abs(differenceCents) / 100} />
              </>
            ) : (
              "Tudo distribuído"
            )}
          </span>
        </p>
        <p className="text-muted-foreground tabular-nums">
          {isPercentage ? (
            `${formatPercentageInput(allocation.percentageBasisPoints / 100)}% de 100%`
          ) : (
            <>
              <MoneyValue amount={allocation.allocatedCents / 100} /> de{" "}
              <MoneyValue amount={total} className="font-medium text-foreground" />
            </>
          )}
        </p>
      </div>

      <Progress
        aria-label={`${Math.round(distributedPercentage)}% do valor distribuído`}
        indicatorClassName={cn(
          tone === "success" && "bg-success",
          !canSave && allocationExceeded && "bg-destructive",
          !canSave && !allocationExceeded && "bg-muted-foreground",
        )}
        value={distributedPercentage}
      />
    </div>
  );
}
