import { type AiDiagnosisChartKind, aiDiagnosisChartKinds } from "@openmonetis/domain/ai-diagnoses";
import type { FinancialHealthOutput } from "@openmonetis/validators/ai-diagnoses";
import { ChartNoAxesCombined } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  aiDiagnosisChartDescriptions,
  aiDiagnosisChartTitles,
  formatPercentIndicator,
} from "../ai-diagnoses.presentation";

const historyConfig = {
  income: { label: "Receita", color: "var(--chart-income)" },
  expenses: { label: "Despesa", color: "var(--chart-expense)" },
} satisfies ChartConfig;
const savingsConfig = {
  savingsRate: { label: "Taxa de poupança", color: "var(--brand)" },
} satisfies ChartConfig;
const balanceConfig = {
  balance: { label: "Saldo", color: "var(--chart-balance)" },
} satisfies ChartConfig;
const categoriesConfig = {
  amount: { label: "Mês atual", color: "var(--chart-1)" },
  previousAmount: { label: "Mês anterior", color: "var(--chart-3)" },
} satisfies ChartConfig;

type AiDiagnosisChartsProps = {
  charts: FinancialHealthOutput["charts"];
  kinds: AiDiagnosisChartKind[];
};

/**
 * Every chart in a fixed 2×2 grid, so the report keeps its shape; the ones the AI picked to
 * support its text are marked.
 */
export function AiDiagnosisCharts({ charts, kinds }: AiDiagnosisChartsProps) {
  const highlighted = new Set(kinds);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {aiDiagnosisChartKinds.map((kind) => (
        <Card key={kind}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChartNoAxesCombined aria-hidden="true" className="size-4 shrink-0" />
              {aiDiagnosisChartTitles[kind]}
            </CardTitle>
            <CardDescription className="eyebrow">
              {aiDiagnosisChartDescriptions[kind]}
            </CardDescription>
            {highlighted.has(kind) ? (
              <CardAction>
                <Badge className="font-mono" variant="secondary">
                  Citado na análise
                </Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {kind === "incomeExpenseHistory" ? (
              <IncomeExpenseChart data={charts.incomeExpenseHistory} />
            ) : kind === "savingsRateHistory" ? (
              <SavingsRateChart data={charts.savingsRateHistory} />
            ) : kind === "topExpenseCategories" ? (
              <TopCategoriesChart data={charts.topExpenseCategories} />
            ) : (
              <MonthlyBalanceChart data={charts.monthlyBalanceHistory} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Axis labels use the mono face, like other figures in the AI report. */
const chartClassName = "h-56 w-full [&_.recharts-cartesian-axis-tick_text]:font-mono";

function usePrivateChartClassName() {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  return cn(
    chartClassName,
    "transition-[filter]",
    isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
  );
}

function MoneyTooltip({ config }: { config: ChartConfig }) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={(value, name) => (
            <div className="flex min-w-40 items-center justify-between gap-5">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ChartLegendMarker color={config[String(name)]?.color} />
                {config[String(name)]?.label}
              </span>
              <MoneyValue amount={Number(value)} className="font-medium" />
            </div>
          )}
          labelFormatter={(value) => formatPeriod(String(value))}
        />
      }
      cursor={{ fill: "var(--muted)", opacity: 0.35 }}
    />
  );
}

function IncomeExpenseChart({
  data,
}: {
  data: FinancialHealthOutput["charts"]["incomeExpenseHistory"];
}) {
  return (
    <ChartContainer
      aria-label="Receitas e despesas dos últimos meses"
      className={usePrivateChartClassName()}
      config={historyConfig}
    >
      <BarChart accessibilityLayer data={data} margin={{ left: 2, right: 2, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="period"
          tickFormatter={(value) => formatPeriod(String(value), true)}
          tickLine={false}
          tickMargin={8}
        />
        <MoneyTooltip config={historyConfig} />
        <Bar dataKey="income" fill="var(--color-income)" maxBarSize={28} radius={[4, 4, 0, 0]} />
        <Bar
          dataKey="expenses"
          fill="var(--color-expenses)"
          maxBarSize={28}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

function SavingsRateChart({
  data,
}: {
  data: FinancialHealthOutput["charts"]["savingsRateHistory"];
}) {
  return (
    <ChartContainer
      aria-label="Taxa de poupança mensal"
      className={chartClassName}
      config={savingsConfig}
    >
      <LineChart accessibilityLayer data={data} margin={{ left: 2, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <ReferenceLine stroke="var(--border)" y={0} />
        <XAxis
          axisLine={false}
          dataKey="period"
          tickFormatter={(value) => formatPeriod(String(value), true)}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          tickLine={false}
          width={44}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatPercentIndicator(Number(value))}
              labelFormatter={(value) => formatPeriod(String(value))}
            />
          }
        />
        <Line
          activeDot={{ r: 4 }}
          connectNulls
          dataKey="savingsRate"
          dot={{ r: 3 }}
          stroke="var(--color-savingsRate)"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}

function TopCategoriesChart({
  data,
}: {
  data: FinancialHealthOutput["charts"]["topExpenseCategories"];
}) {
  const className = usePrivateChartClassName();
  if (!data.length) {
    return <p className="text-muted-foreground text-sm">Sem despesas categorizadas no mês.</p>;
  }

  return (
    <ChartContainer
      aria-label="Maiores categorias de despesa do mês"
      className={className}
      config={categoriesConfig}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 12, top: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis hide type="number" />
        <YAxis
          axisLine={false}
          dataKey="categoryName"
          tickLine={false}
          type="category"
          width={110}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-40 items-center justify-between gap-5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ChartLegendMarker
                      color={categoriesConfig[name as keyof typeof categoriesConfig]?.color}
                    />
                    {categoriesConfig[name as keyof typeof categoriesConfig]?.label}
                  </span>
                  <MoneyValue amount={Number(value)} className="font-medium" />
                </div>
              )}
            />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.35 }}
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="previousAmount" fill="var(--color-previousAmount)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function MonthlyBalanceChart({
  data,
}: {
  data: FinancialHealthOutput["charts"]["monthlyBalanceHistory"];
}) {
  return (
    <ChartContainer
      aria-label="Saldo de cada mês: receitas menos despesas"
      className={usePrivateChartClassName()}
      config={balanceConfig}
    >
      <BarChart accessibilityLayer data={data} margin={{ left: 2, right: 2, top: 12 }}>
        <CartesianGrid vertical={false} />
        <ReferenceLine stroke="var(--border)" y={0} />
        <XAxis
          axisLine={false}
          dataKey="period"
          tickFormatter={(value) => formatPeriod(String(value), true)}
          tickLine={false}
          tickMargin={8}
        />
        <MoneyTooltip config={balanceConfig} />
        <Bar dataKey="balance" maxBarSize={28} radius={4}>
          {data.map((entry) => (
            <Cell
              fill={entry.balance < 0 ? "var(--destructive)" : "var(--success)"}
              key={entry.period}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
