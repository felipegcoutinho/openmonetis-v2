import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChartPie, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { dashboardCategoryBreakdownQueryOptions } from "../dashboard.queries";
import { useAdminPersonSlug } from "../useAdminPersonSlug";

export function DashboardMonthlyInsight({ period }: { period: string }) {
  const query = useQuery(dashboardCategoryBreakdownQueryOptions(period));
  const adminPersonSlug = useAdminPersonSlug();
  const expenses = query.data?.expenses.slice(0, 3) ?? [];

  return (
    <Card className="gap-4 p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <ChartPie aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-medium">Onde você mais gastou</h2>
          <p className="text-muted-foreground text-xs">Principais categorias deste mês</p>
        </div>
      </header>

      {query.isPending ? (
        <div className="grid gap-3" role="status">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}
      {query.isError ? (
        <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      ) : null}
      {query.data && !query.isError ? (
        expenses.length > 0 ? (
          <ol className="grid gap-4">
            {expenses.map((expense) => (
              <li className="grid gap-2" key={expense.categoryId}>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                    <CategoryIcon className="size-4" name={expense.categoryIcon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-sm">
                    {expense.categoryName}
                  </span>
                  <MoneyValue amount={expense.amount} className="font-medium text-sm" />
                </div>
                <Progress
                  aria-label={`${expense.categoryName}: ${expense.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% das despesas`}
                  indicatorClassName="bg-primary/75"
                  trackClassName="h-1"
                  value={Math.max(0, Math.min(100, expense.percentage))}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nenhuma despesa neste mês.
          </p>
        )
      ) : null}

      {adminPersonSlug ? (
        <Link
          className="flex items-center justify-end gap-1 font-medium text-primary text-xs"
          search={{ people: adminPersonSlug, period, type: "expense" }}
          to="/transactions"
        >
          Ver análise completa <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </Card>
  );
}
