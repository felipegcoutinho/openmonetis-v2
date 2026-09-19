import type { DashboardCategoryBreakdownOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChartPie, List, RefreshCw, Tags } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatDashboardTransactionCount } from "../dashboard.presentation";
import { dashboardCategoryBreakdownQueryOptions } from "../dashboard.queries";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { DashboardItemLinkArrow } from "./dashboard-item-link-arrow";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "./dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "./dashboard-widget-row";

type CategoryBreakdownItem = DashboardCategoryBreakdownOutput["expenses"][number];
type CategoryBreakdownVariant = "expense" | "income";

const maximumVisibleCategories = 4;

const variantContent = {
  expense: {
    description: "Onde os gastos do mês se concentram",
    emptyDescription: "As despesas por categoria aparecerão aqui.",
    emptyTitle: "Nenhuma despesa no mês",
    indicatorClassName: "bg-destructive/70",
    itemLabel: "despesas",
    title: "Despesas por categoria",
  },
  income: {
    description: "De onde vieram as receitas do mês",
    emptyDescription: "As receitas por categoria aparecerão aqui.",
    emptyTitle: "Nenhuma receita no mês",
    indicatorClassName: "bg-success/70",
    itemLabel: "receitas",
    title: "Receitas por categoria",
  },
} as const;

export function CategoryBreakdownWidget({
  period,
  variant,
}: {
  period: string;
  variant: CategoryBreakdownVariant;
}) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeView, setActiveView] = useState<"list" | "chart">("list");
  const query = useQuery(dashboardCategoryBreakdownQueryOptions(period));
  const config = variantContent[variant];
  const items = query.data?.[variant === "expense" ? "expenses" : "income"] ?? [];
  const visibleItems = items.slice(0, maximumVisibleCategories);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <DashboardWidget
      action={
        query.data && items.length > 0 ? (
          <Button
            aria-label={activeView === "list" ? "Exibir gráfico" : "Exibir lista"}
            aria-pressed={activeView === "chart"}
            onClick={() => setActiveView((view) => (view === "list" ? "chart" : "list"))}
            size="icon-sm"
            title={activeView === "list" ? "Exibir gráfico" : "Exibir lista"}
            type="button"
            variant="ghost"
          >
            {activeView === "list" ? <ChartPie aria-hidden="true" /> : <List aria-hidden="true" />}
          </Button>
        ) : null
      }
      description={config.description}
      footer={
        items.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            {hiddenCount > 0 ? (
              <DashboardWidgetListSheet
                description={`Participação de cada categoria no total de ${config.itemLabel} do mês.`}
                onOpenChange={setIsListOpen}
                open={isListOpen}
                title={config.title}
                triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "categoria" : "categorias"}`}
              >
                <CategoryBreakdownList
                  indicatorClassName={config.indicatorClassName}
                  items={items}
                  itemLabel={config.itemLabel}
                  period={period}
                />
              </DashboardWidgetListSheet>
            ) : (
              <span />
            )}
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              search={{ period, type: variant }}
              to="/transactions"
            >
              Ver {config.itemLabel} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<ChartPie aria-hidden="true" />}
      title={config.title}
    >
      {query.isLoading ? <CategoryBreakdownLoading /> : null}
      {query.isError ? <CategoryBreakdownError onRetry={() => void query.refetch()} /> : null}
      {query.data && !query.isError ? (
        items.length === 0 ? (
          <DashboardWidgetEmptyState
            description={config.emptyDescription}
            icon={<Tags aria-hidden="true" />}
            title={config.emptyTitle}
          />
        ) : activeView === "chart" ? (
          <div aria-busy={query.isFetching} className="flex flex-1 items-center">
            <CategoryBreakdownChart
              items={items}
              percentageDigits={variant === "expense" ? 0 : 1}
            />
          </div>
        ) : (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <CategoryBreakdownList
              indicatorClassName={config.indicatorClassName}
              items={visibleItems}
              itemLabel={config.itemLabel}
              period={period}
            />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function CategoryBreakdownList({
  indicatorClassName,
  items,
  itemLabel,
  period,
}: {
  indicatorClassName: string;
  items: CategoryBreakdownItem[];
  itemLabel: string;
  period: string;
}) {
  return (
    <ol className="divide-y">
      {items.map((item) => (
        <DashboardWidgetRow key={item.categoryId} structure="progress">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <CategoryIcon className="size-4" name={item.categoryIcon} />
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  className="group inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  params={{ categoryId: item.categoryId }}
                  search={{ period }}
                  to="/categories/$categoryId"
                >
                  <span className="truncate">{item.categoryName}</span>
                  <DashboardItemLinkArrow />
                </Link>
                <p className="mt-0.5 truncate text-muted-foreground text-xs">
                  {formatDashboardTransactionCount(item.count)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <MoneyValue amount={item.amount} className="font-medium text-sm" />
                <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
                  {formatPercentage(item.percentage)}%
                </p>
              </div>
            </div>
            <Progress
              aria-label={`${item.categoryName}: ${formatPercentage(item.percentage)}% das ${itemLabel}`}
              indicatorClassName={indicatorClassName}
              trackClassName="h-1"
              value={Math.max(0, Math.min(100, item.percentage))}
            />
          </div>
        </DashboardWidgetRow>
      ))}
    </ol>
  );
}

function CategoryBreakdownLoading() {
  return (
    <div aria-label="Carregando categorias" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-20 w-full" key={key} />
      ))}
    </div>
  );
}

function CategoryBreakdownError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar as categorias</p>
        <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}
