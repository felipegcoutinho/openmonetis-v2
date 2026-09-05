import type { DashboardCategoryBreakdownOutput } from "@openmonetis/validators/dashboard";
import { Pie, PieChart, Tooltip } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type CategoryBreakdownItem = DashboardCategoryBreakdownOutput["expenses"][number];

const maximumChartCategories = 7;
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type ChartEntry = {
  category: string;
  fill: string;
  name: string;
  percentage: number;
  value: number;
};

export function CategoryBreakdownChart({
  items,
  percentageDigits,
}: {
  items: CategoryBreakdownItem[];
  percentageDigits: number;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const chartData = createChartData(items);
  const chartConfig = Object.fromEntries(
    chartData.map((entry) => [entry.category, { color: entry.fill, label: entry.name }]),
  ) satisfies ChartConfig;

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-4 sm:flex-row",
        isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
      )}
    >
      <ChartContainer
        aria-label="Distribuição por categoria"
        className="h-64 min-w-0 flex-1"
        config={chartConfig}
      >
        <PieChart accessibilityLayer>
          <Pie
            data={chartData}
            dataKey="value"
            label={({ payload }) =>
              formatPercentage(Number(payload?.percentage ?? 0), percentageDigits)
            }
            labelLine={false}
            nameKey="category"
            outerRadius={75}
          />
          <Tooltip
            content={({ active, payload }) => {
              const entry = payload?.[0]?.payload as ChartEntry | undefined;

              if (!(active && entry)) {
                return null;
              }

              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase">{entry.name}</span>
                    <MoneyValue amount={entry.value} className="font-medium text-foreground" />
                    <span className="text-muted-foreground text-xs">
                      {formatPercentage(entry.percentage, percentageDigits)} do total
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ChartContainer>

      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-35 sm:grid-cols-1">
        {chartData.map((entry) => (
          <div className="flex items-center gap-2" key={entry.category}>
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="truncate text-muted-foreground text-xs">{entry.name}</span>
          </div>
        ))}
      </div>
      {isPrivacyModeEnabled ? (
        <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
      ) : null}
    </div>
  );
}

function createChartData(items: CategoryBreakdownItem[]): ChartEntry[] {
  const visibleItems = items.slice(0, maximumChartCategories);
  const entries = visibleItems.map((item, index) => ({
    category: item.categoryId,
    fill: chartColors[index % chartColors.length],
    name: item.categoryName,
    percentage: item.percentage,
    value: item.amount,
  }));
  const remainingItems = items.slice(maximumChartCategories);

  if (remainingItems.length > 0) {
    entries.push({
      category: "others",
      fill: chartColors[maximumChartCategories % chartColors.length],
      name: "Outros",
      percentage: remainingItems.reduce((total, item) => total + item.percentage, 0),
      value: remainingItems.reduce((total, item) => total + item.amount, 0),
    });
  }

  return entries;
}

function formatPercentage(value: number, digits: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    style: "percent",
  }).format(value / 100);
}
