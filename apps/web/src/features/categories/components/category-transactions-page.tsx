import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChartNoAxesCombined, Tags } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrendPercentage } from "@/features/category-trends/category-trends.presentation";
import { categoryTrendsQueryOptions } from "@/features/category-trends/category-trends.queries";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { categoryTypeLabels } from "../categories.presentation";
import { categoryQueryOptions } from "../categories.queries";
import { CategoryIcon } from "../category-icons";

type CategoryTransactionsPageProps = {
  categoryId: string;
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
};

export function CategoryTransactionsPage({
  categoryId,
  search,
  onSearchChange,
}: CategoryTransactionsPageProps) {
  const categoryQuery = useQuery(categoryQueryOptions(categoryId));

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {categoryQuery.isLoading ? <CategoryTransactionsLoading /> : null}
        {categoryQuery.isError ? <CategoryTransactionsNotFound /> : null}
        {categoryQuery.data ? (
          <TransactionsContainer
            onSearchChange={onSearchChange}
            scope={getCategoryTransactionsScope(
              categoryQuery.data,
              search.period ?? getCurrentPeriod(),
            )}
            search={search}
          />
        ) : null}
      </main>
    </ProtectedRoute>
  );
}

function getCategoryTransactionsScope(category: CategoryOutput, period: string) {
  const periodLabel = formatPeriod(period);

  return {
    adminPersonOnly: true,
    categoryIds: [category.id],
    createDefaults: { categoryId: category.id },
    createTypes: [category.type],
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Organização" },
        { label: "Categorias", href: "/categories" },
        { label: category.name },
        { label: `Histórico de ${periodLabel}` },
      ],
      summary: (
        <CategoryTransactionsSummary
          category={category}
          period={period}
          periodLabel={periodLabel}
        />
      ),
    },
    hiddenFilters: ["type", "category", "person"] as const,
    periodNavigationPlacement: "afterPageHeader" as const,
  };
}

function CategoryTransactionsSummary({
  category,
  period,
  periodLabel,
}: {
  category: CategoryOutput;
  period: string;
  periodLabel: string;
}) {
  const isIncome = category.type === "income";
  const trendsQuery = useQuery(
    categoryTrendsQueryOptions({
      categoryIds: [category.id],
      endPeriod: period,
      startPeriod: period,
    }),
  );
  const categoryTrend = trendsQuery.data?.categories.find(
    (item) => item.categoryId === category.id,
  );
  const periodTrend = categoryTrend?.values.find((value) => value.period === period);
  const categoryAmount = periodTrend?.totalAmount ?? 0;

  return (
    <FinancialSummaryHeader
      eyebrow={`Histórico de ${periodLabel}`}
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <CategoryIcon className="size-6" name={category.icon} />
        </span>
      }
      metrics={[
        {
          icon: <Tags aria-hidden="true" className="size-3.5" />,
          label: "Tipo",
          value: categoryTypeLabels[category.type],
        },
        {
          icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
          label: "Mês",
          value: periodLabel,
        },
        {
          icon: <ChartNoAxesCombined aria-hidden="true" className="size-3.5" />,
          label: "Vs. mês anterior",
          value: trendsQuery.isLoading
            ? "Carregando..."
            : trendsQuery.isError || !periodTrend
              ? "Indisponível"
              : formatTrendPercentage(periodTrend.changePercentage, periodTrend.changeKind),
        },
      ]}
      primaryLabel={isIncome ? "Receitas no período" : "Despesas no período"}
      primaryValue={
        trendsQuery.isLoading ? (
          <Skeleton className="h-10 w-48 bg-current/20 before:via-current/20" />
        ) : trendsQuery.isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={categoryAmount} />
        )
      }
      subtitle={`Categoria de ${categoryTypeLabels[category.type].toLocaleLowerCase("pt-BR")}`}
      title={category.name}
      variant="soft"
    />
  );
}

function CategoryTransactionsLoading() {
  return (
    <section className="app-page project-container">
      <p className="text-muted-foreground text-sm">Carregando histórico da categoria...</p>
    </section>
  );
}

function CategoryTransactionsNotFound() {
  return (
    <section className="app-page project-container">
      <p className="text-destructive text-sm" role="alert">
        Categoria não encontrada.
      </p>
    </section>
  );
}
