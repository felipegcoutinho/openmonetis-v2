import type { InstallmentsReportOutput } from "@openmonetis/validators/installments";
import { ChartColumn, Info } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatInstallmentChartPeriod,
  formatInstallmentPeriod,
} from "../installments.presentation";

const chartConfig = {
  totalAmount: { label: "Parcelas", color: "var(--brand)" },
  activePurchaseCount: { label: "Compras em andamento", color: "var(--foreground)" },
} satisfies ChartConfig;
const axisNumberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatAxisAmount(value: number) {
  return value >= 1000
    ? `R$ ${axisNumberFormatter.format(value / 1000)} mil`
    : `R$ ${axisNumberFormatter.format(value)}`;
}

type InstallmentsMonthlyChartProps = {
  report: InstallmentsReportOutput;
  isFetching: boolean;
};

export function InstallmentsMonthlyChart({ report, isFetching }: InstallmentsMonthlyChartProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const firstPeriod = report.monthlyHistory[0]?.period;
  const lastPeriod = report.monthlyHistory.at(-1)?.period;
  const hasData = report.monthlyHistory.some(
    (item) => item.totalAmount > 0 || item.activePurchaseCount > 0,
  );

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 p-5 pb-2 sm:p-6 sm:pb-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
          <ChartColumn aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-medium text-lg">Parcelas e compras em andamento</h2>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-label="Como ler o gráfico"
                    className="shrink-0 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                  />
                }
              >
                <Info aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Barras: soma das parcelas pagas e pendentes. Linha: compras com parcela registrada
                no mês.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-muted-foreground text-xs sm:text-sm">
            {firstPeriod ? `${formatInstallmentChartPeriod(firstPeriod)} – ` : ""}
            {lastPeriod ? formatInstallmentChartPeriod(lastPeriod) : ""} · Parcelas registradas
          </p>
        </div>
      </CardHeader>
      <CardContent aria-busy={isFetching} className="px-3 pb-5 sm:px-6 sm:pb-6">
        {hasData ? (
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
              data={report.monthlyHistory}
              margin={{ left: 0, right: 0, top: 14 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="period"
                minTickGap={18}
                tickFormatter={(value) => formatInstallmentChartPeriod(String(value))}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                yAxisId="amount"
                axisLine={false}
                tickFormatter={(value) => formatAxisAmount(Number(value))}
                tickLine={false}
                width={68}
              />
              <YAxis
                yAxisId="count"
                allowDecimals={false}
                axisLine={false}
                domain={[0, "dataMax + 1"]}
                orientation="right"
                tickLine={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatInstallmentPeriod(String(value))}
                    formatter={(value, name) => (
                      <div className="flex min-w-36 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {chartConfig[String(name) as keyof typeof chartConfig]?.label}
                        </span>
                        {name === "activePurchaseCount" ? (
                          <span className="font-medium tabular-nums">{Number(value)}</span>
                        ) : (
                          <MoneyValue amount={Number(value)} className="font-medium" />
                        )}
                      </div>
                    )}
                  />
                }
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <Bar dataKey="totalAmount" maxBarSize={46} radius={[4, 4, 0, 0]} yAxisId="amount">
                {report.monthlyHistory.map((item) => (
                  <Cell
                    fill="var(--brand)"
                    fillOpacity={item.period === lastPeriod ? 1 : 0.55}
                    key={item.period}
                  />
                ))}
              </Bar>
              <Line
                activeDot={{ r: 4 }}
                dataKey="activePurchaseCount"
                dot={{ r: 2.5 }}
                stroke="var(--color-activePurchaseCount)"
                strokeWidth={2}
                type="linear"
                yAxisId="count"
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="grid h-48 place-items-center text-center text-muted-foreground text-sm">
            Nenhuma parcela registrada nesse intervalo.
          </div>
        )}
        {hasData ? (
          <div
            aria-hidden="true"
            className={cn(
              "mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-muted-foreground text-xs",
              isPrivacyModeEnabled && "blur-sm select-none",
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-brand" />
              Valor das parcelas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-foreground" />
              Compras em andamento
            </span>
          </div>
        ) : null}
        {hasData ? (
          !isPrivacyModeEnabled ? (
            <table aria-label="Dados mensais das despesas parceladas" className="sr-only">
              <thead>
                <tr>
                  <th scope="col">Mês</th>
                  <th scope="col">Valor das parcelas</th>
                  <th scope="col">Compras em andamento</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlyHistory.map((item) => (
                  <tr key={item.period}>
                    <th scope="row">{formatInstallmentPeriod(item.period)}</th>
                    <td>
                      <MoneyValue amount={item.totalAmount} />
                    </td>
                    <td>{item.activePurchaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null
        ) : null}
        {isPrivacyModeEnabled ? (
          <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
