import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChartNoAxesCombined, Tags, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EntityLoadError } from "@/components/entity-load-error";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrendPercentage } from "@/features/category-trends/category-trends.presentation";
import { categoryTrendsQueryOptions } from "@/features/category-trends/category-trends.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { categoryTypeLabels } from "../categories.presentation";
import { categoryQueryOptions } from "../categories.queries";
import { CategoryIcon } from "../category-icons";

export type CategoryTransactionsSearch = TransactionsSearch & {
  personScope?: string;
};

type CategoryTransactionsPageProps = {
  categoryId: string;
  search: CategoryTransactionsSearch;
  onSearchChange: (search: Partial<CategoryTransactionsSearch>) => void;
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
        {categoryQuery.isError ? (
          <EntityLoadError
            error={categoryQuery.error}
            entity="a categoria"
            onRetry={() => void categoryQuery.refetch()}
          >
            <CategoryTransactionsNotFound />
          </EntityLoadError>
        ) : null}
        {categoryQuery.data ? (
          <TransactionsContainer
            onSearchChange={onSearchChange}
            scope={getCategoryTransactionsScope(
              categoryQuery.data,
              search.period ?? getCurrentPeriod(),
              search.personScope ?? "admin",
              (personScope) =>
                onSearchChange({
                  personScope: personScope === "admin" ? undefined : personScope,
                  people: undefined,
                  page: undefined,
                }),
            )}
            search={search}
          />
        ) : null}
      </main>
    </ProtectedRoute>
  );
}

function getCategoryTransactionsScope(
  category: CategoryOutput,
  period: string,
  personScope: string,
  onPersonScopeChange: (value: string) => void,
) {
  const periodLabel = formatPeriod(period);

  return {
    adminPersonOnly: personScope === "admin",
    personIds: personScope === "all" ? [] : personScope === "admin" ? undefined : [personScope],
    categoryIds: [category.id],
    createDefaults: { categoryId: category.id },
    createTypes: [category.type],
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Organização" },
        { label: "Categorias", href: "/categories" },
        { label: category.name },
      ],
      summary: (
        <CategoryTransactionsSummary
          category={category}
          period={period}
          periodLabel={periodLabel}
          personScope={personScope}
          onPersonScopeChange={onPersonScopeChange}
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
  personScope,
  onPersonScopeChange,
}: {
  category: CategoryOutput;
  period: string;
  periodLabel: string;
  personScope: string;
  onPersonScopeChange: (value: string) => void;
}) {
  const peopleQuery = useQuery(peopleQueryOptions());
  const people = peopleQuery.data ?? [];
  const options = [
    { value: "admin", label: "Você", person: people.find((person) => person.role === "admin") },
    ...people
      .filter((person) => person.role !== "admin")
      .map((person) => ({
        value: person.id,
        label: person.name,
        person,
      })),
    { value: "all", label: "Todas as pessoas", person: undefined },
  ];
  const selected = options.find((option) => option.value === personScope);
  const renderOption = (option: (typeof options)[number]) => (
    <span className="flex min-w-0 items-center gap-2">
      {option.value === "all" ? (
        <Users aria-hidden="true" className="size-5 shrink-0" />
      ) : (
        <Avatar size="sm">
          <AvatarImage src={option.person?.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{(option.person?.name ?? option.label).slice(0, 1)}</AvatarFallback>
        </Avatar>
      )}
      <span className="truncate">{option.label}</span>
    </span>
  );
  const isIncome = category.type === "income";
  const trendsQuery = useQuery({
    ...categoryTrendsQueryOptions({
      categoryIds: [category.id],
      endPeriod: period,
      startPeriod: period,
      personScope,
    }),
    placeholderData: undefined,
  });
  const categoryTrend = trendsQuery.data?.categories.find(
    (item) => item.categoryId === category.id,
  );
  const periodTrend = categoryTrend?.values.find((value) => value.period === period);
  const categoryAmount = periodTrend?.totalAmount ?? 0;

  return (
    <FinancialSummaryHeader
      actions={
        <Select
          value={personScope}
          onValueChange={(value) => {
            if (value && options.some((option) => option.value === value))
              onPersonScopeChange(value);
          }}
        >
          <SelectTrigger aria-label="Considerar lançamentos de" className="w-full sm:w-48">
            <SelectValue>{selected ? renderOption(selected) : "Pessoa indisponível"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {renderOption(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
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
          label: "Comparado ao mês anterior",
          value: trendsQuery.isLoading
            ? "Carregando..."
            : trendsQuery.isError || !periodTrend
              ? "Indisponível"
              : formatTrendPercentage(periodTrend.changePercentage, periodTrend.changeKind),
        },
      ]}
      primaryLabel={
        personScope === "admin"
          ? isIncome
            ? "Suas receitas no período"
            : "Suas despesas no período"
          : `${isIncome ? "Receitas" : "Despesas"} de ${selected?.label ?? "pessoa indisponível"}`
      }
      primaryValue={
        trendsQuery.isLoading ? (
          <Skeleton className="h-10 w-48 bg-current/20 before:via-current/20" />
        ) : trendsQuery.isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={categoryAmount} />
        )
      }
      subtitle={`Categoria de ${categoryTypeLabels[category.type].toLocaleLowerCase("pt-BR")} · ${selected?.label ?? "Pessoa indisponível"}`}
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
