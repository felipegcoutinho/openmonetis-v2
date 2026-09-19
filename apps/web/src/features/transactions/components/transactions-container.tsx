import type {
  TransactionActionScope,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { accountsQueryOptions } from "../../accounts/accounts.queries";
import { cardsQueryOptions } from "../../cards/cards.queries";
import { categoriesQueryOptions } from "../../categories/categories.queries";
import { InvoicesApiError } from "../../invoices/invoices.api";
import { useDeleteInvoiceAdjustmentMutation } from "../../invoices/invoices.mutations";
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
  const deleteInvoiceAdjustment = useDeleteInvoiceAdjustmentMutation();
  const settleTransactions = useSettleTransactionsMutation();
  const settleRecurringOccurrence = useSettleRecurringOccurrenceMutation();
  const recurringStatus = useRecurringRuleStatusMutation();

  async function handleDeleteTransaction(
    transaction: TransactionOutput,
    scope: TransactionActionScope = "single",
  ) {
    try {
      if (transaction.origin === "invoiceAdjustment" && transaction.cardId) {
        await deleteInvoiceAdjustment.mutateAsync({
          cardId: transaction.cardId,
          period: transaction.period,
          adjustmentId: transaction.recordId as string,
        });
        toast.success("Ajuste de fatura removido");
        return;
      }
      await deleteTransaction.mutateAsync({ id: transaction.recordId as string, scope });
      toast.success("Lançamento removido");
    } catch (error) {
      if (error instanceof InvoicesApiError && error.code === "invoice_requires_reopen") {
        toast.error("Reabra a fatura antes de remover o ajuste", {
          description: "A reabertura desfaz os pagamentos para que a fatura possa ser alterada.",
        });
        return;
      }
      toast.error("Não foi possível remover o lançamento", {
        description: "O lançamento permanece salvo. Tente novamente em instantes.",
      });
    }
  }

  return (
    <TransactionsScreen
      onRetry={() => {
        void transactionsQuery.refetch();
        void accountsQuery.refetch();
        void cardsQuery.refetch();
        void categoriesQuery.refetch();
        void peopleQuery.refetch();
      }}
      isUpdating={transactionsQuery.isFetching && !transactionsQuery.isLoading}
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
      onSettleTransactions={async (ids, isSettled, settledDate) => {
        try {
          await settleTransactions.mutateAsync({ ids, isSettled, settledDate });
          const item = transactionsQuery.data?.items.find((item) =>
            ids.includes(item.recordId ?? item.id),
          );
          toast.success(
            isSettled
              ? item?.type === "income"
                ? "Recebimento registrado"
                : item?.type === "transfer"
                  ? "Transferência confirmada"
                  : "Pagamento registrado"
              : "Lançamento marcado em aberto",
            {
              action:
                isSettled && item && !item.isDivided
                  ? {
                      label: "Desfazer",
                      onClick: () =>
                        settleTransactions.mutate(
                          { ids, isSettled: false },
                          {
                            onError: () =>
                              toast.error(
                                "Não foi possível desfazer. Tente pela lista de lançamentos.",
                              ),
                          },
                        ),
                    }
                  : undefined,
            },
          );
        } catch (error) {
          toast.error("Não foi possível atualizar a situação", {
            description: getTransactionMutationErrorMessage(error),
          });
        }
      }}
      onSettleRecurringOccurrence={async (
        recurringRuleId,
        purchaseDate,
        isSettled,
        settledDate,
      ) => {
        try {
          await settleRecurringOccurrence.mutateAsync({
            recurringRuleId,
            purchaseDate,
            isSettled,
            settledDate,
          });
          const item = transactionsQuery.data?.items.find(
            (item) =>
              item.recurringRuleId === recurringRuleId && item.purchaseDate === purchaseDate,
          );
          toast.success(
            isSettled
              ? item?.type === "income"
                ? "Recebimento registrado"
                : "Pagamento registrado"
              : "Lançamento marcado em aberto",
          );
        } catch {
          toast.error("Não foi possível atualizar a situação");
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
        deleteTransaction.isPending
          ? (deleteTransaction.variables?.id ?? null)
          : deleteInvoiceAdjustment.isPending
            ? (deleteInvoiceAdjustment.variables?.adjustmentId ?? null)
            : null
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
