import type { InstallmentsReportOutput } from "@openmonetis/validators/installments";
import { ChartColumn, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
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
            <h2 className="section-title">Parcelas por mês</h2>
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
                Barras: soma das parcelas pagas e pendentes do mês. Passe o mouse ou toque em uma
                barra para ver quantas compras tinham parcela no mês.
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
            <BarChart
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
                axisLine={false}
                tickFormatter={(value) => formatAxisAmount(Number(value))}
                tickLine={false}
                width={68}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatInstallmentPeriod(String(value))}
                    formatter={(value, name, item) => (
                      <div className="grid min-w-40 gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {chartConfig[String(name) as keyof typeof chartConfig]?.label}
                          </span>
                          <MoneyValue amount={Number(value)} className="font-medium" />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {chartConfig.activePurchaseCount.label}
                          </span>
                          <span className="font-medium tabular-nums">
                            {Number(item.payload?.activePurchaseCount ?? 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  />
                }
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <Bar dataKey="totalAmount" maxBarSize={46} radius={[4, 4, 0, 0]}>
                {report.monthlyHistory.map((item) => (
                  <Cell
                    fill="var(--brand)"
                    fillOpacity={item.period === lastPeriod ? 1 : 0.55}
                    key={item.period}
                  />
                ))}
              </Bar>
            </BarChart>
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
              <ChartLegendMarker className="text-brand" />
              Valor das parcelas
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
