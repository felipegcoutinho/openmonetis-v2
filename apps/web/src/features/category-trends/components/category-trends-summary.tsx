import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { MoneyValue } from "@/components/money-value";
import { Card } from "@/components/ui/card";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { formatPeriod } from "@/lib/period-presentation";
import { formatTrendPercentage, getCategoryTrendsSummary } from "../category-trends.presentation";

export function CategoryTrendsSummary({ report }: { report: CategoryTrendsOutput }) {
  const summary = getCategoryTrendsSummary(report);

  return (
    <section aria-label="Resumo do período" className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Despesas no período">
        <MoneyValue amount={summary.expenseAmount} className="font-medium text-xl leading-tight" />
      </SummaryCard>
      <SummaryCard label="Receitas no período">
        <MoneyValue amount={summary.incomeAmount} className="font-medium text-xl leading-tight" />
      </SummaryCard>
      <SummaryCard
        label={
          summary.latestPeriod
            ? `Maior alta em ${formatPeriod(summary.latestPeriod, true)}`
            : "Maior alta"
        }
      >
        {summary.biggestIncrease ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="min-w-0 truncate font-medium text-xl leading-tight">
              {getCategoryLabel(summary.biggestIncrease.category)}
            </p>
            <p className="shrink-0 text-destructive text-xs tabular-nums">
              <MoneyValue
                amount={summary.biggestIncrease.value.changeAmount}
                className="font-normal"
                showPositiveSign
              />{" "}
              (
              {formatTrendPercentage(
                summary.biggestIncrease.value.changePercentage,
                summary.biggestIncrease.value.changeKind,
              )}
              )
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma alta em despesas.</p>
        )}
      </SummaryCard>
    </section>
  );
}

function SummaryCard({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Card className="min-w-0 gap-1 px-5 py-4">
      <p className="font-mono text-muted-foreground text-xs">{label}</p>
      {children}
    </Card>
  );
}
