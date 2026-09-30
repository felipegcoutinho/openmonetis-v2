import type { RecurringExpensesReportOutput } from "@openmonetis/validators/recurring-expenses";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  CalendarDays,
  CalendarX2,
  ChevronRight,
  CreditCard,
  Landmark,
  type LucideIcon,
  Pause,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Repeat2,
  Search,
  SearchX,
  Square,
  Ticket,
} from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatDashboardPeriod } from "@/features/dashboard/dashboard.presentation";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import {
  formatRecurringExpenseCompactDate,
  formatRecurringExpenseDate,
  recurringFrequencyLabels,
} from "../recurring-expenses.presentation";
import { recurringExpensesReportQueryOptions } from "../recurring-expenses.queries";
import { RecurringExpenseActionDialog } from "./recurring-expense-action-dialog";
import { RecurringExpenseEditDialog } from "./recurring-expense-edit-dialog";

type ReportItem = RecurringExpensesReportOutput["items"][number];
type StatusFilter = ReportItem["status"] | "all";
type PaymentFilter = ReportItem["paymentMethod"] | "all";

export function RecurringExpensesReportPage({
  onPeriodChange,
  period,
}: {
  onPeriodChange: (period: string) => void;
  period: string;
}) {
  const [creating, setCreating] = useState(false);
  const accounts = useQuery(accountsQueryOptions());
  const cards = useQuery(cardsQueryOptions());
  const categories = useQuery(categoriesQueryOptions());
  const people = useQuery(peopleQueryOptions());
  const reportQuery = useQuery(recurringExpensesReportQueryOptions(period));
  const [editing, setEditing] = useState<ReportItem | null>(null);
  const [action, setAction] = useState<"pause" | "resume" | "skip" | "stop" | null>(null);
  const [actionExpense, setActionExpense] = useState<ReportItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const report = reportQuery.data;
  const searchTerm = search.trim().toLocaleLowerCase("pt-BR");
  const visibleItems =
    report?.items.filter(
      (item) =>
        (statusFilter === "all" || item.status === statusFilter) &&
        (paymentFilter === "all" || item.paymentMethod === paymentFilter) &&
        (!searchTerm ||
          [item.name, item.accountName, item.cardName, item.categoryName, item.personName].some(
            (value) => value?.toLocaleLowerCase("pt-BR").includes(searchTerm),
          )),
    ) ?? [];

  function chooseAction(expense: ReportItem, nextAction: NonNullable<typeof action>) {
    setActionExpense(expense);
    setAction(nextAction);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button
                onClick={() => setCreating(true)}
                disabled={!accounts.data || !cards.data || !categories.data || !people.data}
              >
                Nova recorrência
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Despesas recorrentes" },
            ]}
            description="Acompanhe seus compromissos recorrentes e gerencie as próximas ocorrências."
            icon={<Repeat2 aria-hidden="true" className="size-5" />}
            title="Despesas recorrentes"
          />

          <MonthNavigation onPeriodChange={onPeriodChange} period={period} />

          {reportQuery.isLoading ? <RecurringExpensesReportSkeleton /> : null}
          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as despesas recorrentes</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void reportQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {report && !reportQuery.isError ? (
            <div aria-busy={reportQuery.isFetching} className="grid gap-6">
              <FinancialSummaryHeader
                eyebrow={`Previsão de ${formatDashboardPeriod(period, true)}`}
                identity={
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
                    <Repeat2 aria-hidden="true" className="size-6" />
                  </span>
                }
                metrics={[
                  {
                    icon: <Play aria-hidden="true" className="size-3.5" />,
                    label: "Recorrências ativas",
                    value: report.summary.activeCount,
                  },
                  {
                    icon: <Pause aria-hidden="true" className="size-3.5" />,
                    label: "Recorrências pausadas",
                    value: report.summary.pausedCount,
                  },
                ]}
                primaryLabel="Sua parte prevista no mês"
                primaryValue={<MoneyValue amount={report.summary.projectedTotal} />}
                subtitle="Valores correspondentes à sua parte nos compromissos"
                title="Despesas recorrentes"
                variant="soft"
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Projeção dos próximos meses</CardTitle>
                  <CardDescription>
                    Previsão baseada nas datas das recorrências ativas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {report.projections.map((projection) => (
                    <div className="rounded-lg border bg-muted/20 p-4" key={projection.period}>
                      <p className="text-muted-foreground text-sm">
                        {formatDashboardPeriod(projection.period)}
                      </p>
                      <MoneyValue amount={projection.total} className="mt-1 text-xl" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card aria-labelledby="recurring-rules-title" className="gap-0 py-0 shadow-none">
                <CardHeader className="flex flex-col items-stretch gap-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h2 className="font-heading font-medium text-lg" id="recurring-rules-title">
                        Regras recorrentes
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {`${visibleItems.length} ${visibleItems.length === 1 ? "regra" : "regras"} na lista`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:ml-auto xl:justify-end">
                      <Tabs
                        onValueChange={(value) => {
                          if (value === "active" || value === "paused" || value === "all") {
                            setStatusFilter(value);
                          }
                        }}
                        value={statusFilter}
                      >
                        <TabsList
                          aria-label="Situação das recorrências"
                          className="xl:border-b-0"
                          variant="line"
                        >
                          <TabsTrigger value="active">Ativas</TabsTrigger>
                          <TabsTrigger value="paused">Pausadas</TabsTrigger>
                          <TabsTrigger value="all">Todas</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Select
                        onValueChange={(value) => {
                          if (value === "all" || (value && value in paymentMethodLabels)) {
                            setPaymentFilter(value as PaymentFilter);
                          }
                        }}
                        value={paymentFilter}
                      >
                        <SelectTrigger
                          aria-label="Filtrar recorrências por meio de pagamento"
                          className="w-full min-w-0 sm:w-45"
                        >
                          <SelectValue>
                            {paymentFilter === "all"
                              ? "Todos os meios"
                              : paymentMethodLabels[paymentFilter]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os meios</SelectItem>
                          {Object.entries(paymentMethodLabels).map(([method, label]) => (
                            <SelectItem key={method} value={method}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative min-w-0 sm:w-60">
                        <Search
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          aria-label="Buscar regras recorrentes"
                          className="w-full pl-9"
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Buscar regra ou conta"
                          value={search}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 px-5 pb-2 sm:px-6">
                  {visibleItems.length ? (
                    <ul aria-busy={reportQuery.isFetching} className="divide-y">
                      {visibleItems.map((item) => (
                        <RecurringExpenseReportRow
                          key={item.id}
                          item={item}
                          onAction={chooseAction}
                          onEdit={setEditing}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className="grid min-h-48 place-items-center p-6 text-center">
                      <div>
                        <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                          <SearchX aria-hidden="true" className="size-5" />
                        </span>
                        <p className="mt-3 font-medium">
                          {report.items.length
                            ? "Nenhuma regra corresponde aos filtros"
                            : "Nenhuma recorrência neste período"}
                        </p>
                        <p className="mt-1 text-muted-foreground text-sm">
                          {report.items.length
                            ? "Ajuste a situação, o meio de pagamento ou a busca."
                            : "Cadastre uma despesa recorrente para acompanhar suas próximas ocorrências."}
                        </p>
                        {report.items.length ? (
                          <Button
                            className="mt-4"
                            onClick={() => {
                              setStatusFilter("all");
                              setPaymentFilter("all");
                              setSearch("");
                            }}
                            type="button"
                            variant="outline"
                          >
                            Limpar filtros
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </main>
      <TransactionDialog
        open={creating}
        onOpenChange={setCreating}
        accounts={accounts.data ?? []}
        cards={cards.data ?? []}
        categories={categories.data ?? []}
        people={people.data ?? []}
        transaction={null}
        defaultPeriod={period}
        createDefaults={{ condition: "recurring" }}
        allowedConditions={["recurring"]}
        createTitle="Nova recorrência"
        createDescription="Informe o valor, a frequência e quando começa este compromisso."
      />
      {editing ? (
        <RecurringExpenseEditDialog
          expense={editing}
          key={`${editing.id}:${editing.purchaseDate}`}
          onOpenChange={(open) => !open && setEditing(null)}
          open
        />
      ) : null}
      <RecurringExpenseActionDialog
        action={action}
        expense={actionExpense}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setActionExpense(null);
          }
        }}
      />
    </ProtectedRoute>
  );
}

function RecurringExpenseReportRow({
  item,
  onAction,
  onEdit,
}: {
  item: ReportItem;
  onAction: (expense: ReportItem, action: "pause" | "resume" | "skip" | "stop") => void;
  onEdit: (expense: ReportItem) => void;
}) {
  const PaymentIcon = recurringPaymentMethodIcons[item.paymentMethod];
  const canManage = Boolean(item.actionDate);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const destinationName = item.cardName ?? item.accountName;
  const destinationLogo = item.cardLogo ?? item.accountLogo;

  function chooseRowAction(nextAction: "pause" | "resume" | "skip" | "stop") {
    setDetailsOpen(false);
    onAction(item, nextAction);
  }

  return (
    <li className="py-4 sm:py-5">
      <div className="grid items-center gap-x-5 gap-y-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <EstablishmentLogo className="shrink-0" name={item.name} size={40} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate font-bold">{item.name}</h3>
              <Badge variant={item.status === "active" ? "outline" : "secondary"}>
                {item.status === "active" ? "Ativa" : "Pausada"}
              </Badge>
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {destinationLogo ? (
                <Avatar className="size-4 shrink-0">
                  <AvatarImage alt="" src={destinationLogo} />
                  <AvatarFallback>
                    <PaymentIcon aria-hidden="true" className="size-3" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <PaymentIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {destinationName ?? paymentMethodLabels[item.paymentMethod]} ·{" "}
                {recurringFrequencyLabels[item.frequency]}
              </span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:gap-5 xl:col-span-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Sua parte</p>
            <MoneyValue amount={item.amount} className="mt-1 font-medium text-base" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Próxima ocorrência</p>
            <p className="mt-1 font-medium text-sm">
              {item.status === "paused"
                ? "Pausada"
                : item.nextOccurrenceDate
                  ? formatRecurringExpenseCompactDate(item.nextOccurrenceDate)
                  : "Sem previsão"}
            </p>
          </div>
        </div>
        <Button
          aria-label={`Ver detalhes de ${item.name}`}
          className="w-full justify-between md:col-span-3 xl:col-span-1 xl:w-auto"
          onClick={() => setDetailsOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          Detalhes
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <Dialog onOpenChange={setDetailsOpen} open={detailsOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <div className="flex min-w-0 items-center gap-3 pr-8">
              <EstablishmentLogo className="shrink-0" name={item.name} size={40} />
              <div className="min-w-0">
                <DialogTitle className="truncate">{item.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {recurringFrequencyLabels[item.frequency]} ·{" "}
                  {item.status === "active" ? "Ativa" : "Pausada"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Sua parte por ocorrência</p>
              <MoneyValue amount={item.amount} className="mt-1 font-semibold" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor total por ocorrência</p>
              <MoneyValue amount={item.totalAmount} className="mt-1 font-semibold" />
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Próxima ocorrência</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {item.status === "paused"
                  ? "Sem lançamentos durante a pausa"
                  : item.nextOccurrenceDate
                    ? formatRecurringExpenseDate(item.nextOccurrenceDate)
                    : "Sem previsão"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Forma de pagamento</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <PaymentIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                {paymentMethodLabels[item.paymentMethod]}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Conta ou cartão</dt>
              <dd className="mt-1 font-medium">
                <RecurringDestination item={item} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Categoria</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <CategoryIcon className="size-4 text-muted-foreground" name={item.categoryIcon} />
                {item.categoryName ?? "Sem categoria"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Pessoas</dt>
              <dd className="mt-1 font-medium">
                <RecurringPeople item={item} />
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {item.status === "active" ? (
              <>
                <Button
                  disabled={!canManage}
                  onClick={() => {
                    setDetailsOpen(false);
                    onEdit(item);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pencil aria-hidden="true" /> Alterar
                </Button>
                <Button
                  disabled={!canManage}
                  onClick={() => chooseRowAction("skip")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <CalendarX2 aria-hidden="true" /> Pular próximo
                </Button>
                <Button
                  disabled={!canManage}
                  onClick={() => chooseRowAction("pause")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pause aria-hidden="true" /> Pausar
                </Button>
              </>
            ) : (
              <Button
                disabled={!canManage}
                onClick={() => chooseRowAction("resume")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Play aria-hidden="true" /> Retomar
              </Button>
            )}
            <Button
              disabled={!canManage}
              onClick={() => chooseRowAction("stop")}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Square aria-hidden="true" /> Parar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}

const recurringPaymentMethodIcons = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Ticket,
  bank_transfer: Landmark,
} satisfies Record<ReportItem["paymentMethod"], LucideIcon>;

function RecurringDestination({ item }: { item: ReportItem }) {
  const isCard = Boolean(item.cardName);
  const name = item.cardName ?? item.accountName;
  const logo = item.cardLogo ?? item.accountLogo;
  if (!name) return "Não informada";

  const DestinationIcon = isCard ? CreditCard : Landmark;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar className="size-5" title={isCard ? `Cartão ${name}` : `Conta ${name}`}>
        <AvatarImage alt="" src={logo ?? undefined} />
        <AvatarFallback>
          <DestinationIcon aria-hidden="true" className="size-3" />
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

function RecurringPeople({ item }: { item: ReportItem }) {
  if (!item.splitPeople.length) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className="size-5">
          <AvatarImage
            alt={`Avatar de ${item.personName}`}
            src={item.personAvatarUrl ?? undefined}
          />
          <AvatarFallback className="text-[9px]">
            {item.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
          </AvatarFallback>
        </Avatar>
        {item.personName}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={item.splitPeople.map((person) => person.name).join(", ")}
    >
      <span className="inline-flex shrink-0 -space-x-2">
        {item.splitPeople.slice(0, 3).map((person) => (
          <Avatar key={person.id} size="sm">
            <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
            <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
          </Avatar>
        ))}
        {item.splitPeople.length > 3 ? (
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
            <span aria-hidden="true">+{item.splitPeople.length - 3}</span>
            <span className="sr-only">Mais {item.splitPeople.length - 3} pessoas</span>
          </span>
        ) : null}
      </span>
      {item.splitPeople.length} pessoas
    </span>
  );
}

function RecurringExpensesReportSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}
