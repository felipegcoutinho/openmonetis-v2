import type { DashboardCategoryBreakdownOutput } from "@openmonetis/validators/dashboard";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ListFilter, RefreshCw, Tags } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { peopleQueryOptions } from "@/features/people/people.queries";
import {
  formatCompactDate,
  transactionConditionLabels,
} from "@/features/transactions/transactions.presentation";
import { transactionsQueryOptions } from "@/features/transactions/transactions.queries";
import { cn } from "@/lib/utils";
import { dashboardCategoryBreakdownQueryOptions } from "../dashboard.queries";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetRow } from "./dashboard-widget-row";

type CategoryOption = DashboardCategoryBreakdownOutput["expenses"][number] & {
  type: "expense" | "income";
};

const transactionSkeletonKeys = ["first", "second", "third", "fourth"] as const;

export function CategoryTransactionsWidget({ period }: { period: string }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const categoriesQuery = useQuery(dashboardCategoryBreakdownQueryOptions(period));
  const peopleQuery = useQuery(peopleQueryOptions());
  const categoryGroups = buildCategoryGroups(categoriesQuery.data);
  const categories = [...categoryGroups.expenses, ...categoryGroups.income].sort(
    (left, right) => right.amount - left.amount,
  );
  const selectedCategory =
    categories.find((category) => category.categoryId === selectedCategoryId) ?? categories[0];
  const adminPerson = peopleQuery.data?.find((person) => person.role === "admin");
  const transactionsQuery = useQuery({
    ...transactionsQueryOptions({
      categoryIds: selectedCategory ? [selectedCategory.categoryId] : [],
      pageSize: 5,
      period,
      personIds: adminPerson ? [adminPerson.id] : [],
    }),
    enabled: Boolean(selectedCategory && adminPerson),
  });
  const initialLoading = categoriesQuery.isLoading || peopleQuery.isLoading;
  const initialError = categoriesQuery.isError || peopleQuery.isError;

  return (
    <DashboardWidget
      description="Últimos lançamentos da categoria escolhida"
      footer={
        selectedCategory && (!transactionsQuery.data || transactionsQuery.data.items.length > 0) ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">
              {transactionsQuery.data
                ? formatTransactionTotal(transactionsQuery.data.total)
                : "Categoria selecionada"}
            </span>
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              params={{ categoryId: selectedCategory.categoryId }}
              search={{ period }}
              to="/categories/$categoryId"
            >
              Ver histórico <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<ListFilter aria-hidden="true" />}
      title="Lançamentos por categoria"
    >
      {initialLoading ? <CategoryTransactionsLoading /> : null}
      {initialError ? (
        <CategoryTransactionsError
          onRetry={() => {
            void categoriesQuery.refetch();
            void peopleQuery.refetch();
          }}
        />
      ) : null}
      {!initialLoading && !initialError && categories.length === 0 ? (
        <CategoryTransactionsEmpty />
      ) : null}
      {!initialLoading && !initialError && selectedCategory ? (
        <div className="flex flex-1 flex-col gap-3">
          <CategorySelect
            groups={categoryGroups}
            onValueChange={setSelectedCategoryId}
            selectedCategory={selectedCategory}
            value={selectedCategory.categoryId}
          />
          {transactionsQuery.isLoading ? <TransactionRowsLoading /> : null}
          {transactionsQuery.isError ? (
            <CategoryTransactionsError onRetry={() => void transactionsQuery.refetch()} />
          ) : null}
          {transactionsQuery.data && !transactionsQuery.isError ? (
            transactionsQuery.data.items.length ? (
              <TransactionRows items={transactionsQuery.data.items.slice(0, 4)} />
            ) : (
              <DashboardWidgetEmptyState
                description="Os lançamentos da categoria aparecerão aqui."
                icon={<ListFilter aria-hidden="true" />}
                title="Nenhum lançamento encontrado"
              />
            )
          ) : null}
        </div>
      ) : null}
    </DashboardWidget>
  );
}

function CategorySelect({
  groups,
  onValueChange,
  selectedCategory,
  value,
}: {
  groups: ReturnType<typeof buildCategoryGroups>;
  onValueChange: (value: string | null) => void;
  selectedCategory: CategoryOption;
  value: string;
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger aria-label="Selecionar categoria" className="w-full">
        <SelectValue>
          <CategoryIcon className="size-4" name={selectedCategory.categoryIcon} />
          {selectedCategory.categoryName}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.expenses.length ? (
          <SelectGroup>
            <SelectLabel>Despesas</SelectLabel>
            {groups.expenses.map((category) => (
              <SelectItem key={category.categoryId} value={category.categoryId}>
                <CategoryIcon className="size-4" name={category.categoryIcon} />
                {category.categoryName}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {groups.income.length ? (
          <SelectGroup>
            <SelectLabel>Receitas</SelectLabel>
            {groups.income.map((category) => (
              <SelectItem key={category.categoryId} value={category.categoryId}>
                <CategoryIcon className="size-4" name={category.categoryIcon} />
                {category.categoryName}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}

function TransactionRows({ items }: { items: TransactionOutput[] }) {
  return (
    <ol className="divide-y">
      {items.map((transaction) => (
        <DashboardWidgetRow key={transaction.id}>
          <EstablishmentLogo editable={false} name={transaction.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{transaction.name}</p>
            <p className="truncate text-muted-foreground text-xs">
              {formatCompactDate(transaction.purchaseDate)} ·{" "}
              {transactionConditionLabels[transaction.condition]}
            </p>
          </div>
          <MoneyValue
            amount={Math.abs(transaction.allocation?.amount ?? transaction.amount)}
            className={cn(
              "shrink-0 font-medium text-sm",
              transaction.type === "income" && "text-success",
            )}
            showPositiveSign={transaction.type === "income"}
          />
        </DashboardWidgetRow>
      ))}
    </ol>
  );
}

function CategoryTransactionsLoading() {
  return (
    <div aria-label="Carregando lançamentos por categoria" className="grid gap-3" role="status">
      <Skeleton className="h-9 w-full" />
      {transactionSkeletonKeys.map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}

function TransactionRowsLoading() {
  return (
    <div aria-label="Carregando lançamentos" className="grid gap-2" role="status">
      {transactionSkeletonKeys.map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}

function CategoryTransactionsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar os lançamentos</p>
        <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function CategoryTransactionsEmpty() {
  return (
    <DashboardWidgetEmptyState
      description="As categorias movimentadas aparecerão aqui."
      icon={<Tags aria-hidden="true" />}
      title="Nenhuma categoria movimentada"
    />
  );
}

function buildCategoryGroups(data?: DashboardCategoryBreakdownOutput) {
  return {
    expenses: (data?.expenses ?? []).map((category) => ({ ...category, type: "expense" as const })),
    income: (data?.income ?? []).map((category) => ({ ...category, type: "income" as const })),
  } satisfies Record<"expenses" | "income", CategoryOption[]>;
}

function formatTransactionTotal(total: number) {
  return `${total} ${total === 1 ? "lançamento" : "lançamentos"}`;
}
