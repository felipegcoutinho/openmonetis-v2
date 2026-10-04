import { useQuery } from "@tanstack/react-query";
import { Pause, Play, RefreshCw, Repeat2, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";

import { formatDashboardPeriod } from "@/features/dashboard/dashboard.presentation";

import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";

import { recurringExpensesReportQueryOptions } from "../recurring-expenses.queries";
import { RecurringExpenseActionDialog } from "./recurring-expense-action-dialog";
import { RecurringExpenseEditDialog } from "./recurring-expense-edit-dialog";
import { RecurringExpenseReportRow } from "./recurring-expense-report-row";
import type {
  PaymentFilter,
  ReportItem,
  StatusFilter,
} from "./recurring-expenses-report-page.types";
import { RecurringExpensesReportSkeleton } from "./recurring-expenses-report-skeleton";

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
