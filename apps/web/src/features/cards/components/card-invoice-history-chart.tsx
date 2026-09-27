import type { CardInvoiceHistoryOutput } from "@openmonetis/validators/cards";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCardHistoryPeriod, getCardHistoryWindowEnd } from "../cards.presentation";
import { cardInvoiceHistoryQueryOptions } from "../cards.queries";

const chartConfig = {
  amount: { label: "Valor da fatura", color: "var(--brand)" },
} satisfies ChartConfig;

type HistoryItem = CardInvoiceHistoryOutput["items"][number];

export function CardInvoiceHistoryChart({
  cardId,
  period,
  onPeriodChange,
}: {
  cardId: string;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const historyEndPeriod = getCardHistoryWindowEnd(period);
  const query = useQuery(cardInvoiceHistoryQueryOptions(cardId, historyEndPeriod));
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const items = query.data?.items ?? [];
  const hasHistory = items.some((item) => item.amount > 0);

  return (
    <CardContent className="py-5">
      <p className="mb-4 text-muted-foreground text-sm">
        Últimas 12 faturas até {formatCardHistoryPeriod(historyEndPeriod)}. Selecione um mês para
        abrir a fatura.
      </p>
      {query.isPending ? <Skeleton className="h-60 w-full" /> : null}
      {query.isError ? (
        <div className="grid min-h-40 place-items-center gap-3 text-center">
          <p className="text-muted-foreground text-sm">Não foi possível carregar o histórico.</p>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {query.data && !query.isError ? (
        hasHistory ? (
          <>
            <ChartContainer
              aria-label="Valor das últimas doze faturas do cartão"
              className={cn(
                "h-52 w-full transition-[filter] sm:h-60",
                isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
              )}
              config={chartConfig}
            >
              <BarChart accessibilityLayer data={items} margin={{ left: 8, right: 8, top: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="period"
                  interval="preserveStartEnd"
                  minTickGap={14}
                  tickFormatter={(value) => formatCardHistoryPeriod(String(value), true)}
                  tickLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatCardHistoryPeriod(String(value))}
                      formatter={(value) => (
                        <div className="flex min-w-44 items-center justify-between gap-5">
                          <span className="text-muted-foreground">Fatura</span>
                          <MoneyValue amount={Number(value)} className="font-medium" />
                        </div>
                      )}
                    />
                  }
                  cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                />
                <Bar
                  className="cursor-pointer"
                  dataKey="amount"
                  maxBarSize={38}
                  minPointSize={2}
                  onClick={(entry) => {
                    const selected = (entry as { payload?: HistoryItem }).payload;
                    if (selected) onPeriodChange(selected.period);
                  }}
                  radius={[3, 3, 0, 0]}
                >
                  {items.map((item) => (
                    <Cell
                      aria-label={`Abrir fatura de ${formatCardHistoryPeriod(item.period)}`}
                      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      fill={item.period === period ? "var(--brand-strong)" : "var(--color-amount)"}
                      fillOpacity={item.period === period ? 1 : 0.5}
                      key={item.period}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onPeriodChange(item.period);
                        }
                      }}
                      role="link"
                      tabIndex={isPrivacyModeEnabled ? -1 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            {isPrivacyModeEnabled ? (
              <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
            ) : null}
          </>
        ) : (
          <div className="grid min-h-40 place-items-center text-center text-muted-foreground text-sm">
            Nenhuma fatura com lançamentos nesse intervalo.
          </div>
        )
      ) : null}
    </CardContent>
  );
}
