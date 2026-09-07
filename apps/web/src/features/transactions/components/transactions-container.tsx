import type { TransactionActionScope } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { accountsQueryOptions } from "../../accounts/accounts.queries";
import { cardsQueryOptions } from "../../cards/cards.queries";
import { categoriesQueryOptions } from "../../categories/categories.queries";
import { peopleQueryOptions } from "../../people/people.queries";
import { userPreferencesQueryOptions } from "../../preferences/preferences.queries";
import {
  useDeleteTransactionMutation,
  useRecurringRuleStatusMutation,
  useSettleRecurringOccurrenceMutation,
  useSettleTransactionsMutation,
} from "../transactions.mutations";
import {
  buildFilterSlugMap,
  getCurrentPeriod,
  getTransactionMutationErrorMessage,
  parseFilterSlugs,
  type TransactionsSearch,
} from "../transactions.presentation";
import { transactionsQueryOptions } from "../transactions.queries";
import type { TransactionCreateDefaults } from "./transaction-form.validation";
import {
  type TransactionCreateType,
  type TransactionsFilterKey,
  TransactionsScreen,
  type TransactionsScreenHeader,
} from "./transactions-screen";

type TransactionsContainerProps = {
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
  scope?: TransactionsScope;
};

type TransactionsScope = {
  personIds?: string[];
  accountIds?: string[];
  cardIds?: string[];
  categoryIds?: string[];
  header?: TransactionsScreenHeader;
  hiddenFilters?: readonly TransactionsFilterKey[];
  allowCreate?: boolean;
  createDefaults?: TransactionCreateDefaults;
  createTypes?: readonly TransactionCreateType[];
  adminPersonOnly?: boolean;
  adminSettledOnly?: boolean;
  periodNavigationPlacement?: "afterPageHeader" | "afterSummary";
  contentNavigation?: ReactNode;
  contentOverride?: ReactNode;
};

