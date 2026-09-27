import type { BudgetOutput } from "@openmonetis/validators/budgets";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import {
  budgetProgressStyles,
  budgetStatusLabels,
  budgetStatusStyles,
  formatBudgetPercentage,
} from "../budgets.presentation";

type BudgetCardProps = {
  budget: BudgetOutput;
  categorySlug?: string;
  onEdit: (budget: BudgetOutput) => void;
  onRemove: (budget: BudgetOutput) => Promise<void>;
  pending?: boolean;
};

export function BudgetCard({
  budget,
  categorySlug,
  onEdit,
  onRemove,
  pending = false,
}: BudgetCardProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const exceeded = budget.status === "exceeded";

  return (
    <Card className="gap-5 border">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <CategoryIcon className="size-5" name={budget.categoryIcon} />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate">{budget.categoryName}</CardTitle>
              <p className="mt-0.5 text-muted-foreground text-xs">Limite mensal</p>
            </div>
          </div>
          <Badge
            className={cn("border-transparent", budgetStatusStyles[budget.status])}
            variant="outline"
          >
            {budgetStatusLabels[budget.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div>
          <p className="text-muted-foreground text-xs">Consumo do limite</p>
          <p className="mt-1 text-2xl font-medium">
            <MoneyValue amount={budget.committedAmount} />
            <span className="text-sm text-muted-foreground">
              {" "}
              de <MoneyValue amount={budget.amount} />
            </span>
          </p>
          <p className={cn("mt-2 text-sm", exceeded && "text-destructive")}>
            {exceeded ? "Acima do limite: " : "Restam: "}
            <MoneyValue amount={exceeded ? budget.exceededAmount : budget.remainingAmount} />
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium tabular-nums">
              {formatBudgetPercentage(budget.usagePercentage)}%
            </span>
          </div>
          <Progress
            aria-label={`${formatBudgetPercentage(budget.usagePercentage)}% do orçamento de ${budget.categoryName} comprometido`}
            indicatorClassName={budgetProgressStyles[budget.status]}
            value={Math.min(budget.usagePercentage, 100)}
          />
          <p className="text-muted-foreground text-xs">
            <MoneyValue amount={budget.actualSpentAmount} /> lançados +{" "}
            <MoneyValue amount={budget.projectedAmount} /> em recorrências previstas
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3 border-t pt-3">
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onEdit(budget)}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editar
        </button>
        {categorySlug ? (
          <Link
            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            search={{ categories: categorySlug, period: budget.period, type: "expense" }}
            to="/transactions"
          >
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
            Lançamentos
          </Link>
        ) : null}
        <button
          className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-destructive text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pending}
          onClick={() => setRemoveOpen(true)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          Remover
        </button>
      </CardFooter>

      <AlertDialog onOpenChange={setRemoveOpen} open={removeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O limite de &quot;{budget.categoryName}&quot; será removido apenas deste mês. Os
              lançamentos da categoria não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                void (async () => {
                  try {
                    await onRemove(budget);
                    setRemoveOpen(false);
                  } catch {
                    // The page keeps the confirmation open and presents the error in a toast.
                  }
                })();
              }}
              variant="destructive"
            >
              {pending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
