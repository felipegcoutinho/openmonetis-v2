import type { AccountCashFlowOutput } from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesCombined } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatAccountChartDate, formatAccountHistoryPeriod } from "../accounts.presentation";
import { accountCashFlowQueryOptions } from "../accounts.queries";

const chartConfig = {
  income: { label: "Entradas", color: "var(--chart-3)" },
  expenses: { label: "Saídas", color: "var(--chart-1)" },
  balance: { label: "Saldo", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function AccountCashFlow({
  accountId,
  period,
  onPeriodChange,
}: {
  accountId: string;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const query = useQuery(accountCashFlowQueryOptions(accountId, period));

  return (
    <Card className="gap-0 border py-0 shadow-none">
      <Tabs className="gap-0" defaultValue="daily">
        <CardHeader className="gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartNoAxesCombined aria-hidden="true" className="size-4 text-muted-foreground" />
            Movimentação da conta
          </CardTitle>
          <TabsList aria-label="Visualização da movimentação da conta">
            <TabsTrigger value="daily">No mês</TabsTrigger>
            <TabsTrigger value="history">Histórico de 12 meses</TabsTrigger>
          </TabsList>
        </CardHeader>
        {query.isPending ? (
          <CardContent className="py-5">
            <Skeleton className="h-60 w-full" />
          </CardContent>
        ) : null}
        {query.isError && !query.data ? (
          <CardContent className="grid min-h-40 place-items-center gap-3 py-5 text-center">
            <p className="text-muted-foreground text-sm">
              Não foi possível carregar a movimentação.
            </p>
            <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
              Tentar novamente
            </Button>
          </CardContent>
        ) : null}
        {query.data ? (
          <>
            <TabsContent value="daily">
              <CardContent className="py-5">
                <p className="mb-4 text-muted-foreground text-sm">
                  Entradas, saídas e saldo de {formatAccountChartDate(query.data.startDate)} a{" "}
                  {formatAccountChartDate(query.data.endDate)}.
                </p>
                {query.data.outsideMonthAmount !== 0 ? (
                  <p className="mb-4 text-muted-foreground text-sm">
                    Valores deste mês com data fora dele:{" "}
                    <MoneyValue
                      amount={query.data.outsideMonthAmount}
                      className="font-medium text-foreground"
                    />
                    . Esse valor compõe o saldo inicial do gráfico.
                  </p>
                ) : null}
                <FlowChart data={query.data} view="daily" />
              </CardContent>
            </TabsContent>
            <TabsContent value="history">
              <CardContent className="py-5">
                <p className="mb-4 text-muted-foreground text-sm">
                  Últimos 12 meses até {formatAccountHistoryPeriod(query.data.history.endPeriod)}.
                  Selecione um mês para abrir o extrato.
                </p>
                <FlowChart data={query.data} onPeriodChange={onPeriodChange} view="history" />
              </CardContent>
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </Card>
  );
}

function FlowChart({
  data,
  onPeriodChange,
  view,
}: {
  data: AccountCashFlowOutput;
  onPeriodChange?: (period: string) => void;
  view: "daily" | "history";
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const history = view === "history";
  const items = history
    ? data.history.items.map((item) => ({ ...item, date: item.period }))
    : data.daily.map((item) => ({ ...item, period: item.date }));
  const hasActivity = items.some(
    (item) => item.income !== 0 || item.expenses !== 0 || item.balance !== 0,
  );
  if (!hasActivity && !history) {
    return (
      <div className="grid min-h-40 place-items-center text-center text-muted-foreground text-sm">
        Nenhuma movimentação registrada nesse intervalo.
      </div>
    );
  }

  return (
    <>
      {!hasActivity ? (
        <p className="mb-2 text-center text-muted-foreground text-sm">
          Nenhuma movimentação registrada nesse intervalo.
        </p>
      ) : null}
      <ChartContainer
        aria-label={
          history
            ? "Entradas, saídas e saldo dos últimos 12 meses"
            : "Entradas, saídas e saldo diário da conta"
        }
        className={cn(
          "h-52 w-full transition-[filter] sm:h-60",
          isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
        )}
        config={chartConfig}
      >
        <ComposedChart
          accessibilityLayer
          className={history ? "cursor-pointer" : undefined}
          data={items}
          margin={{ left: 8, right: 8, top: 12 }}
          onClick={
            history
              ? (state) => {
                  if (state.activeLabel) onPeriodChange?.(String(state.activeLabel));
                }
              : undefined
          }
        >
          <CartesianGrid vertical={false} />
          <ReferenceLine stroke="var(--border)" y={0} yAxisId="flow" />
          <XAxis
            axisLine={false}
            dataKey={history ? "period" : "date"}
            interval="preserveStartEnd"
            minTickGap={history ? 14 : 24}
            tick={
              history
                ? (props) => (
                    <HistoryMonthTick
                      {...props}
                      disabled={isPrivacyModeEnabled}
                      onPeriodChange={onPeriodChange}
                      selectedPeriod={data.period}
                    />
                  )
                : undefined
            }
            tickFormatter={
              history ? undefined : (value) => formatAccountChartDate(String(value), true)
            }
            tickLine={false}
            tickMargin={8}
          />
          <YAxis hide yAxisId="flow" />
          <YAxis hide orientation="right" yAxisId="balance" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  history
                    ? formatAccountHistoryPeriod(String(value))
                    : formatAccountChartDate(String(value))
                }
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
            dataKey="income"
            fill="var(--color-income)"
            fillOpacity={0.65}
            maxBarSize={history ? 20 : 12}
            radius={[2, 2, 0, 0]}
            yAxisId="flow"
          />
          <Bar
            dataKey="expenses"
            fill="var(--color-expenses)"
            fillOpacity={0.65}
            maxBarSize={history ? 20 : 12}
            radius={[2, 2, 0, 0]}
            yAxisId="flow"
          />
          <Line
            activeDot={{ r: 5 }}
            dataKey="balance"
            dot={false}
            stroke="var(--color-balance)"
            strokeWidth={2}
            type="linear"
            yAxisId="balance"
          />
        </ComposedChart>
      </ChartContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-muted-foreground text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-sm"
            style={{ backgroundColor: chartConfig.income.color }}
          />
          Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-sm"
            style={{ backgroundColor: chartConfig.expenses.color }}
          />
          Saídas
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-3"
            style={{ backgroundColor: chartConfig.balance.color }}
          />
          Saldo
        </span>
      </div>
      {isPrivacyModeEnabled ? (
        <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
      ) : null}
    </>
  );
}

function HistoryMonthTick({
  x = 0,
  y = 0,
  payload,
  disabled,
  onPeriodChange,
  selectedPeriod,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string | number };
  disabled: boolean;
  onPeriodChange?: (period: string) => void;
  selectedPeriod: string;
}) {
  const period = String(payload?.value ?? "");
  if (!period) return null;

  return (
    <a
      aria-current={period === selectedPeriod ? "date" : undefined}
      aria-label={`Abrir extrato de ${formatAccountHistoryPeriod(period)}`}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={`?period=${encodeURIComponent(period)}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onPeriodChange?.(period);
      }}
      onKeyDown={(event) => {
        if (disabled || event.key !== " ") return;
        event.preventDefault();
        onPeriodChange?.(period);
      }}
      tabIndex={disabled ? -1 : 0}
    >
      <text
        className="cursor-pointer"
        dy={16}
        fill={period === selectedPeriod ? "var(--foreground)" : "var(--muted-foreground)"}
        fontWeight={period === selectedPeriod ? 600 : undefined}
        textAnchor="middle"
        x={x}
        y={y}
      >
        {formatAccountHistoryPeriod(period, true)}
      </text>
    </a>
  );
}
