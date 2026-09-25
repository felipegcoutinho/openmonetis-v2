import type { BudgetOutput, UpdateBudgetInput } from "@openmonetis/validators/budgets";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, RefreshCw, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { cn } from "@/lib/utils";
import { useUpdateBudgetMutation } from "../budgets.mutations";
import {
  budgetProgressStyles,
  formatBudgetPercentage,
  getBudgetWidgetItems,
} from "../budgets.presentation";
import { budgetsQueryOptions } from "../budgets.queries";
import { BudgetDialog } from "./budget-dialog";

const maximumVisibleBudgets = 4;

export function BudgetsWidget({ period }: { period: string }) {
  const query = useQuery(budgetsQueryOptions(period));
  const updateMutation = useUpdateBudgetMutation();
  const [listOpen, setListOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetOutput | null>(null);
  const items = getBudgetWidgetItems(query.data?.items ?? []);
  const visibleItems = items.slice(0, maximumVisibleBudgets);
  const hiddenCount = Math.max(0, items.length - maximumVisibleBudgets);

  const editBudget = (budget: BudgetOutput) => {
    setListOpen(false);
    setEditingBudget(budget);
  };

  return (
    <>
      <DashboardWidget
        description="Realizado mais recorrências previstas"
        footer={
          items.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              {hiddenCount > 0 ? (
                <DashboardWidgetListSheet
                  description="Orçamentos ordenados do maior para o menor percentual comprometido."
                  onOpenChange={setListOpen}
                  open={listOpen}
                  title="Todos os orçamentos"
                  triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "orçamento" : "orçamentos"}`}
                >
                  <BudgetProgressList items={items} onEdit={editBudget} period={period} />
                </DashboardWidgetListSheet>
              ) : null}
              <Link
                className={dashboardWidgetFooterNavigationLinkClassName}
                search={{ period }}
                to="/budgets"
              >
                Ver orçamentos <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : (
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              search={{ period }}
              to="/budgets"
            >
              Criar orçamento <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )
        }
        icon={<Target aria-hidden="true" />}
        title="Progresso de orçamentos"
      >
        {query.isLoading ? <BudgetsWidgetLoading /> : null}
        {query.isError ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="font-medium text-sm">Não foi possível carregar os orçamentos</p>
              <Button
                className="mt-3"
                onClick={() => void query.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : null}
        {query.data && !query.isError ? (
          items.length === 0 ? (
            <DashboardWidgetEmptyState
              description="O progresso dos orçamentos aparecerá aqui."
              icon={<Target aria-hidden="true" />}
              title="Nenhum orçamento neste mês"
            />
          ) : (
            <BudgetProgressList items={visibleItems} onEdit={editBudget} period={period} />
          )
        ) : null}
      </DashboardWidget>
      <BudgetDialog
        budget={editingBudget}
        categories={[]}
        key={`${editingBudget?.id ?? "closed"}-${editingBudget ? "open" : "closed"}`}
        onOpenChange={(open) => {
          if (!open) setEditingBudget(null);
        }}
        onSubmit={async (input) => {
          if (!editingBudget) return;
          await updateMutation.mutateAsync({
            id: editingBudget.id,
            input: input as UpdateBudgetInput,
            period,
          });
          toast.success("Orçamento atualizado");
        }}
        open={Boolean(editingBudget)}
        period={period}
      />
    </>
  );
}

function BudgetProgressList({
  items,
  onEdit,
  period,
}: {
  items: BudgetOutput[];
  onEdit: (budget: BudgetOutput) => void;
  period: string;
}) {
  return (
    <ul className="divide-y">
      {items.map((budget) => (
        <BudgetProgressRow budget={budget} key={budget.id} onEdit={onEdit} period={period} />
      ))}
    </ul>
  );
}

function BudgetProgressRow({
  budget,
  onEdit,
  period,
}: {
  budget: BudgetOutput;
  onEdit: (budget: BudgetOutput) => void;
  period: string;
}) {
  const exceeded = budget.status === "exceeded";
  const percentage = formatBudgetPercentage(budget.usagePercentage);

  return (
    <DashboardWidgetRow structure="progress">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <CategoryIcon className="size-4" name={budget.categoryIcon} />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Link
              className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              params={{ categoryId: budget.categoryId }}
              search={{ period }}
              to="/categories/$categoryId"
            >
              <span className="truncate">{budget.categoryName}</span>
              <DashboardItemLinkArrow />
            </Link>
            <span className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "font-medium text-xs tabular-nums",
                  budget.status === "onTrack" && "text-success",
                  (budget.status === "warning" || budget.status === "reached") && "text-warning",
                  exceeded && "text-destructive",
                )}
              >
                {percentage}%
              </span>
              <Button
                aria-label={`Editar orçamento de ${budget.categoryName}`}
                className="size-7 text-muted-foreground"
                onClick={() => onEdit(budget)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
              </Button>
            </span>
          </div>
          <p className="mt-0.5 truncate text-muted-foreground text-xs">
            <MoneyValue amount={budget.committedAmount} className="text-xs" /> de{" "}
            <MoneyValue amount={budget.amount} className="text-xs" />
            <span aria-hidden="true"> · </span>
            <span className={cn(exceeded && "font-medium text-destructive")}>
              {exceeded ? (
                <>
                  excedeu <MoneyValue amount={budget.exceededAmount} className="text-xs" />
                </>
              ) : (
                <>
                  restam <MoneyValue amount={budget.remainingAmount} className="text-xs" />
                </>
              )}
            </span>
          </p>
        </div>
        <Progress
          aria-label={`${percentage}% do orçamento de ${budget.categoryName} comprometido`}
          indicatorClassName={budgetProgressStyles[budget.status]}
          trackClassName={cn(
            "h-1",
            budget.status === "warning" && "bg-warning/20",
            budget.status === "reached" && "bg-warning/20",
            exceeded && "bg-destructive/20",
          )}
          value={Math.min(budget.usagePercentage, 100)}
        />
      </div>
    </DashboardWidgetRow>
  );
}

function BudgetsWidgetLoading() {
  return (
    <div aria-label="Carregando progresso dos orçamentos" className="grid gap-4" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <div className="grid gap-2" key={key}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <div className="ml-12">
            <Skeleton className="h-1 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
