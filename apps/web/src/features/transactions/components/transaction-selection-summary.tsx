import type { TransactionSelectionSummary as SelectionSummary } from "@openmonetis/domain/transactions";
import { X } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TransactionSelectionSummaryProps = {
  className?: string;
  onClear: () => void;
  summary: SelectionSummary;
};

export function TransactionSelectionSummary({
  className,
  onClear,
  summary,
}: TransactionSelectionSummaryProps) {
  if (!summary.selectedCount) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-popover p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <strong>
          {summary.selectedCount} selecionado{summary.selectedCount === 1 ? "" : "s"}
        </strong>
        <span className="text-muted-foreground">
          Entradas{" "}
          <MoneyValue
            amount={summary.inflow}
            className="font-medium text-success"
            showPositiveSign
          />
        </span>
        <span className="text-muted-foreground">
          Despesas <MoneyValue amount={-summary.outflow} className="font-medium text-foreground" />
        </span>
        <span className="text-muted-foreground">
          Saldo{" "}
          <MoneyValue
            amount={summary.balance}
            className={cn(
              "font-semibold",
              summary.balance > 0 && "text-success",
              summary.balance < 0 && "text-destructive",
            )}
            showPositiveSign
          />
        </span>
        {summary.neutralCount ? (
          <span className="text-muted-foreground text-xs">
            {summary.neutralCount} neutro{summary.neutralCount === 1 ? "" : "s"} fora do saldo
          </span>
        ) : null}
      </div>
      <Button onClick={onClear} size="sm" variant="ghost">
        <X aria-hidden="true" /> Limpar
      </Button>
    </div>
  );
}
