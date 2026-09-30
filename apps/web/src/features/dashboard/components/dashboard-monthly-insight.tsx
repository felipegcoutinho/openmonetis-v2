import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChartPie, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { dashboardCategoryBreakdownQueryOptions } from "../dashboard.queries";
import { useAdminPersonSlug } from "../useAdminPersonSlug";
import { DashboardWidget } from "./dashboard-widget";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetRow } from "./dashboard-widget-row";

const maximumVisibleCategories = 5;

export function DashboardMonthlyInsight({ period }: { period: string }) {
  const query = useQuery(dashboardCategoryBreakdownQueryOptions(period));
  const adminPersonSlug = useAdminPersonSlug();
  const expenses = query.data?.expenses.slice(0, maximumVisibleCategories) ?? [];

  return (
    <DashboardWidget
      className="h-auto min-h-0"
      description="Principais categorias deste mês"
      footer={
        adminPersonSlug ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ people: adminPersonSlug, period, type: "expense" }}
            to="/transactions"
          >
            Ver análise completa <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<ChartPie aria-hidden="true" />}
      title="Onde você mais gastou"
    >
      {query.isPending ? (
        <div className="grid gap-3 py-2" role="status">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {query.isError ? (
        <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      ) : null}
      {query.data && !query.isError ? (
        expenses.length > 0 ? (
          <ol className="divide-y">
            {expenses.map((expense) => (
              <DashboardWidgetRow key={expense.categoryId}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <CategoryIcon className="size-4" name={expense.categoryIcon} />
                </span>
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium text-sm">
                      {expense.categoryName}
                    </span>
                    <MoneyValue amount={expense.amount} className="shrink-0 font-medium text-sm" />
                  </div>
                  <Progress
                    aria-label={`${expense.categoryName}: ${expense.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% das despesas`}
                    indicatorClassName="bg-primary/75"
                    trackClassName="h-1"
                    value={Math.max(0, Math.min(100, expense.percentage))}
                  />
                </div>
              </DashboardWidgetRow>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nenhuma despesa neste mês.
          </p>
        )
      ) : null}
    </DashboardWidget>
  );
}