export function TransactionsContainer({
  search,
  onSearchChange,
  scope,
}: TransactionsContainerProps) {
  const accountsQuery = useQuery(accountsQueryOptions());
  const cardsQuery = useQuery(cardsQueryOptions());
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const peopleQuery = useQuery(peopleQueryOptions());
  const preferencesQuery = useQuery(userPreferencesQueryOptions());
  const selectedPeriod = search.period ?? getCurrentPeriod();
  const defaultPageSize = preferencesQuery.data?.transactionsPageSize ?? 30;
  const effectivePageSize = search.pageSize ?? defaultPageSize;
  const peopleSlugMap = buildFilterSlugMap(peopleQuery.data ?? []);
  const categoriesSlugMap = buildFilterSlugMap(categoriesQuery.data ?? []);
  const accountsSlugMap = buildFilterSlugMap(accountsQuery.data ?? []);
  const cardsSlugMap = buildFilterSlugMap(cardsQuery.data ?? []);
  const adminPerson = peopleQuery.data?.find((person) => person.role === "admin");
  const restrictToAdminPerson = scope?.adminPersonOnly || scope?.adminSettledOnly;
  const transactionsSearch = {
    ...search,
    period: selectedPeriod,
    pageSize: effectivePageSize,
    personIds:
      scope?.personIds ??
      (restrictToAdminPerson
        ? adminPerson
          ? [adminPerson.id]
          : []
        : resolveFilterIds(search.people, peopleSlugMap.slugToId)),
    settlement: scope?.adminSettledOnly ? ("paid" as const) : search.settlement,
    categoryIds:
      scope?.categoryIds ?? resolveFilterIds(search.categories, categoriesSlugMap.slugToId),
    accountIds: scope?.accountIds ?? resolveFilterIds(search.accounts, accountsSlugMap.slugToId),
    cardIds: scope?.cardIds ?? resolveFilterIds(search.cards, cardsSlugMap.slugToId),
  };
  const transactionsQuery = useQuery({
    ...transactionsQueryOptions(transactionsSearch),
    enabled: !scope?.contentOverride,
  });
  const deleteTransaction = useDeleteTransactionMutation();
  const settleTransactions = useSettleTransactionsMutation();
  const settleRecurringOccurrence = useSettleRecurringOccurrenceMutation();
  const recurringStatus = useRecurringRuleStatusMutation();

  async function handleDeleteTransaction(id: string, scope: TransactionActionScope = "single") {
    try {
      await deleteTransaction.mutateAsync({ id, scope });
      toast.success("Lançamento removido");
    } catch {
      toast.error("Não foi possível remover o lançamento", {
        description: "O lançamento permanece salvo. Tente novamente em instantes.",
      });
    }
  }

  return (
    <TransactionsScreen
      accounts={accountsQuery.data ?? []}
      cards={cardsQuery.data ?? []}
      categories={categoriesQuery.data ?? []}
      hasLoadError={
        transactionsQuery.isError ||
        accountsQuery.isError ||
        cardsQuery.isError ||
        categoriesQuery.isError ||
        peopleQuery.isError
      }
      isLoading={
        (!scope?.contentOverride && transactionsQuery.isLoading) ||
        accountsQuery.isLoading ||
        cardsQuery.isLoading ||
        categoriesQuery.isLoading ||
        peopleQuery.isLoading
      }
      onDeleteTransaction={handleDeleteTransaction}
      onSettleTransactions={async (ids, isSettled) => {
        try {
          await settleTransactions.mutateAsync({ ids, isSettled });
          toast.success(isSettled ? "Pagamento marcado como pago" : "Pagamento marcado em aberto");
        } catch (error) {
          toast.error("Não foi possível atualizar o pagamento", {
            description: getTransactionMutationErrorMessage(error),
          });
        }
      }}
      onSettleRecurringOccurrence={async (recurringRuleId, purchaseDate, isSettled) => {
        try {
          await settleRecurringOccurrence.mutateAsync({
            recurringRuleId,
            purchaseDate,
            isSettled,
          });
          toast.success(isSettled ? "Pagamento marcado como pago" : "Pagamento marcado em aberto");
        } catch {
          toast.error("Não foi possível atualizar o pagamento");
        }
      }}
      onRecurringStatus={async (id, status) => {
        try {
          await recurringStatus.mutateAsync({ id, status });
          toast.success(
            status === "active"
              ? "Recorrência retomada"
              : status === "paused"
                ? "Recorrência pausada"
                : "Recorrência encerrada",
          );
        } catch (error) {
          toast.error("Não foi possível atualizar a recorrência");
          throw error;
        }
      }}
      onPeriodChange={(nextPeriod) => {
        onSearchChange({
          period: nextPeriod,
          dateStart: undefined,
          dateEnd: undefined,
          page: undefined,
        });
      }}
      onSearchChange={onSearchChange}
      pendingTransactionId={
        deleteTransaction.isPending ? (deleteTransaction.variables?.id ?? null) : null
      }
      pendingSettlementKey={
        settleTransactions.isPending
          ? (settleTransactions.variables?.ids[0] ?? null)
          : settleRecurringOccurrence.isPending
            ? settleRecurringOccurrence.variables
              ? `${settleRecurringOccurrence.variables.recurringRuleId}:${settleRecurringOccurrence.variables.purchaseDate}`
              : null
            : null
      }
      people={peopleQuery.data ?? []}
      periodNavigationPlacement={scope?.periodNavigationPlacement}
      contentNavigation={scope?.contentNavigation}
      contentOverride={scope?.contentOverride}
      pageCount={Math.max(
        1,
        Math.ceil(
          (transactionsQuery.data?.total ?? 0) /
            (transactionsQuery.data?.pageSize ?? effectivePageSize),
        ),
      )}
      defaultPageSize={defaultPageSize}
      totalItems={transactionsQuery.data?.total ?? 0}
      period={selectedPeriod}
      search={search}
      allowCreate={scope?.allowCreate}
      allowImport={!scope}
      createDefaults={scope?.createDefaults}
      createTypes={scope?.createTypes}
      header={scope?.header}
      hiddenFilters={scope?.hiddenFilters}
      transactions={transactionsQuery.data?.items ?? []}
    />
  );
}

function resolveFilterIds(value: string | undefined, slugToId: Map<string, string>) {
  return parseFilterSlugs(value)
    .map((slug) => slugToId.get(slug))
    .filter((id): id is string => Boolean(id));
}
