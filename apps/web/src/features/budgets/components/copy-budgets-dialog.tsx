import type { BudgetOutput, CopyPreviousBudgetsOutput } from "@openmonetis/validators/budgets";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import { useCopyPreviousBudgetsMutation } from "../budgets.mutations";
import { formatBudgetPeriod, getPreviousBudgetPeriod } from "../budgets.presentation";
import { budgetsQueryOptions } from "../budgets.queries";

type CopyBudgetsDialogProps = {
  currentCategoryIds: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  period: string;
};

export function CopyBudgetsDialog({
  currentCategoryIds,
  onOpenChange,
  open,
  period,
}: CopyBudgetsDialogProps) {
  const previousPeriod = getPreviousBudgetPeriod(period);
  const previousQuery = useQuery({ ...budgetsQueryOptions(previousPeriod), enabled: open });
  const copyMutation = useCopyPreviousBudgetsMutation();

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && copyMutation.isPending) return;
    if (!nextOpen) copyMutation.reset();
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent className="sm:max-w-xl" showCloseButton={!copyMutation.isPending}>
        <DialogHeader>
          <DialogTitle>Copiar limites do mês anterior</DialogTitle>
          <DialogDescription>
            Selecione os orçamentos de {formatBudgetPeriod(previousPeriod)} que deseja usar em{" "}
            {formatBudgetPeriod(period)}.
          </DialogDescription>
        </DialogHeader>

        {previousQuery.isLoading ? <CopyBudgetsLoading /> : null}

        {previousQuery.isError ? (
          <div className="grid justify-items-center gap-3 rounded-lg border border-dashed p-5 text-center">
            <p className="text-muted-foreground text-sm">
              Não foi possível carregar os orçamentos do mês anterior.
            </p>
            <Button
              onClick={() => void previousQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {previousQuery.data ? (
          <CopyBudgetSelection
            budgets={previousQuery.data.items}
            currentCategoryIds={currentCategoryIds}
            key={`${period}-${previousQuery.dataUpdatedAt}-${open ? "open" : "closed"}`}
            onCancel={() => changeOpen(false)}
            onCopy={async (sourceBudgetIds) => {
              const result = await copyMutation.mutateAsync({ period, sourceBudgetIds });
              showCopySuccess(result);
              changeOpen(false);
            }}
            pending={copyMutation.isPending}
            previousPeriod={previousPeriod}
          />
        ) : null}

        {previousQuery.isLoading || previousQuery.isError ? (
          <DialogFooter>
            <Button onClick={() => changeOpen(false)} type="button" variant="outline">
              Cancelar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CopyBudgetSelection({
  budgets,
  currentCategoryIds,
  onCancel,
  onCopy,
  pending,
  previousPeriod,
}: {
  budgets: BudgetOutput[];
  currentCategoryIds: string[];
  onCancel: () => void;
  onCopy: (sourceBudgetIds: string[]) => Promise<void>;
  pending: boolean;
  previousPeriod: string;
}) {
  const existingCategoryIds = new Set(currentCategoryIds);
  const availableBudgets = budgets.filter((budget) => !existingCategoryIds.has(budget.categoryId));
  const [selectedIds, setSelectedIds] = useState(availableBudgets.map((budget) => budget.id));
  const selectedSet = new Set(selectedIds);
  const allSelected = availableBudgets.length > 0 && selectedIds.length === availableBudgets.length;

  async function copySelected() {
    try {
      await onCopy(selectedIds);
    } catch {
      toast.error("Não foi possível copiar os orçamentos.", {
        description: "Tente novamente em instantes.",
      });
    }
  }

  return (
    <>
      {budgets.length > 0 ? (
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              {selectedIds.length} de {availableBudgets.length} selecionados
            </p>
            {availableBudgets.length > 0 ? (
              <Button
                disabled={pending}
                onClick={() =>
                  setSelectedIds(allSelected ? [] : availableBudgets.map((budget) => budget.id))
                }
                size="xs"
                type="button"
                variant="ghost"
              >
                {allSelected ? "Limpar seleção" : "Selecionar todos"}
              </Button>
            ) : null}
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {budgets.map((budget) => {
              const alreadyExists = existingCategoryIds.has(budget.categoryId);
              const fieldId = `copy-budget-${budget.id}`;
              return (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    alreadyExists && "bg-muted/30 opacity-70",
                  )}
                  key={budget.id}
                >
                  <Checkbox
                    checked={selectedSet.has(budget.id)}
                    disabled={alreadyExists || pending}
                    id={fieldId}
                    onCheckedChange={(checked) =>
                      setSelectedIds((current) =>
                        checked
                          ? current.includes(budget.id)
                            ? current
                            : [...current, budget.id]
                          : current.filter((id) => id !== budget.id),
                      )
                    }
                  />
                  <Label
                    className={cn(
                      "min-w-0 flex-1 gap-3 font-sans font-normal",
                      alreadyExists ? "cursor-not-allowed" : "cursor-pointer",
                    )}
                    htmlFor={fieldId}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <CategoryIcon className="size-4" name={budget.categoryIcon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">
                        {budget.categoryName}
                      </span>
                      <span className="block text-muted-foreground text-xs">
                        Limite de <MoneyValue amount={budget.amount} />
                      </span>
                    </span>
                  </Label>
                  {alreadyExists ? <Badge variant="secondary">Já existe</Badge> : null}
                </div>
              );
            })}
          </div>
          {availableBudgets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todos os limites do mês anterior já existem neste mês.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Copy aria-hidden="true" className="size-4" />
          </span>
          <p className="font-medium text-sm">Nenhum orçamento no mês anterior</p>
          <p className="text-muted-foreground text-xs">
            Não há limites definidos em {formatBudgetPeriod(previousPeriod)}.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button disabled={pending} onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <Button
          disabled={pending || selectedIds.length === 0}
          onClick={() => void copySelected()}
          type="button"
        >
          {pending
            ? "Copiando..."
            : selectedIds.length === 1
              ? "Copiar 1 orçamento"
              : `Copiar ${selectedIds.length} orçamentos`}
        </Button>
      </DialogFooter>
    </>
  );
}

function CopyBudgetsLoading() {
  return (
    <div aria-label="Carregando orçamentos do mês anterior" className="grid gap-2" role="status">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

function showCopySuccess(result: CopyPreviousBudgetsOutput) {
  if (result.createdCount === 0) {
    toast.info("Nenhum orçamento foi copiado", {
      description: "Os limites selecionados já existem neste mês.",
    });
    return;
  }

  toast.success(
    result.createdCount === 1
      ? "1 orçamento copiado do mês anterior"
      : `${result.createdCount} orçamentos copiados do mês anterior`,
    result.skippedCount > 0
      ? { description: `${result.skippedCount} já existiam e foram ignorados.` }
      : undefined,
  );
}
