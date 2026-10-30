import { ChartPie } from "lucide-react";
import { Pie, PieChart, Tooltip } from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";

type DistributionChartItem = {
  key: string;
  label: string;
  amount: number;
  percentage: number;
};
const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type ChartEntry = DistributionChartItem & { fill: string };

export function DashboardDistributionChart({
  items,
  percentageDigits = 1,
  label,
}: {
  items: DistributionChartItem[];
  percentageDigits?: number;
  label: string;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const chartData: ChartEntry[] = items.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }));
  const chartConfig = Object.fromEntries(
    chartData.map((entry) => [entry.key, { color: entry.fill, label: entry.label }]),
  ) satisfies ChartConfig;

  if (items.some((item) => item.amount < 0)) {
    return (
      <DashboardWidgetEmptyState
        title="Gráfico indisponível neste período"
        description="Há valores negativos. Use a lista para conferir a distribuição."
        icon={<ChartPie aria-hidden="true" />}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-4 sm:flex-row",
        isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
      )}
    >
      <ChartContainer aria-label={label} className="h-64 min-w-0 flex-1" config={chartConfig}>
        <PieChart accessibilityLayer>
          <Pie
            data={chartData}
            dataKey="amount"
            label={({ payload }) =>
              formatPercentage(Number(payload?.percentage ?? 0), percentageDigits)
            }
            labelLine={false}
            nameKey="key"
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
                    <span className="eyebrow text-muted-foreground">{entry.label}</span>
                    <MoneyValue amount={entry.amount} className="font-medium text-foreground" />
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
          <div className="flex items-center gap-2" key={entry.key}>
            <ChartLegendMarker color={entry.fill} />
            <span className="truncate text-muted-foreground text-xs">{entry.label}</span>
          </div>
        ))}
      </div>
      {isPrivacyModeEnabled ? (
        <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
      ) : null}
    </div>
  );
}

function formatPercentage(value: number, digits: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    style: "percent",
  }).format(value / 100);
}
