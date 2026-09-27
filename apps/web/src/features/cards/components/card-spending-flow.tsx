import type { CardOutput } from "@openmonetis/validators/cards";
import { ChartNoAxesCombined } from "lucide-react";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCardCycleDate, formatInvoiceDate } from "../cards.presentation";
import { CardInvoiceHistoryChart } from "./card-invoice-history-chart";

const chartConfig = {
  amount: { label: "No dia", color: "var(--brand)" },
  cumulativeAmount: { label: "Acumulado", color: "var(--brand-strong)" },
} satisfies ChartConfig;

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
  const [activeView, setActiveView] = useState<"cycle" | "history">("cycle");
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const hasSpending = cycle.openingAmount !== 0 || cycle.daily.some((entry) => entry.amount !== 0);

  return (
    <Card className="gap-0 border py-0 shadow-none">
      <Tabs
        className="gap-0"
        onValueChange={(value) => setActiveView(value as "cycle" | "history")}
        value={activeView}
      >
        <CardHeader className="gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartNoAxesCombined aria-hidden="true" className="size-4 text-muted-foreground" />
            Gastos do cartão
          </CardTitle>
          <TabsList aria-label="Visualização dos gastos do cartão">
            <TabsTrigger value="cycle">No ciclo</TabsTrigger>
            <TabsTrigger value="history">Histórico de faturas</TabsTrigger>
          </TabsList>
        </CardHeader>
        <TabsContent value="cycle">
          <CardContent className="py-5">
            <p className="mb-4 text-muted-foreground text-sm">
              Lançamentos por dia de {formatCardCycleDate(cycle.startDate)} a{" "}
              {formatCardCycleDate(cycle.endDate)}.
            </p>
            {cycle.openingAmount !== 0 ? (
              <p className="mb-4 text-muted-foreground text-sm">
                Valores de outras datas nesta fatura:{" "}
                <MoneyValue amount={cycle.openingAmount} className="font-medium text-foreground" />.
                O acumulado começa com esse valor.
              </p>
            ) : null}
            {hasSpending ? (
              <>
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
                    data={cycle.daily}
                    margin={{ left: 8, right: 8, top: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <ReferenceLine stroke="var(--border)" y={0} />
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
                      fillOpacity={0.45}
                      maxBarSize={24}
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      activeDot={{ r: 5 }}
                      dataKey="cumulativeAmount"
                      dot={false}
                      stroke="var(--color-cumulativeAmount)"
                      strokeWidth={2}
                      type="linear"
                    />
                  </ComposedChart>
                </ChartContainer>
                <div className="mt-2 flex items-center justify-center gap-4 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-sm bg-brand/50" />
                    No dia
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-3 bg-brand-strong" />
                    Acumulado
                  </span>
                </div>
                {isPrivacyModeEnabled ? (
                  <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
                ) : null}
              </>
            ) : (
              <div className="grid min-h-40 place-items-center text-center text-muted-foreground text-sm">
                Nenhum lançamento registrado neste ciclo.
              </div>
            )}
          </CardContent>
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
