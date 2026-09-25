import type { PersonFinancialSummaryOutput } from "@openmonetis/validators/people";
import {
  Banknote,
  Barcode,
  ChartNoAxesCombined,
  CreditCard,
  Landmark,
  QrCode,
  ReceiptText,
  Ticket,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { formatPeriod } from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import { formatPersonHistoryPeriod, personPaymentMethodLabels } from "../people.presentation";

const historyChartConfig = {
  expenses: {
    label: "Despesas",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

type PersonFinancialSummaryProps = {
  data?: PersonFinancialSummaryOutput;
  isError: boolean;
  isLoading: boolean;
};

export function PersonFinancialSummary({ data, isError, isLoading }: PersonFinancialSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-muted-foreground text-sm">
          Carregando resumo financeiro...
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-destructive text-sm" role="alert">
          Não foi possível carregar o resumo financeiro.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <MonthlyTotalsCard data={data} />
      <HistoryCard data={data} />
    </section>
  );
}

function MonthlyTotalsCard({ data }: { data: PersonFinancialSummaryOutput }) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ReceiptText aria-hidden="true" className="size-4 text-brand-strong" />
          Totais do mês
        </CardTitle>
        <p className="text-muted-foreground text-xs">{formatPeriod(data.period)}</p>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5">
        <div>
          <p className="text-muted-foreground text-xs">Total de despesas</p>
          <p className="mt-1 font-medium text-2xl">
            <MoneyValue amount={data.totalExpenses} />
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...data.paymentMethods]
            .sort((first, second) => second.amount - first.amount)
            .map((item) => (
              <div
                className="grid min-w-0 gap-2 overflow-hidden rounded-lg border bg-muted/20 p-3"
                key={item.paymentMethod}
              >
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
                    <PaymentMethodIcon method={item.paymentMethod} />
                    <span className="block truncate">
                      {personPaymentMethodLabels[item.paymentMethod]}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {item.percentage}%
                  </span>
                </div>
                <p className="font-semibold text-sm">
                  <MoneyValue amount={item.amount} />
                </p>
                <Progress
                  aria-label={`${item.percentage}% das despesas`}
                  className="min-w-0 max-w-full"
                  value={item.percentage}
                />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ data }: { data: PersonFinancialSummaryOutput }) {
  const { isPrivacyModeEnabled } = usePrivacyMode();

  return (
    <Card className="h-full">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ChartNoAxesCombined aria-hidden="true" className="size-4 text-brand-strong" />
          Evolução (últimos 6 meses)
        </CardTitle>
        <p className="text-muted-foreground text-xs">Despesas mensais desta pessoa</p>
      </CardHeader>
      <CardContent className="flex flex-1 px-2 sm:px-6">
        <ChartContainer
          aria-label="Evolução das despesas nos últimos seis meses"
          className={cn(
            "h-full min-h-64 w-full aspect-auto transition-[filter]",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={historyChartConfig}
        >
          <BarChart
            accessibilityLayer
            data={data.history}
            margin={{ top: 28, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="period"
              tickFormatter={(value) => formatPersonHistoryPeriod(String(value))}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatPeriod(String(value))}
                  formatter={(value) => (
                    <div className="flex min-w-40 items-center justify-between gap-5">
                      <span className="text-muted-foreground">Despesas</span>
                      <MoneyValue amount={Number(value)} className="font-medium" />
                    </div>
                  )}
                />
              }
              cursor={false}
            />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]}>
              <LabelList
                className="fill-muted-foreground text-[10px]"
                dataKey="expenses"
                formatter={(value: unknown) => compactCurrencyFormatter.format(Number(value))}
                position="top"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        {isPrivacyModeEnabled ? (
          <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PaymentMethodIcon({ method }: { method: string }) {
  const Icon =
    method === "pix"
      ? QrCode
      : method === "boleto"
        ? Barcode
        : method === "cash"
          ? Banknote
          : method === "benefits"
            ? Ticket
            : method === "bank_transfer"
              ? Landmark
              : CreditCard;
  return <Icon aria-hidden="true" className="size-3.5 shrink-0" />;
}
