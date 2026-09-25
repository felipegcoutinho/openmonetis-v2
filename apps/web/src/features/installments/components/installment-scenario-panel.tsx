import type { InstallmentQuoteOutput } from "@openmonetis/validators/installments";
import { Calculator, CheckCheck, RotateCcw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type InstallmentScenarioPanelProps = {
  allPendingSelected: boolean;
  hasPendingInstallments: boolean;
  isQuoting: boolean;
  onClear: () => void;
  onSelectAll: () => void;
  quote: InstallmentQuoteOutput | null;
  selectedCount: number;
};

export function InstallmentScenarioPanel({
  allPendingSelected,
  hasPendingInstallments,
  isQuoting,
  onClear,
  onSelectAll,
  quote,
  selectedCount,
}: InstallmentScenarioPanelProps) {
  return (
    <Card className="gap-0 border-brand-strong/15 bg-brand/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-brand-strong shadow-xs">
            <Calculator aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-medium">Simulação de quitação</p>
            {selectedCount === 0 ? (
              <p className="mt-1 text-muted-foreground text-sm">
                Selecione parcelas pendentes para simular o valor da quitação. Nada será alterado.
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {isQuoting || !quote ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <MoneyValue amount={quote.totalAmount} className="text-2xl font-semibold" />
                )}
                <span className="text-muted-foreground text-sm">
                  {selectedCount}{" "}
                  {selectedCount === 1 ? "parcela selecionada" : "parcelas selecionadas"}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {selectedCount > 0 ? (
            <Button onClick={onClear} type="button" variant="ghost">
              <RotateCcw aria-hidden="true" />
              Limpar
            </Button>
          ) : null}
          <Button
            disabled={!hasPendingInstallments}
            onClick={allPendingSelected ? onClear : onSelectAll}
            type="button"
            variant="outline"
          >
            <CheckCheck aria-hidden="true" />
            {allPendingSelected ? "Desmarcar todas" : "Selecionar pendentes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
