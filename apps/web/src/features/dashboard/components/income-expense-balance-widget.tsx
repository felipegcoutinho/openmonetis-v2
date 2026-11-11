import type { DashboardMetricsOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LineChart, RefreshCw } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis } from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDashboardPeriod } from "../dashboard.presentation";
import { dashboardMetricsQueryOptions } from "../dashboard.queries";
import { useAdminPersonSlug } from "../useAdminPersonSlug";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";

const chartConfig = {
  income: { label: "Receita", color: "var(--chart-income)" },
  expenses: { label: "Despesa", color: "var(--chart-expense)" },
  balance: { label: "Resultado", color: "var(--chart-balance)" },
} satisfies ChartConfig;

type HistoryEntry = DashboardMetricsOutput["history"][number];

export function IncomeExpenseBalanceWidget({ period }: { period: string }) {
  const query = useQuery(dashboardMetricsQueryOptions(period));
  const adminPersonSlug = useAdminPersonSlug();
  const history = query.data?.history ?? [];
  const isEmpty = history.every(
    (entry) => entry.income === 0 && entry.expenses === 0 && entry.balance === 0,
  );

  return (
    <DashboardWidget
      description="Seus valores nos últimos seis meses"
      footer={
        query.data && !isEmpty && adminPersonSlug ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ people: adminPersonSlug, period }}
            to="/transactions"
          >
            Ver lançamentos <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<LineChart aria-hidden="true" />}
      title="Receitas, despesas e resultado"
    >
      {query.isLoading ? <ChartLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar a evolução financeira</p>
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
        isEmpty ? (
          <DashboardWidgetEmptyState
            description="A evolução financeira aparecerá aqui."
            icon={<LineChart aria-hidden="true" />}
            title="Nenhuma movimentação no período"
          />
        ) : (
          <FinancialHistoryChart history={history} isFetching={query.isFetching} />
        )
      ) : null}
    </DashboardWidget>
  );
}

function FinancialHistoryChart({
  history,
  isFetching,
}: {
  history: HistoryEntry[];
  isFetching: boolean;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();

  return (
    <div aria-busy={isFetching} className="flex flex-1 flex-col justify-center">
      <ChartContainer
        aria-label="Receitas, despesas e balanço dos últimos seis meses"
        className={cn(
          "h-64 w-full transition-[filter]",
          isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
        )}
        config={chartConfig}
      >
        <ComposedChart
          accessibilityLayer
          barCategoryGap="28%"
          barGap={3}
          data={history}
          margin={{ left: 2, right: 2, top: 12 }}
        >
          <CartesianGrid strokeOpacity={0.6} vertical={false} />
          <ReferenceLine stroke="var(--border)" y={0} />
          <XAxis
            axisLine={false}
            dataKey="period"
            tickFormatter={(value) => formatDashboardPeriod(String(value), true)}
            tickLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatDashboardPeriod(String(value))}
                formatter={(value, name) => (
                  <div className="flex min-w-44 items-center justify-between gap-5">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ChartLegendMarker
                        color={chartConfig[name as keyof typeof chartConfig]?.color}
                      />
                      {chartConfig[name as keyof typeof chartConfig]?.label}
                    </span>
                    <MoneyValue amount={Number(value)} className="font-medium" />
                  </div>
                )}
              />
            }
            cursor={{ fill: "var(--foreground)", opacity: 0.04 }}
          />
          <Bar dataKey="income" fill="var(--color-income)" maxBarSize={18} radius={[4, 4, 4, 4]} />
          <Bar
            dataKey="expenses"
            fill="var(--color-expenses)"
            maxBarSize={18}
            radius={[4, 4, 4, 4]}
          />
          <Line
            activeDot={{ r: 3.5 }}
            dataKey="balance"
            dot={false}
            stroke="var(--color-balance)"
            strokeWidth={1.5}
            type="monotone"
          />
        </ComposedChart>
      </ChartContainer>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-muted-foreground text-xs">
        {Object.values(chartConfig).map((item) => (
          <ChartLegendItem color={item.color} key={item.label} label={item.label} />
        ))}
      </div>
      {isPrivacyModeEnabled ? (
        <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
      ) : null}
    </div>
  );
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <ChartLegendMarker color={color} />
      {label}
    </span>
  );
}

function ChartLoading() {
  return (
    <div aria-label="Carregando evolução financeira" className="grid flex-1 gap-4" role="status">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="mx-auto h-4 w-48" />
    </div>
  );
}
