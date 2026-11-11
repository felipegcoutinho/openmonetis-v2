import type { FinancialDistributionOutput } from "@openmonetis/validators/financial-distribution";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { CategoryIcon } from "@/features/categories/category-icons";
import { distributionCategoryLabel } from "../financial-distribution.presentation";
import { FinancialDistributionPercentage } from "./financial-distribution-percentage";

type Props = { report: FinancialDistributionOutput; personScope: string };
type Category = FinancialDistributionOutput["categories"][number];

type TileProps = {
  label: string;
  icon: ReactNode;
  title: ReactNode;
  amount: number;
  percentage: number | null;
  percentageLabel: string;
};

function HighlightTile({ label, icon, title, amount, percentage, percentageLabel }: TileProps) {
  return (
    <StatCard
      description={
        <>
          <FinancialDistributionPercentage value={percentage} /> {percentageLabel}
        </>
      }
      icon={icon}
      label={label}
      subject={title}
      value={<MoneyValue amount={amount} />}
    />
  );
}

function CategoryTitle({
  category,
  period,
  personScope,
}: {
  category: Category;
  period: string;
  personScope: string;
}) {
  const label = distributionCategoryLabel(category);
  const content = (
    <>
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <CategoryIcon name={category.icon} className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </>
  );
  return category.categoryId ? (
    <Link
      className="group flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to="/categories/$categoryId"
      params={{ categoryId: category.categoryId }}
      search={{ period, personScope }}
      title={label}
    >
      {content}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  ) : (
    <span className="flex min-w-0 items-center gap-2" title={label}>
      {content}
    </span>
  );
}

export function FinancialDistributionHighlights({ report, personScope }: Props) {
  const leadingExpenses = report.categories
    .filter((category) => category.type === "expense" && category.amount > 0)
    .slice(0, 2);
  const largestExpense = leadingExpenses[0];
  const largestIncome = report.categories
    .filter((category) => category.type === "income" && category.amount > 0)
    .reduce<Category | undefined>(
      (largest, category) => (!largest || category.amount > largest.amount ? category : largest),
      undefined,
    );

  return (
    <section aria-label="Destaques do mês" className="min-w-0">
      {largestExpense || largestIncome ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {largestExpense ? (
            <HighlightTile
              label="Maior categoria de despesa"
              icon={<TrendingDown />}
              title={
                <CategoryTitle
                  category={largestExpense}
                  period={report.period}
                  personScope={personScope}
                />
              }
              amount={largestExpense.amount}
              percentage={largestExpense.percentage}
              percentageLabel="das despesas"
            />
          ) : null}
          {leadingExpenses.length > 1 ? (
            <HighlightTile
              label="Duas maiores despesas juntas"
              icon={<Layers />}
              title={
                <p className="line-clamp-2">
                  {leadingExpenses.map(distributionCategoryLabel).join(" e ")}
                </p>
              }
              amount={report.leadingExpensesAmount}
              percentage={report.leadingExpensesPercentage}
              percentageLabel="das despesas"
            />
          ) : null}
          {largestIncome ? (
            <HighlightTile
              label="Maior fonte de receita"
              icon={<TrendingUp />}
              title={
                <CategoryTitle
                  category={largestIncome}
                  period={report.period}
                  personScope={personScope}
                />
              }
              amount={largestIncome.amount}
              percentage={largestIncome.percentage}
              percentageLabel="das receitas"
            />
          ) : null}
        </div>
      ) : (
        <Card className="px-5 py-4">
          <p className="text-muted-foreground text-sm">Nenhuma movimentação neste período.</p>
        </Card>
      )}
    </section>
  );
}
