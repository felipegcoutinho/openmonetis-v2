import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatCommitmentChartPeriod, formatCommitmentPeriod } from "../commitments.presentation";

const chartConfig = {
  installmentsAmount: { label: "Parcelas", color: "var(--chart-1)" },
  recurringAmount: { label: "Recorrentes", color: "var(--chart-2)" },
  billsAmount: { label: "Contas avulsas", color: "var(--chart-4)" },
  incomeAmount: { label: "Receita prevista", color: "var(--success)" },
} satisfies ChartConfig;
const axisNumberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatAxisAmount(value: number) {
  return value >= 1000
    ? `R$ ${axisNumberFormatter.format(value / 1000)} mil`
    : `R$ ${axisNumberFormatter.format(value)}`;
}

export function CommitmentsChart({
  report,
  isFetching,
}: {
  report: CommitmentsOutput;
  isFetching: boolean;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="p-5 pb-2 sm:p-6 sm:pb-2">
        <h2 className="section-title">Comprometimento mês a mês</h2>
        <p className="mt-0.5 text-muted-foreground text-xs sm:text-sm">
          Barras: o que já está contratado. Linha: receita prevista no mês.
        </p>
      </CardHeader>
      <CardContent aria-busy={isFetching} className="px-3 pb-5 sm:px-6 sm:pb-6">
        <ChartContainer
          aria-hidden="true"
          className={cn(
            "h-60 w-full transition-[filter] sm:h-72",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={chartConfig}
        >
          <ComposedChart
            accessibilityLayer
            data={report.months}
            margin={{ left: 0, right: 0, top: 14 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="period"
              minTickGap={18}
              tickFormatter={(value) => formatCommitmentChartPeriod(String(value))}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickFormatter={(value) => formatAxisAmount(Number(value))}
              tickLine={false}
              width={68}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatCommitmentPeriod(String(value))}
                  formatter={(value, name) => (
                    <div className="flex min-w-40 items-center justify-between gap-4">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <ChartLegendMarker
                          color={chartConfig[String(name) as keyof typeof chartConfig]?.color}
                        />
                        {chartConfig[String(name) as keyof typeof chartConfig]?.label}
                      </span>
                      <MoneyValue amount={Number(value)} className="font-medium" />
                    </div>
                  )}
                />
              }
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            />
            <Bar
              dataKey="installmentsAmount"
              fill="var(--color-installmentsAmount)"
              maxBarSize={46}
              stackId="committed"
            />
            <Bar
              dataKey="recurringAmount"
              fill="var(--color-recurringAmount)"
              maxBarSize={46}
              stackId="committed"
            />
            <Bar
              dataKey="billsAmount"
              fill="var(--color-billsAmount)"
              maxBarSize={46}
              radius={[4, 4, 0, 0]}
              stackId="committed"
            />
            <Line
              activeDot={{ r: 4 }}
              dataKey="incomeAmount"
              dot={{ r: 2.5 }}
              stroke="var(--color-incomeAmount)"
              strokeWidth={2}
              type="linear"
            />
          </ComposedChart>
        </ChartContainer>
        <div
          aria-hidden="true"
          className={cn(
            "mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-muted-foreground text-xs",
            isPrivacyModeEnabled && "blur-sm select-none",
          )}
        >
          {Object.values(chartConfig).map((item) => (
            <span className="flex items-center gap-1.5" key={item.label}>
              <ChartLegendMarker color={item.color} />
              {item.label}
            </span>
          ))}
        </div>
        {isPrivacyModeEnabled ? (
          <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
