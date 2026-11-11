import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { formatPeriod } from "@/lib/period-presentation";
import { formatTrendPercentage, getCategoryTrendsSummary } from "../category-trends.presentation";

export function CategoryTrendsSummary({ report }: { report: CategoryTrendsOutput }) {
  const summary = getCategoryTrendsSummary(report);
  const increase = summary.biggestIncrease;

  return (
    <section aria-label="Resumo do período" className="grid gap-3 sm:grid-cols-3">
      <StatCard
        icon={<ArrowUpRight />}
        label="Despesas no período"
        value={<MoneyValue amount={summary.expenseAmount} />}
      />
      <StatCard
        icon={<ArrowDownLeft />}
        label="Receitas no período"
        value={<MoneyValue amount={summary.incomeAmount} />}
      />
      <StatCard
        icon={<TrendingUp />}
        label={
          summary.latestPeriod
            ? `Maior alta em ${formatPeriod(summary.latestPeriod, true)}`
            : "Maior alta"
        }
        value={
          increase ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 truncate">{getCategoryLabel(increase.category)}</span>
              <span className="shrink-0 font-normal text-destructive text-xs">
                <MoneyValue amount={increase.value.changeAmount} showPositiveSign /> (
                {formatTrendPercentage(increase.value.changePercentage, increase.value.changeKind)})
              </span>
            </span>
          ) : (
            <span className="font-normal text-muted-foreground text-sm">
              Nenhuma alta em despesas.
            </span>
          )
        }
      />
    </section>
  );
}
