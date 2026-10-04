import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, FileUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import {
  buildFilterSlugMap,
  parseFilterSlugs,
  serializeFilterSlugs,
  type TransactionsSearch,
} from "../transactions.presentation";
import { useTransactionsDialogs } from "../useTransactionsDialogs";
import { transactionTypeIcons } from "./transaction-type-badge";
import { TransactionsActiveFilters } from "./transactions-active-filters";
import { TransactionsCreateActions } from "./transactions-create-actions";
import { TransactionsDialogs } from "./transactions-dialogs";
import { TransactionsFilters } from "./transactions-filters";
import { TransactionsLoading } from "./transactions-loading";
import { TransactionsMobileList } from "./transactions-mobile-list";
import { TransactionsPeriodNavigation } from "./transactions-period-navigation";
import type { TransactionsScreenProps } from "./transactions-screen.types";
import { createTransactionLabels, defaultCreateTypes } from "./transactions-screen-options";
import { TransactionsSearchControls } from "./transactions-search-controls";
import { TransactionsTable } from "./transactions-table";

export type {
  TransactionCreateType,
  TransactionsFilterKey,
  TransactionsScreenHeader,
} from "./transactions-screen.types";

export function TransactionsScreen({
  accountStatement = false,
  transactions,
  accounts,
  cards,
  categories,
  people,
  period,
  isLoading,
  hasLoadError,
  pendingTransactionId,
  pendingSettlementKey,
  pageCount,
  totalItems,
  onRetry,
  isUpdating,
  onPeriodChange,
  periodNavigationPlacement = "afterSummary",
  onDeleteTransaction,
  onSettleTransactions,
  onSettleRecurringOccurrence,
  onRecurringStatus,
  search: urlSearch,
  onSearchChange,
  header,
  hiddenFilters = [],
  allowCreate = true,
  allowImport = false,
  createDefaults,
  createTypes = defaultCreateTypes,
  defaultPageSize = 30,
  contentNavigation,
  contentOverride,
}: TransactionsScreenProps) {
  const isMobile = useIsMobile();
  const adminPersonId = people.find((person) => person.role === "admin")?.id ?? null;
  const {
    isDialogOpen,
    setIsDialogOpen,
    editingTransaction,
    setEditingTransaction,
    dialogMode,
    setDialogMode,
    createType,
    anticipatingTransaction,
    setAnticipatingTransaction,
    undoingAnticipation,
    setUndoingAnticipation,
    refundingTransaction,
    setRefundingTransaction,
    viewingTransaction,
    setViewingTransaction,
    openCreateDialog,
    openEditDialog,
    openCopyDialog,
  } = useTransactionsDialogs();

  const search = urlSearch.q ?? "";
  const typeFilter = urlSearch.type;
  const conditionFilter = urlSearch.condition;
  const paymentMethodFilter = urlSearch.paymentMethod;
  const settlementFilter = urlSearch.settlement;
  const peopleSlugMap = buildFilterSlugMap(people);
  const categoriesSlugMap = buildFilterSlugMap(categories);
  const accountsSlugMap = buildFilterSlugMap(accounts);
  const cardsSlugMap = buildFilterSlugMap(cards);
  const personSlugs = parseFilterSlugs(urlSearch.people);
  const categorySlugs = parseFilterSlugs(urlSearch.categories);
  const accountSlugs = parseFilterSlugs(urlSearch.accounts);
  const cardSlugs = parseFilterSlugs(urlSearch.cards);
  const page = urlSearch.page ?? 1;
  const pageSize = urlSearch.pageSize ?? defaultPageSize;
  const selectionScopeKey = JSON.stringify([period, page, { ...urlSearch, edit: undefined }]);
  const hiddenFilterSet = new Set(hiddenFilters);
  const showHeaderCreateMenu = !header && allowCreate && createTypes.length > 0;
  const showInlineCreateButtons = allowCreate && createTypes.length > 0 && !showHeaderCreateMenu;
  const pageHeader = header ?? {
    breadcrumbs: [{ label: "Visão geral", href: "/dashboard" }, { label: "Finanças" }],
    description: "Acompanhe receitas, despesas e transações previstas no período selecionado.",
    icon: <ArrowLeftRight aria-hidden="true" className="size-5" />,
    summary: undefined,
    title: "Lançamentos",
  };
  const activeFilterCount = [
    Boolean(search),
    !hiddenFilterSet.has("type") && Boolean(typeFilter),
    Boolean(conditionFilter),
    !hiddenFilterSet.has("paymentMethod") && Boolean(paymentMethodFilter),
    !hiddenFilterSet.has("settlement") && Boolean(settlementFilter),
    !hiddenFilterSet.has("person") && personSlugs.length > 0,
    !hiddenFilterSet.has("category") && categorySlugs.length > 0,
    !hiddenFilterSet.has("accountCard") && accountSlugs.length > 0,
    !hiddenFilterSet.has("accountCard") && cardSlugs.length > 0,
    urlSearch.minAmount !== undefined || urlSearch.maxAmount !== undefined,
    Boolean(urlSearch.dateStart || urlSearch.dateEnd),
    Boolean(urlSearch.hasAttachments),
    Boolean(urlSearch.isDivided),
  ].filter(Boolean).length;
  const periodNavigation = (
    <TransactionsPeriodNavigation
      urlSearch={urlSearch}
      onSearchChange={onSearchChange}
      onPeriodChange={onPeriodChange}
      period={period}
    />
  );
  const summarySection =
    periodNavigationPlacement === "afterSummary" ? (
      pageHeader.summary ? (
        <div className="grid gap-3">
          {pageHeader.summary}
          {periodNavigation}
        </div>
      ) : (
        periodNavigation
      )
    ) : (
      pageHeader.summary
    );
  const contextNavigationSection = contentNavigation ? (
    <div className="grid gap-3">
      {summarySection}
      {contentNavigation}
    </div>
  ) : (
    summarySection
  );

  function setSearch(value: string) {
    onSearchChange({ q: value || undefined, page: undefined });
  }

  function setTypeFilter(value: string) {
    onSearchChange({
      type: value === "all" ? undefined : (value as TransactionsSearch["type"]),
      page: undefined,
    });
  }

  function setConditionFilter(value: string) {
    onSearchChange({
      condition: value === "all" ? undefined : (value as TransactionsSearch["condition"]),
      page: undefined,
    });
  }

  function setPaymentMethodFilter(value: string) {
    onSearchChange({
      paymentMethod: value === "all" ? undefined : (value as TransactionsSearch["paymentMethod"]),
      page: undefined,
    });
  }

  function setSettlementFilter(value: string) {
    onSearchChange({
      settlement: value === "all" ? undefined : (value as TransactionsSearch["settlement"]),
      page: undefined,
    });
  }

  function setMultipleFilter(
    key: "people" | "categories" | "accounts" | "cards",
    values: string[],
  ) {
    onSearchChange({ [key]: serializeFilterSlugs(values), page: undefined });
  }

  function setPage(value: number | ((current: number) => number)) {
    const next = typeof value === "function" ? value(page) : value;
    onSearchChange({ page: next > 1 ? next : undefined });
  }

  function clearFilters() {
    onSearchChange({
      q: undefined,
      type: undefined,
      condition: undefined,
      paymentMethod: undefined,
      settlement: undefined,
      people: undefined,
      categories: undefined,
      accounts: undefined,
      cards: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      dateStart: undefined,
      dateEnd: undefined,
      hasAttachments: undefined,
      isDivided: undefined,
      page: undefined,
    });
  }

  if (contentOverride) {
    return (
      <section className="app-page project-container">
        <PageHeader
          breadcrumbs={pageHeader.breadcrumbs}
          description={pageHeader.description}
          icon={pageHeader.icon}
          title={pageHeader.title}
        />
        {periodNavigationPlacement === "afterPageHeader" ? periodNavigation : null}
        {contextNavigationSection}
        {contentOverride}
      </section>
    );
  }

  return (
    <section className="app-page project-container">
      <PageHeader
        actions={
          showHeaderCreateMenu ? (
            <TransactionsCreateActions
              createTypes={createTypes}
              createDefaults={createDefaults}
              openCreateDialog={openCreateDialog}
            />
          ) : null
        }
        breadcrumbs={pageHeader.breadcrumbs}
        description={
          !header && isMobile === true
            ? "Acompanhe seus lançamentos do período."
            : pageHeader.description
        }
        icon={pageHeader.icon}
        title={pageHeader.title}
      />
      {periodNavigationPlacement === "afterPageHeader" ? periodNavigation : null}
      {contextNavigationSection}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 md:flex md:flex-wrap">
        {showInlineCreateButtons || allowImport ? (
          <div
            className={cn(
              "order-4 col-span-3 flex-wrap items-center gap-2 md:order-1 md:col-span-1 md:flex",
              showInlineCreateButtons ? "flex" : "hidden",
            )}
          >
            {showInlineCreateButtons
              ? createTypes.map((type) => {
                  const Icon = transactionTypeIcons[type];

                  return (
                    <Button
                      className="w-full sm:w-auto"
                      key={type}
                      onClick={() => openCreateDialog(type)}
                    >
                      <Icon aria-hidden="true" />
                      {type === "income" && createDefaults?.paymentMethod === "credit_card"
                        ? "Novo crédito na fatura"
                        : createTransactionLabels[type]}
                    </Button>
                  );
                })
              : null}
            {allowImport ? (
              <Button asChild className="!normal-case" variant="outline">
                <Link to="/transactions/import">
                  <FileUp aria-hidden="true" />
                  Importar extrato
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="contents">
          <TransactionsSearchControls
            urlSearch={urlSearch}
            onSearchChange={onSearchChange}
            isMobile={isMobile}
            search={search}
            setSearch={setSearch}
          />{" "}
          <TransactionsFilters
            accounts={accounts}
            cards={cards}
            categories={categories}
            people={people}
            onSearchChange={onSearchChange}
            urlSearch={urlSearch}
            typeFilter={typeFilter}
            conditionFilter={conditionFilter}
            paymentMethodFilter={paymentMethodFilter}
            settlementFilter={settlementFilter}
            peopleSlugMap={peopleSlugMap}
            categoriesSlugMap={categoriesSlugMap}
            accountsSlugMap={accountsSlugMap}
            cardsSlugMap={cardsSlugMap}
            personSlugs={personSlugs}
            categorySlugs={categorySlugs}
            accountSlugs={accountSlugs}
            cardSlugs={cardSlugs}
            activeFilterCount={activeFilterCount}
            hiddenFilterSet={hiddenFilterSet}
            setTypeFilter={setTypeFilter}
            setConditionFilter={setConditionFilter}
            setPaymentMethodFilter={setPaymentMethodFilter}
            setSettlementFilter={setSettlementFilter}
            clearFilters={clearFilters}
            setMultipleFilter={setMultipleFilter}
          />
        </div>
      </div>
      <TransactionsActiveFilters
        accounts={accounts}
        cards={cards}
        categories={categories}
        people={people}
        onSearchChange={onSearchChange}
        urlSearch={urlSearch}
        search={search}
        typeFilter={typeFilter}
        conditionFilter={conditionFilter}
        paymentMethodFilter={paymentMethodFilter}
        settlementFilter={settlementFilter}
        peopleSlugMap={peopleSlugMap}
        categoriesSlugMap={categoriesSlugMap}
        accountsSlugMap={accountsSlugMap}
        cardsSlugMap={cardsSlugMap}
        personSlugs={personSlugs}
        categorySlugs={categorySlugs}
        accountSlugs={accountSlugs}
        cardSlugs={cardSlugs}
        activeFilterCount={activeFilterCount}
        hiddenFilterSet={hiddenFilterSet}
        setSearch={setSearch}
        setTypeFilter={setTypeFilter}
        setConditionFilter={setConditionFilter}
        setPaymentMethodFilter={setPaymentMethodFilter}
        setSettlementFilter={setSettlementFilter}
        clearFilters={clearFilters}
        setMultipleFilter={setMultipleFilter}
      />
      {isUpdating ? (
        <span role="status" className="text-muted-foreground text-xs">
          Atualizando resultados…
        </span>
      ) : null}
      {isLoading ? <TransactionsLoading /> : null}
      {hasLoadError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-10 text-center">
          <p className="font-medium text-destructive">Não foi possível carregar os lançamentos.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Verifique sua conexão e tente novamente.
          </p>
          <Button variant="outline" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {!isLoading && !hasLoadError && isMobile === true ? (
        <TransactionsMobileList
          accountStatement={accountStatement}
          key={`mobile:${selectionScopeKey}`}
          allowImport={allowImport}
          currentPage={Math.min(page, pageCount)}
          onPageChange={setPage}
          onView={setViewingTransaction}
          pageCount={pageCount}
          totalItems={totalItems}
          transactions={transactions}
        />
      ) : null}
      {!isLoading && !hasLoadError && isMobile === false ? (
        <TransactionsTable
          accountStatement={accountStatement}
          key={`desktop:${selectionScopeKey}`}
          adminPersonId={adminPersonId}
          currentPage={Math.min(page, pageCount)}
          onAnticipate={setAnticipatingTransaction}
          onUndoAnticipation={setUndoingAnticipation}
          onCopy={openCopyDialog}
          onDelete={onDeleteTransaction}
          onEdit={openEditDialog}
          onView={setViewingTransaction}
          onPageChange={setPage}
          onRefund={setRefundingTransaction}
          onPageSizeChange={(size) =>
            onSearchChange({
              pageSize:
                size === defaultPageSize ? undefined : (size as TransactionsSearch["pageSize"]),
              page: undefined,
            })
          }
          onRecurringStatus={onRecurringStatus}
          onSettle={onSettleTransactions}
          onSettleRecurringOccurrence={onSettleRecurringOccurrence}
          pendingTransactionId={pendingTransactionId}
          pendingSettlementKey={pendingSettlementKey}
          pageCount={pageCount}
          pageSize={pageSize}
          period={period}
          totalItems={totalItems}
          transactions={transactions}
        />
      ) : null}
      <TransactionsDialogs
        accounts={accounts}
        cards={cards}
        categories={categories}
        people={people}
        period={period}
        pendingTransactionId={pendingTransactionId}
        pendingSettlementKey={pendingSettlementKey}
        onDeleteTransaction={onDeleteTransaction}
        onSettleTransactions={onSettleTransactions}
        onSettleRecurringOccurrence={onSettleRecurringOccurrence}
        onRecurringStatus={onRecurringStatus}
        createDefaults={createDefaults}
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        editingTransaction={editingTransaction}
        setEditingTransaction={setEditingTransaction}
        dialogMode={dialogMode}
        setDialogMode={setDialogMode}
        createType={createType}
        anticipatingTransaction={anticipatingTransaction}
        setAnticipatingTransaction={setAnticipatingTransaction}
        undoingAnticipation={undoingAnticipation}
        setUndoingAnticipation={setUndoingAnticipation}
        refundingTransaction={refundingTransaction}
        setRefundingTransaction={setRefundingTransaction}
        viewingTransaction={viewingTransaction}
        setViewingTransaction={setViewingTransaction}
        openEditDialog={openEditDialog}
        openCopyDialog={openCopyDialog}
        isMobile={isMobile}
      />{" "}
    </section>
  );
}
