import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type {
  TransactionActionScope,
  TransactionInput,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import {
  ArrowLeftRight,
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  CreditCard,
  FileUp,
  Filter,
  Landmark,
  type LucideIcon,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { MonthNavigation } from "@/components/month-navigation";
import { type PageBreadcrumb, PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { InstallmentAnticipationLauncher } from "@/features/installments/components/installment-anticipation-launcher";
import { InstallmentAnticipationUndoDialog } from "@/features/installments/components/installment-anticipation-undo-dialog";
import { cn } from "@/lib/utils";
import {
  buildFilterSlugMap,
  parseFilterSlugs,
  paymentMethodLabels,
  serializeFilterSlugs,
  type TransactionsSearch,
  transactionConditionLabels,
  transactionTypeLabels,
} from "../transactions.presentation";
import { TransactionDetailsSheet } from "./transaction-details-sheet";
import { TransactionDialog } from "./transaction-dialog";
import type { TransactionCreateDefaults } from "./transaction-form.validation";
import { TransactionRefundDialog } from "./transaction-refund-dialog";
import { transactionTypeIcons } from "./transaction-type-badge";
import { TransactionsTable } from "./transactions-table";

type TransactionsScreenProps = {
  transactions: TransactionOutput[];
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  period: string;
  isLoading: boolean;
  hasLoadError: boolean;
  pendingTransactionId: string | null;
  pendingSettlementKey: string | null;
  pageCount: number;
  totalItems: number;
  onPeriodChange?: (period: string) => void;
  periodNavigationPlacement?: "afterPageHeader" | "afterSummary";
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
  onDeleteTransaction: (
    transaction: TransactionOutput,
    scope?: TransactionActionScope,
  ) => Promise<void> | void;
  onSettleTransactions: (ids: string[], isSettled: boolean) => Promise<void> | void;
  onSettleRecurringOccurrence: (
    recurringRuleId: string,
    purchaseDate: string,
    isSettled: boolean,
  ) => Promise<void> | void;
  onRecurringStatus: (
    id: string,
    status: "active" | "paused" | "cancelled",
  ) => Promise<void> | void;
  header?: TransactionsScreenHeader;
  hiddenFilters?: readonly TransactionsFilterKey[];
  allowCreate?: boolean;
  allowImport?: boolean;
  createDefaults?: TransactionCreateDefaults;
  createTypes?: readonly TransactionCreateType[];
  defaultPageSize?: number;
  contentNavigation?: ReactNode;
  contentOverride?: ReactNode;
};

export type TransactionCreateType = TransactionInput["type"];
export type TransactionsFilterKey =
  | "type"
  | "paymentMethod"
  | "accountCard"
  | "category"
  | "person"
  | "settlement";

export type TransactionsScreenHeader = {
  breadcrumbs: PageBreadcrumb[];
  description?: string;
  icon?: ReactNode;
  summary?: ReactNode;
  title?: string;
};

export function TransactionsScreen({
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
  const adminPersonId = people.find((person) => person.role === "admin")?.id ?? null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionOutput | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "copy">("create");
  const [createType, setCreateType] = useState<TransactionInput["type"]>("expense");
  const [anticipatingTransaction, setAnticipatingTransaction] = useState<TransactionOutput | null>(
    null,
  );
  const [undoingAnticipation, setUndoingAnticipation] = useState<TransactionOutput | null>(null);
  const [refundingTransaction, setRefundingTransaction] = useState<TransactionOutput | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<TransactionOutput | null>(null);
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
    <MonthNavigation
      className="sticky top-20 z-20"
      onPeriodChange={(nextPeriod) => {
        onPeriodChange?.(nextPeriod);
      }}
      period={period}
    />
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

  function openCreateDialog(type: TransactionInput["type"]) {
    setCreateType(type);
    setDialogMode("create");
    setEditingTransaction(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(transaction: TransactionOutput) {
    setEditingTransaction(transaction);
    setCreateType(transaction.type);
    setDialogMode("edit");
    setIsDialogOpen(true);
  }

  function openCopyDialog(transaction: TransactionOutput) {
    setEditingTransaction(transaction);
    setCreateType(transaction.type);
    setDialogMode("copy");
    setIsDialogOpen(true);
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
        {pageHeader.summary}
        {periodNavigationPlacement === "afterSummary" ? periodNavigation : null}
        {contentNavigation}
        {contentOverride}
      </section>
    );
  }

  return (
    <section className="app-page project-container">
      <PageHeader
        actions={
          showHeaderCreateMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                closeDelay={150}
                delay={0}
                openOnHover
                render={
                  <Button
                    aria-label="Criar novo lançamento"
                    className="gap-0 overflow-hidden p-0"
                    type="button"
                  />
                }
              >
                <span className="flex h-full items-center gap-1.5 px-3">
                  <Plus aria-hidden="true" />
                  Novo lançamento
                </span>
                <span className="grid h-full w-9 place-items-center border-primary-foreground/25 border-l">
                  <ChevronDown
                    aria-hidden="true"
                    className="transition-transform group-data-popup-open/button:rotate-180"
                  />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {createTypes.map((type) => {
                  const Icon = transactionTypeIcons[type];

                  return (
                    <DropdownMenuItem key={type} onClick={() => openCreateDialog(type)}>
                      <Icon aria-hidden="true" />
                      {createTransactionLabels[type]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        breadcrumbs={pageHeader.breadcrumbs}
        description={pageHeader.description}
        icon={pageHeader.icon}
        title={pageHeader.title}
      />

      {periodNavigationPlacement === "afterPageHeader" ? periodNavigation : null}

      {pageHeader.summary}

      {periodNavigationPlacement === "afterSummary" ? periodNavigation : null}

      {contentNavigation}

      <div className="flex flex-wrap items-center gap-2">
        {showInlineCreateButtons || allowImport ? (
          <div className="order-1 flex flex-wrap items-center gap-2">
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
                      {createTransactionLabels[type]}
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
          <div className="order-3 relative w-full md:ml-auto md:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar lançamentos"
              className="pr-9 pl-9 placeholder:text-muted-foreground"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar"
              value={search}
            />
            {search ? (
              <button
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSearch("")}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="order-2">
            <Sheet>
              <SheetTrigger
                render={<Button className="relative bg-transparent" variant="outline" />}
              >
                <Filter aria-hidden="true" />
                Filtros
                {activeFilterCount ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 size-3 rounded-full bg-brand"
                  />
                ) : null}
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>
                    Refine os lançamentos. Um intervalo de datas substitui o mês selecionado.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4">
                  <div className="grid content-start gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      {!hiddenFilterSet.has("type") ? (
                        <FilterSelect
                          label="Tipo de lançamento"
                          onChange={setTypeFilter}
                          options={[
                            { value: "all", label: "Todos" },
                            { value: "income", label: "Receitas", dotClassName: "bg-success" },
                            { value: "expense", label: "Despesas", dotClassName: "bg-destructive" },
                            {
                              value: "transfer",
                              label: "Transferências",
                              dotClassName: "bg-info",
                            },
                          ]}
                          value={typeFilter ?? "all"}
                        />
                      ) : null}
                      <FilterSelect
                        label="Condição"
                        onChange={setConditionFilter}
                        options={[
                          { value: "all", label: "Todos" },
                          {
                            value: "single",
                            label: transactionConditionLabels.single,
                            icon: Check,
                          },
                          { value: "installment", label: "Parcelada", icon: CalendarClock },
                          { value: "recurring", label: "Recorrente", icon: RefreshCw },
                        ]}
                        value={conditionFilter ?? "all"}
                      />
                      {!hiddenFilterSet.has("paymentMethod") ? (
                        <FilterSelect
                          label="Forma de pagamento"
                          onChange={setPaymentMethodFilter}
                          options={[
                            { value: "all", label: "Todas" },
                            ...Object.entries(paymentMethodLabels).map(([value, label]) => ({
                              value,
                              label,
                              icon: paymentMethodIcons[value as keyof typeof paymentMethodLabels],
                            })),
                          ]}
                          value={paymentMethodFilter ?? "all"}
                        />
                      ) : null}
                      {!hiddenFilterSet.has("settlement") ? (
                        <FilterSelect
                          label="Status de pagamento"
                          onChange={setSettlementFilter}
                          options={[
                            { value: "all", label: "Todos" },
                            { value: "paid", label: "Pagos", icon: CircleCheck },
                            { value: "unpaid", label: "Não pagos", icon: Circle },
                          ]}
                          value={settlementFilter ?? "all"}
                        />
                      ) : null}
                      {!hiddenFilterSet.has("person") ? (
                        <MultiFilterSelect
                          label="Pessoa"
                          onChange={(values) => setMultipleFilter("people", values)}
                          options={people.flatMap((person) => {
                            const value = peopleSlugMap.idToSlug.get(person.id);
                            return value
                              ? [{ value, label: person.name, avatarUrl: person.avatarUrl }]
                              : [];
                          })}
                          selected={personSlugs}
                        />
                      ) : null}
                      {!hiddenFilterSet.has("category") ? (
                        <MultiFilterSelect
                          label="Categoria"
                          onChange={(values) => setMultipleFilter("categories", values)}
                          options={categories.flatMap((category) => {
                            const value = categoriesSlugMap.idToSlug.get(category.id);
                            return value
                              ? [
                                  {
                                    value,
                                    label: category.name,
                                    group: category.type === "income" ? "Receitas" : "Despesas",
                                    categoryIcon: category.icon,
                                  },
                                ]
                              : [];
                          })}
                          selected={categorySlugs}
                        />
                      ) : null}
                      {!hiddenFilterSet.has("accountCard") ? (
                        <MultiFilterSelect
                          className="sm:col-span-2"
                          label="Conta/Cartão"
                          onChange={(values) => {
                            const nextAccountSlugs = values
                              .filter((value) => value.startsWith("account-"))
                              .map((value) => value.slice("account-".length));
                            const nextCardSlugs = values
                              .filter((value) => value.startsWith("card-"))
                              .map((value) => value.slice("card-".length));
                            onSearchChange({
                              accounts: serializeFilterSlugs(nextAccountSlugs),
                              cards: serializeFilterSlugs(nextCardSlugs),
                              page: undefined,
                            });
                          }}
                          options={[
                            ...accounts.flatMap((account) => {
                              const slug = accountsSlugMap.idToSlug.get(account.id);
                              return slug
                                ? [
                                    {
                                      value: `account-${slug}`,
                                      label: account.name,
                                      group: "Contas",
                                      logoUrl: account.logo,
                                    },
                                  ]
                                : [];
                            }),
                            ...cards.flatMap((card) => {
                              const slug = cardsSlugMap.idToSlug.get(card.id);
                              return slug
                                ? [
                                    {
                                      value: `card-${slug}`,
                                      label: card.name,
                                      group: "Cartões",
                                      logoUrl: card.logo,
                                    },
                                  ]
                                : [];
                            }),
                          ]}
                          selected={[
                            ...accountSlugs.map((slug) => `account-${slug}`),
                            ...cardSlugs.map((slug) => `card-${slug}`),
                          ]}
                        />
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <span className="font-medium text-muted-foreground text-xs">
                        Intervalo de datas
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <DatePicker
                          onChange={(value) =>
                            onSearchChange({
                              dateStart: value || undefined,
                              dateEnd: value ? (urlSearch.dateEnd ?? value) : undefined,
                              page: undefined,
                            })
                          }
                          placeholder="Data inicial"
                          value={urlSearch.dateStart ?? ""}
                        />
                        <DatePicker
                          onChange={(value) =>
                            onSearchChange({
                              dateStart: value ? (urlSearch.dateStart ?? value) : undefined,
                              dateEnd: value || undefined,
                              page: undefined,
                            })
                          }
                          placeholder="Data final"
                          value={urlSearch.dateEnd ?? ""}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <span className="font-medium text-muted-foreground text-xs">
                        Faixa de valor
                      </span>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <Input
                          inputMode="decimal"
                          className="placeholder:text-muted-foreground"
                          min="0"
                          onChange={(event) =>
                            onSearchChange({
                              minAmount: numberValue(event.target.value),
                              page: undefined,
                            })
                          }
                          placeholder="Mínimo"
                          type="number"
                          value={urlSearch.minAmount ?? ""}
                        />
                        <span className="text-muted-foreground text-xs">até</span>
                        <Input
                          inputMode="decimal"
                          className="placeholder:text-muted-foreground"
                          min="0"
                          onChange={(event) =>
                            onSearchChange({
                              maxAmount: numberValue(event.target.value),
                              page: undefined,
                            })
                          }
                          placeholder="Máximo"
                          type="number"
                          value={urlSearch.maxAmount ?? ""}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-md border border-dashed p-3">
                      <FilterToggle
                        checked={Boolean(urlSearch.hasAttachments)}
                        label="Com anexo"
                        onChange={(checked) =>
                          onSearchChange({
                            hasAttachments: checked ? true : undefined,
                            page: undefined,
                          })
                        }
                      />
                      <FilterToggle
                        checked={Boolean(urlSearch.isDivided)}
                        label="Somente divididos"
                        onChange={(checked) =>
                          onSearchChange({ isDivided: checked ? true : undefined, page: undefined })
                        }
                      />
                    </div>
                  </div>
                </div>
                <SheetFooter>
                  <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      {activeFilterCount
                        ? `${activeFilterCount} ${activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}`
                        : "Nenhum filtro ativo"}
                    </span>
                    <Button
                      disabled={!activeFilterCount}
                      onClick={clearFilters}
                      size="sm"
                      variant="ghost"
                    >
                      Limpar
                    </Button>
                  </div>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {activeFilterCount ? (
        <fieldset aria-label="Filtros ativos" className="flex flex-wrap gap-2">
          {search ? <FilterChip label={`Busca: ${search}`} onRemove={() => setSearch("")} /> : null}
          {!hiddenFilterSet.has("type") && typeFilter ? (
            <FilterChip
              label={`Tipo: ${transactionTypeLabels[typeFilter]}`}
              onRemove={() => setTypeFilter("all")}
            />
          ) : null}
          {conditionFilter ? (
            <FilterChip
              label={`Condição: ${transactionConditionLabels[conditionFilter]}`}
              onRemove={() => setConditionFilter("all")}
            />
          ) : null}
          {!hiddenFilterSet.has("paymentMethod") && paymentMethodFilter ? (
            <FilterChip
              label={`Pagamento: ${paymentMethodLabels[paymentMethodFilter]}`}
              onRemove={() => setPaymentMethodFilter("all")}
            />
          ) : null}
          {!hiddenFilterSet.has("settlement") && settlementFilter ? (
            <FilterChip
              label={`Status: ${settlementFilter === "paid" ? "Pagos" : "Não pagos"}`}
              onRemove={() => setSettlementFilter("all")}
            />
          ) : null}
          {!hiddenFilterSet.has("person") &&
            personSlugs.map((slug) => (
              <FilterChip
                key={`person-${slug}`}
                label={`Pessoa: ${people.find((person) => peopleSlugMap.idToSlug.get(person.id) === slug)?.name ?? "Pessoa"}`}
                onRemove={() =>
                  setMultipleFilter(
                    "people",
                    personSlugs.filter((value) => value !== slug),
                  )
                }
              />
            ))}
          {!hiddenFilterSet.has("category") &&
            categorySlugs.map((slug) => (
              <FilterChip
                key={`category-${slug}`}
                label={`Categoria: ${categories.find((category) => categoriesSlugMap.idToSlug.get(category.id) === slug)?.name ?? "Categoria"}`}
                onRemove={() =>
                  setMultipleFilter(
                    "categories",
                    categorySlugs.filter((value) => value !== slug),
                  )
                }
              />
            ))}
          {!hiddenFilterSet.has("accountCard") &&
            accountSlugs.map((slug) => (
              <FilterChip
                key={`account-${slug}`}
                label={`Conta: ${accounts.find((account) => accountsSlugMap.idToSlug.get(account.id) === slug)?.name ?? "Conta"}`}
                onRemove={() =>
                  setMultipleFilter(
                    "accounts",
                    accountSlugs.filter((value) => value !== slug),
                  )
                }
              />
            ))}
          {!hiddenFilterSet.has("accountCard") &&
            cardSlugs.map((slug) => (
              <FilterChip
                key={`card-${slug}`}
                label={`Cartão: ${cards.find((card) => cardsSlugMap.idToSlug.get(card.id) === slug)?.name ?? "Cartão"}`}
                onRemove={() =>
                  setMultipleFilter(
                    "cards",
                    cardSlugs.filter((value) => value !== slug),
                  )
                }
              />
            ))}
          {urlSearch.minAmount !== undefined || urlSearch.maxAmount !== undefined ? (
            <FilterChip
              label={`Valor: ${urlSearch.minAmount ?? 0} até ${urlSearch.maxAmount ?? "∞"}`}
              onRemove={() =>
                onSearchChange({ minAmount: undefined, maxAmount: undefined, page: undefined })
              }
            />
          ) : null}
          {urlSearch.dateStart || urlSearch.dateEnd ? (
            <FilterChip
              label={`Datas: ${urlSearch.dateStart ?? "início"} até ${urlSearch.dateEnd ?? "fim"}`}
              onRemove={() =>
                onSearchChange({ dateStart: undefined, dateEnd: undefined, page: undefined })
              }
            />
          ) : null}
          {urlSearch.hasAttachments ? (
            <FilterChip
              label="Com anexo"
              onRemove={() => onSearchChange({ hasAttachments: undefined, page: undefined })}
            />
          ) : null}
          {urlSearch.isDivided ? (
            <FilterChip
              label="Somente divididos"
              onRemove={() => onSearchChange({ isDivided: undefined, page: undefined })}
            />
          ) : null}
          <Button onClick={clearFilters} size="sm" variant="ghost">
            Limpar filtros
          </Button>
        </fieldset>
      ) : null}

      {isLoading ? <TransactionsLoading /> : null}

      {hasLoadError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-10 text-center">
          <p className="font-medium text-destructive">Não foi possível carregar os lançamentos.</p>
          <p className="mt-1 text-muted-foreground text-sm">Tente novamente em instantes.</p>
        </div>
      ) : null}

      {!isLoading && !hasLoadError ? (
        <TransactionsTable
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

      <TransactionDialog
        accounts={accounts}
        cards={cards}
        categories={categories}
        createDefaults={createDefaults}
        defaultType={createType}
        defaultPeriod={period}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTransaction(null);
          if (!open) setDialogMode("create");
        }}
        open={isDialogOpen}
        people={people}
        mode={dialogMode}
        transaction={editingTransaction}
      />
      <TransactionDetailsSheet
        key={`details-${viewingTransaction?.id ?? "closed"}`}
        onEdit={openEditDialog}
        onOpenChange={(open) => {
          if (!open) setViewingTransaction(null);
        }}
        open={Boolean(viewingTransaction)}
        transaction={viewingTransaction}
      />
      <TransactionRefundDialog
        defaultPeriod={period}
        key={`refund-${refundingTransaction?.recordId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setRefundingTransaction(null);
        }}
        open={Boolean(refundingTransaction)}
        transaction={refundingTransaction}
      />
      <InstallmentAnticipationLauncher
        key={`anticipation-${anticipatingTransaction?.seriesId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setAnticipatingTransaction(null);
        }}
        open={Boolean(anticipatingTransaction)}
        targetPeriod={period}
        transaction={anticipatingTransaction}
      />
      <InstallmentAnticipationUndoDialog
        key={`undo-anticipation-${undoingAnticipation?.anticipationId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setUndoingAnticipation(null);
        }}
        open={Boolean(undoingAnticipation)}
        transaction={undoingAnticipation}
      />
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    icon?: LucideIcon;
    dotClassName?: string;
  }>;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="grid gap-2">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <Select onValueChange={(next) => next && onChange(next)} value={value}>
        <SelectTrigger className="w-full">
          <SelectValue className={value === "all" ? "text-muted-foreground" : "text-foreground"}>
            {selectedOption ? <FilterSelectOption option={selectedOption} /> : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <FilterSelectOption option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterSelectOption({
  option,
}: {
  option: { label: string; icon?: LucideIcon; dotClassName?: string };
}) {
  const Icon = option.icon;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.dotClassName ? (
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", option.dotClassName)}
        />
      ) : null}
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge className="h-7 gap-1 border-border bg-secondary/70 pr-1 font-normal" variant="secondary">
      {label}
      <button
        aria-label={`Remover filtro ${label}`}
        className="rounded-full p-0.5 hover:bg-background"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </Badge>
  );
}

function TransactionsLoading() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="grid gap-3">
        {["first", "second", "third", "fourth", "fifth", "sixth"].map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <Skeleton className="size-9 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiFilterSelect({
  className,
  label,
  options,
  selected,
  onChange,
}: {
  className?: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
    group?: string;
    avatarUrl?: string | null;
    logoUrl?: string | null;
    categoryIcon?: string | null;
  }>;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selected);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const groups = [...new Set(visibleOptions.map((option) => option.group ?? ""))];

  return (
    <div className={cn("grid gap-2", className)}>
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              className="w-full justify-between bg-transparent font-normal"
              type="button"
              variant="outline"
            />
          }
        >
          <span className={selected.length ? "text-foreground" : "text-muted-foreground"}>
            {selectedOptions.length === 1 ? (
              <FilterOptionContent option={selectedOptions[0]} />
            ) : selected.length ? (
              `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`
            ) : (
              "Todas"
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-64 gap-2 p-2">
          <Input
            aria-label={`Buscar ${label.toLocaleLowerCase("pt-BR")}`}
            onChange={(event) => setQuery(event.target.value)}
            className="placeholder:text-muted-foreground"
            placeholder={`Buscar ${label.toLocaleLowerCase("pt-BR")}...`}
            value={query}
          />
          <div className="max-h-56 overflow-y-auto">
            {groups.map((group) => (
              <div className="grid gap-1 py-1" key={group || "all"}>
                {group ? (
                  <span className="px-2 pt-1 font-medium text-muted-foreground text-xs">
                    {group}
                  </span>
                ) : null}
                {visibleOptions
                  .filter((option) => (option.group ?? "") === group)
                  .map((option) => {
                    const checked = selectedSet.has(option.value);
                    return (
                      <div
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                        key={option.value}
                      >
                        <Checkbox
                          aria-label={option.label}
                          checked={checked}
                          onCheckedChange={(next) =>
                            onChange(
                              next
                                ? [...selected, option.value]
                                : selected.filter((value) => value !== option.value),
                            )
                          }
                        />
                        <FilterOptionContent option={option} />
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterOptionContent({
  option,
}: {
  option: {
    label: string;
    avatarUrl?: string | null;
    logoUrl?: string | null;
    categoryIcon?: string | null;
  };
}) {
  if (option.avatarUrl !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          <AvatarImage alt="" src={option.avatarUrl ?? undefined} />
          <AvatarFallback>{option.label.slice(0, 2).toLocaleUpperCase("pt-BR")}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  if (option.logoUrl !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        {option.logoUrl ? (
          <Image
            alt=""
            className="size-6 shrink-0 rounded-full object-contain"
            height={24}
            layout="fixed"
            src={option.logoUrl}
            width={24}
          />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground">
            {option.label.slice(0, 2).toLocaleUpperCase("pt-BR")}
          </span>
        )}
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  if (option.categoryIcon !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <CategoryIcon className="size-3.5" name={option.categoryIcon} />
        </span>
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  return <span className="truncate text-sm">{option.label}</span>;
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-medium">
      {label}
      <Checkbox aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function numberValue(value: string) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

const paymentMethodIcons: Record<keyof typeof paymentMethodLabels, LucideIcon> = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Ticket,
  bank_transfer: Landmark,
};

const createTransactionLabels: Record<TransactionCreateType, string> = {
  income: "Nova receita",
  expense: "Nova despesa",
  transfer: "Nova transferência",
};

const defaultCreateTypes: readonly TransactionCreateType[] = ["income", "expense", "transfer"];
