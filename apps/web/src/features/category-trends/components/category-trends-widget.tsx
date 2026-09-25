import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, LineChart, Minus, RefreshCw, Repeat2 } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryIcon } from "@/features/categories/category-icons";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { cn } from "@/lib/utils";
import {
  formatTrendPercentage,
  getCategoryTrendsPeriodRange,
  getCategoryTrendWidgetItems,
} from "../category-trends.presentation";
import { categoryTrendsQueryOptions } from "../category-trends.queries";

const maximumVisibleTrends = 5;

type TrendItem = ReturnType<typeof getCategoryTrendWidgetItems>[number];

export function CategoryTrendsWidget({ period }: { period: string }) {
  const filters = { startPeriod: period, endPeriod: period, categoryIds: [] };
  const reportPeriodRange = getCategoryTrendsPeriodRange("end", period);
  const query = useQuery({
    ...categoryTrendsQueryOptions(filters),
    placeholderData: undefined,
  });
  const [listOpen, setListOpen] = useState(false);
  const items = getCategoryTrendWidgetItems(query.data?.categories ?? [], period);
  const visibleItems = items.slice(0, maximumVisibleTrends);
  const hiddenCount = Math.max(0, items.length - maximumVisibleTrends);

  return (
    <DashboardWidget
      description="Maiores variações de despesas vs. mês anterior"
      footer={
        items.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            {hiddenCount > 0 ? (
              <DashboardWidgetListSheet
                description="Categorias ordenadas pelo impacto financeiro da variação mensal."
                onOpenChange={setListOpen}
                open={listOpen}
                title="Todas as tendências"
                triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "categoria" : "categorias"}`}
              >
                <CategoryTrendList items={items} period={period} />
              </DashboardWidgetListSheet>
            ) : null}
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              search={reportPeriodRange}
              to="/reports/category-trends"
            >
              Ver relatório <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<LineChart aria-hidden="true" />}
      title="Tendências de categorias"
    >
      {query.isLoading ? <CategoryTrendsLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar as tendências</p>
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
            description="As variações mensais aparecerão aqui."
            icon={<LineChart aria-hidden="true" />}
            title="Nenhum período comparável"
          />
        ) : (
          <CategoryTrendList items={visibleItems} period={period} />
        )
      ) : null}
    </DashboardWidget>
  );
}

function CategoryTrendList({ items, period }: { items: TrendItem[]; period: string }) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <CategoryTrendRow item={item} key={item.category.categoryId} period={period} />
      ))}
    </ul>
  );
}

function CategoryTrendRow({ item, period }: { item: TrendItem; period: string }) {
  const { category, value } = item;
  const increased = value.changeKind === "increase";
  const decreased = value.changeKind === "decrease";
  const ChangeIcon = increased ? ArrowUp : decreased ? ArrowDown : Minus;

  return (
    <DashboardWidgetRow>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <CategoryIcon className="size-4" name={category.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            params={{ categoryId: category.categoryId }}
            search={{ period }}
            to="/categories/$categoryId"
          >
            <span className="truncate">{category.name}</span>
            <DashboardItemLinkArrow />
          </Link>
          {value.recurringAmount > 0 ? (
            <Tooltip>
              <TooltipTrigger
                aria-label="Inclui recorrências previstas"
                className="shrink-0 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Repeat2 aria-hidden="true" className="size-3" />
              </TooltipTrigger>
              <TooltipContent>
                Inclui <MoneyValue amount={value.recurringAmount} /> em recorrências previstas
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
          <MoneyValue amount={value.previousAmount} className="text-xs" />
          <ArrowRight aria-hidden="true" className="size-3" />
          <MoneyValue amount={value.totalAmount} className="font-medium text-xs" />
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "grid shrink-0 justify-items-end gap-0.5 rounded-sm font-medium text-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            increased && "text-destructive",
            decreased && "text-success",
            !increased && !decreased && "text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-0.5">
            <ChangeIcon aria-hidden="true" className="size-3.5" />
            {formatTrendPercentage(value.changePercentage, value.changeKind)}
          </span>
          <span className="font-normal text-muted-foreground">vs. mês anterior</span>
        </TooltipTrigger>
        <TooltipContent>
          Diferença: <MoneyValue amount={value.changeAmount} showPositiveSign />
        </TooltipContent>
      </Tooltip>
    </DashboardWidgetRow>
  );
}

function CategoryTrendsLoading() {
  return (
    <div aria-label="Carregando tendências de categorias" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <div className="flex h-16 items-center gap-3" key={key}>
          <Skeleton className="size-8" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
