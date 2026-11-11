import type { CardOutput } from "@openmonetis/validators/cards";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, Minus } from "lucide-react";
import { useState } from "react";
import { Bar, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  formatCardCycleClosing,
  formatCardCycleComparison,
  formatCardCycleDate,
  formatCardCycleRange,
  formatInvoiceDate,
  getCardCycleToday,
} from "../cards.presentation";
import { CardInvoiceHistoryChart } from "./card-invoice-history-chart";

const chartConfig = {
  amount: { label: "No dia", color: "var(--brand)" },
  cumulativeAmount: { label: "Acumulado", color: "var(--brand-strong)" },
  previousCumulativeAmount: { label: "Fatura anterior", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const comparisonTrendStyles = {
  above: { icon: ArrowUpRight, className: "text-warning" },
  below: { icon: ArrowDownRight, className: "text-success" },
  equal: { icon: Minus, className: "text-muted-foreground" },
} as const;

type SpendingView = "cycle" | "history";

export function CardSpendingFlow({
  cardId,
  cycle,
  onPeriodChange,
  period,
}: {
  cardId: string;
  cycle: CardOutput["cycleSpending"];
  onPeriodChange: (period: string) => void;
  period: string;
}) {
  const [activeView, setActiveView] = useState<SpendingView>("cycle");

  return (
    <Card className="gap-0 border py-0 shadow-none">
      <Tabs
        className="gap-0"
        onValueChange={(value) => setActiveView(value as SpendingView)}
        value={activeView}
      >
        <CardHeader className="items-center border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartNoAxesCombined aria-hidden="true" className="size-4 text-muted-foreground" />
            Gastos do cartão
          </CardTitle>
          <CardAction className="row-span-1 self-center">
            <TabsList aria-label="Visualização dos gastos do cartão">
              <TabsTrigger value="cycle">Por dia</TabsTrigger>
              <TabsTrigger value="history">Por fatura</TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <TabsContent value="cycle">
          <CardCycleSpending cycle={cycle} />
        </TabsContent>
        <TabsContent value="history">
          {activeView === "history" ? (
            <CardInvoiceHistoryChart
              cardId={cardId}
              onPeriodChange={onPeriodChange}
              period={period}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function CardCycleSpending({ cycle }: { cycle: CardOutput["cycleSpending"] }) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const hasSpending = cycle.openingAmount !== 0 || cycle.daily.some((entry) => entry.amount !== 0);
  const today = getCardCycleToday(cycle.startDate, cycle.endDate);
  // The running total stops at today: future days of an open cycle have no spending yet.
  const chartData = cycle.daily.map((entry) => ({
    ...entry,
    cumulativeAmount: today && entry.date > today ? null : entry.cumulativeAmount,
  }));

  return (
    <CardContent className="grid gap-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs">
            {formatCardCycleRange(cycle.startDate, cycle.endDate)}
            <span aria-hidden="true"> · </span>
            {formatCardCycleClosing(cycle.endDate)}
          </p>
          <MoneyValue amount={cycle.totalAmount} className="kpi-value text-3xl" />
          {cycle.comparison ? <CardCycleComparisonLine comparison={cycle.comparison} /> : null}
        </div>
        {cycle.peakDay ? (
          <p className="text-muted-foreground text-xs">
            Maior gasto: {formatInvoiceDate(cycle.peakDay.date)},{" "}
            <MoneyValue amount={cycle.peakDay.amount} className="font-medium text-foreground" />
          </p>
        ) : null}
      </div>

      {cycle.openingAmount !== 0 ? (
        <p className="-mt-2 text-pretty text-muted-foreground text-xs">
          Inclui <MoneyValue amount={cycle.openingAmount} className="font-medium text-foreground" />{" "}
          de parcelas e lançamentos de outras datas.
        </p>
      ) : null}

      {hasSpending ? (
        <div>
          <ChartContainer
            aria-label={`Gastos diários do ciclo de ${formatCardCycleDate(cycle.startDate)} a ${formatCardCycleDate(cycle.endDate)}`}
            className={cn(
              "h-52 w-full transition-[filter] sm:h-60",
              isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
            )}
            config={chartConfig}
          >
            <ComposedChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 8, right: 8, top: 16 }}
            >
              {/* Each series gets its own scale so small days stay visible under the running total. */}
              <YAxis hide yAxisId="daily" />
              <YAxis hide yAxisId="cumulative" />
              <ReferenceLine stroke="var(--border)" y={0} yAxisId="daily" />
              {today ? (
                <ReferenceLine
                  label={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    position: "insideTopRight",
                    value: "Hoje",
                  }}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  x={today}
                  yAxisId="cumulative"
                />
              ) : null}
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={24}
                tickFormatter={(value) => formatInvoiceDate(String(value))}
                tickLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatCardCycleDate(String(value))}
                    formatter={(value, name) => (
                      <div className="flex min-w-44 items-center justify-between gap-5">
                        <span className="text-muted-foreground">
                          {chartConfig[name as keyof typeof chartConfig]?.label}
                        </span>
                        <MoneyValue amount={Number(value)} className="font-medium" />
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="amount"
                fill="var(--color-amount)"
                fillOpacity={0.7}
                maxBarSize={24}
                radius={[2, 2, 0, 0]}
                yAxisId="daily"
              />
              {cycle.comparison ? (
                <Line
                  activeDot={false}
                  dataKey="previousCumulativeAmount"
                  dot={false}
                  stroke="var(--color-previousCumulativeAmount)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  strokeWidth={1.5}
                  type="stepAfter"
                  yAxisId="cumulative"
                />
              ) : null}
              <Line
                activeDot={{ r: 5 }}
                dataKey="cumulativeAmount"
                dot={false}
                stroke="var(--color-cumulativeAmount)"
                strokeWidth={2}
                type="stepAfter"
                yAxisId="cumulative"
              />
            </ComposedChart>
          </ChartContainer>
          <div className="mt-2 flex items-center justify-center gap-4 font-mono text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5">
              <ChartLegendMarker className="text-brand/70" />
              No dia
            </span>
            <span className="flex items-center gap-1.5">
              <ChartLegendMarker className="text-brand-strong" variant="line" />
              Acumulado
            </span>
            {cycle.comparison ? (
              <span className="flex items-center gap-1.5">
                <ChartLegendMarker className="text-muted-foreground" variant="dashed" />
                Fatura anterior
              </span>
            ) : null}
          </div>
          {isPrivacyModeEnabled ? (
            <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center text-center text-muted-foreground text-sm">
          Nenhum lançamento registrado neste ciclo.
        </div>
      )}
    </CardContent>
  );
}

function CardCycleComparisonLine({
  comparison,
}: {
  comparison: NonNullable<CardOutput["cycleSpending"]["comparison"]>;
}) {
  const { icon: TrendIcon, className } = comparisonTrendStyles[comparison.trend];
  const label = formatCardCycleComparison(comparison);

  return (
    <p className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
      <TrendIcon aria-hidden="true" className={cn("size-3.5 shrink-0", className)} />
      {comparison.trend === "equal" ? (
        <span>{label}</span>
      ) : (
        <span>
          <MoneyValue
            amount={comparison.differenceAmount}
            className={cn("font-medium", className)}
          />{" "}
          {label}
        </span>
      )}
      <span>
        <span aria-hidden="true">· </span>
        na anterior: <MoneyValue amount={comparison.previousAmount} />
      </span>
    </p>
  );
}
