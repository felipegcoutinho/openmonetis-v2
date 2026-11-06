import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "color-mix(in oklch, var(--chart-1) 60%, var(--foreground))",
  "color-mix(in oklch, var(--chart-2) 60%, var(--foreground))",
  "color-mix(in oklch, var(--chart-3) 60%, var(--foreground))",
  "color-mix(in oklch, var(--chart-4) 60%, var(--foreground))",
  "color-mix(in oklch, var(--chart-5) 60%, var(--foreground))",
] as const;

const limitOptions = [5, 10] as const;

type CategoryTrendsChartProps = {
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
};

export function CategoryTrendsChart({ categories, periods }: CategoryTrendsChartProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const [limit, setLimit] = useState("5");
  const topCategories = useMemo(
    () =>
      [...categories]
        .sort((left, right) => right.totalAmount - left.totalAmount)
        .slice(0, Number(limit)),
    [categories, limit],
  );
  const chartData = periods.map((period) => ({
    period: period.period,
    ...Object.fromEntries(
      topCategories.map((category) => [
        category.categoryId,
        category.values.find((value) => value.period === period.period)?.totalAmount ?? 0,
      ]),
    ),
  }));
  const chartConfig = Object.fromEntries(
    topCategories.map((category, index) => [
      category.categoryId,
      {
        label: getCategoryLabel(category),
        color: chartColors[index],
      },
    ]),
  ) satisfies ChartConfig;
  const firstPeriod = periods[0]?.period;
  const lastPeriod = periods.at(-1)?.period;
  const periodLabel =
    firstPeriod && lastPeriod
      ? firstPeriod === lastPeriod
        ? formatPeriod(firstPeriod)
        : `${formatPeriod(firstPeriod)} – ${formatPeriod(lastPeriod)}`
      : "";

  return (
    <Card className="pt-0">
      <CardHeader className="flex-row flex-wrap items-center gap-3 border-b py-5">
        <div className="min-w-0 flex-1">
          <CardTitle>Evolução por categoria</CardTitle>
          <CardDescription>
            {periodLabel} · Categorias com maior valor acumulado no período
          </CardDescription>
        </div>
        {categories.length > 5 ? (
          <Select onValueChange={(value) => value && setLimit(value)} value={limit}>
            <SelectTrigger aria-label="Número de categorias" className="w-28">
              <SelectValue>Top {limit}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Top {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          aria-label="Evolução mensal por categoria"
          className={cn(
            "w-full transition-[filter]",
            Number(limit) > 5 ? "h-96" : "h-80",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={chartConfig}
        >
          <AreaChart accessibilityLayer data={chartData} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="period"
              minTickGap={32}
              tickFormatter={(value) => formatPeriod(String(value), true)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatPeriod(String(value))}
                  formatter={(value, name) =>
                    Number(value) > 0 ? (
                      <div className="flex min-w-44 items-center justify-between gap-5">
                        <span className="truncate text-muted-foreground">
                          {chartConfig[String(name)]?.label}
                        </span>
                        <MoneyValue amount={Number(value)} className="font-medium" />
                      </div>
                    ) : null
                  }
                />
              }
              cursor={false}
            />
            {topCategories.map((category, index) => (
              <Area
                dataKey={category.categoryId}
                fill={`var(--color-${category.categoryId})`}
                fillOpacity={0.18}
                key={category.categoryId}
                stackId="categories"
                stroke={`var(--color-${category.categoryId})`}
                strokeDasharray={index >= 5 ? "4 2" : undefined}
                strokeWidth={1.5}
                type="linear"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
        {isPrivacyModeEnabled ? (
          <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
