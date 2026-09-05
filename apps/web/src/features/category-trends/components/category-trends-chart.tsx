import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatTrendPeriod } from "../category-trends.presentation";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const limitOptions = [5, 10, 15] as const;

type CategoryTrendsChartProps = {
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
};

export function CategoryTrendsChart({ categories, periods }: CategoryTrendsChartProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const [limit, setLimit] = useState("10");
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
        label: category.name,
        color: chartColors[index % chartColors.length],
      },
    ]),
  ) satisfies ChartConfig;
  const firstPeriod = periods[0]?.period;
  const lastPeriod = periods.at(-1)?.period;
  const periodLabel =
    firstPeriod && lastPeriod
      ? firstPeriod === lastPeriod
        ? formatTrendPeriod(firstPeriod)
        : `${formatTrendPeriod(firstPeriod)} – ${formatTrendPeriod(lastPeriod)}`
      : "";

  return (
    <Card className="pt-0">
      <CardHeader className="flex-row items-center gap-3 border-b py-5">
        <div className="min-w-0 flex-1">
          <CardTitle>Evolução por categoria</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </div>
        <Select onValueChange={(value) => value && setLimit(value)} value={limit}>
          <SelectTrigger aria-label="Número de categorias" className="hidden w-28 sm:flex">
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
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          aria-label="Evolução mensal por categoria"
          className={cn(
            "h-80 w-full transition-[filter]",
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
              tickFormatter={(value) => formatTrendPeriod(String(value), true)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatTrendPeriod(String(value))}
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
            {topCategories.map((category) => (
              <Area
                dataKey={category.categoryId}
                fill={`var(--color-${category.categoryId})`}
                fillOpacity={0.18}
                key={category.categoryId}
                stackId="categories"
                stroke={`var(--color-${category.categoryId})`}
                strokeWidth={1.5}
                type="natural"
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
