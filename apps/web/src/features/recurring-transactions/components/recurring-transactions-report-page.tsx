import type { RecurringTransactionsSearch } from "@openmonetis/validators/recurring-transactions";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Repeat2, SearchX } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { SummaryStrip } from "@/components/summary-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { formatDashboardPeriod } from "@/features/dashboard/dashboard.presentation";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { resolveRecurringTransactionsPeriod } from "../recurring-transactions.presentation";
import { recurringTransactionsReportQueryOptions } from "../recurring-transactions.queries";
import { RecurringTransactionActionDialog } from "./recurring-transaction-action-dialog";
import { RecurringTransactionEditDialog } from "./recurring-transaction-edit-dialog";
import { RecurringTransactionReportRow } from "./recurring-transaction-report-row";
import { RecurringTransactionsFilters } from "./recurring-transactions-filters";
import type { ReportItem } from "./recurring-transactions-report-page.types";
import { RecurringTransactionsReportSkeleton } from "./recurring-transactions-report-skeleton";

export function RecurringTransactionsReportPage({
  search,
  onSearchChange,
}: {
  search: RecurringTransactionsSearch;
  onSearchChange: (patch: Partial<RecurringTransactionsSearch>) => void;
}) {
  const period = resolveRecurringTransactionsPeriod(search);
  const income = search.type === "income";
  const creationTitle = income ? "Nova receita recorrente" : "Nova despesa recorrente";
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReportItem | null>(null);
  const [action, setAction] = useState<{
    item: ReportItem;
    action: "pause" | "resume" | "skip" | "stop";
  } | null>(null);
  const accounts = useQuery(accountsQueryOptions());
  const cards = useQuery(cardsQueryOptions());
  const categories = useQuery(categoriesQueryOptions());
  const people = useQuery(peopleQueryOptions());
  const ready = Boolean(accounts.data && cards.data && categories.data && people.data);
  const reportQuery = useQuery(recurringTransactionsReportQueryOptions(period, search.type));
  const report = reportQuery.data;
  const term = search.q.trim().toLocaleLowerCase("pt-BR");
  const visibleItems =
    report?.items.filter(
      (item) =>
        (search.status === "all" || item.status === search.status) &&
        (search.paymentMethod === "all" || item.paymentMethod === search.paymentMethod) &&
        (!term ||
          [item.name, item.accountName, item.cardName, item.categoryName, item.personName].some(
            (value) => value?.toLocaleLowerCase("pt-BR").includes(term),
          )),
    ) ?? [];

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            title="Lançamentos recorrentes"
            description="Acompanhe receitas e despesas recorrentes e gerencie as próximas ocorrências."
            icon={<Repeat2 aria-hidden="true" className="size-5" />}
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Lançamentos recorrentes" },
            ]}
            actions={
              <Button disabled={!ready} onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" />
                {creationTitle}
              </Button>
            }
          />
          <Tabs
            value={search.type}
            onValueChange={(type) => {
              if (type === "income" || type === "expense") {
                setCreating(false);
                setEditing(null);
                setAction(null);
                onSearchChange({ type });
              }
            }}
          >
            <TabsList
              aria-label="Tipo de lançamento recorrente"
              variant="line"
              className="w-full justify-start"
            >
              <TabsTrigger value="expense">Despesas</TabsTrigger>
              <TabsTrigger value="income">Receitas</TabsTrigger>
            </TabsList>
          </Tabs>
          <MonthNavigation
            period={period}
            onPeriodChange={(period) => onSearchChange({ period })}
          />
          {reportQuery.isLoading ? <RecurringTransactionsReportSkeleton /> : null}
          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar os lançamentos recorrentes</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => void reportQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {report && !reportQuery.isError ? (
            <div className="grid gap-6" aria-busy={reportQuery.isFetching}>
              <SummaryStrip
                items={[
                  {
                    label: income
                      ? `Recebimentos previstos em ${formatDashboardPeriod(period, true)}`
                      : `Despesas previstas em ${formatDashboardPeriod(period, true)}`,
                    value: <MoneyValue amount={report.summary.projectedTotal} />,
                    emphasized: true,
                  },
                  { label: "Ativas", value: report.summary.activeCount },
                  { label: "Pausadas", value: report.summary.pausedCount },
                  { label: "Encerradas", value: report.summary.endedCount },
                ]}
                label={
                  income ? "Resumo das receitas recorrentes" : "Resumo das despesas recorrentes"
                }
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Projeção dos próximos meses</CardTitle>
                  <CardDescription>
                    Pela data da ocorrência, incluindo as já pagas ou recebidas. O mês altera os
                    totais; a lista mostra a situação atual de cada série.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {report.projections.map((projection) => (
                    <div key={projection.period} className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-muted-foreground text-sm">
                        {formatDashboardPeriod(projection.period)}
                      </p>
                      <MoneyValue amount={projection.total} className="mt-1 text-xl" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="gap-0 py-0 shadow-none" aria-labelledby="recurring-rules-title">
                <CardHeader className="gap-4 p-5 sm:p-6">
                  <div>
                    <h2 id="recurring-rules-title" className="section-title">
                      {income ? "Receitas cadastradas" : "Despesas cadastradas"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {visibleItems.length}{" "}
                      {visibleItems.length === 1 ? "recorrência" : "recorrências"} · Os filtros
                      abaixo afetam somente a lista.
                    </p>
                  </div>
                  <RecurringTransactionsFilters search={search} onChange={onSearchChange} />
                </CardHeader>
                <CardContent className="grid gap-2 px-5 pb-2 sm:px-6">
                  {visibleItems.length ? (
                    <ul className="divide-y">
                      {visibleItems.map((item) => (
                        <RecurringTransactionReportRow
                          key={item.seriesId}
                          item={item}
                          canEdit={ready && item.canEdit}
                          onAction={(item, action) => setAction({ item, action })}
                          onEdit={(item) => {
                            if (ready) setEditing(item);
                          }}
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
                            ? "Nenhuma recorrência corresponde aos filtros"
                            : income
                              ? "Nenhuma receita recorrente cadastrada"
                              : "Nenhuma despesa recorrente cadastrada"}
                        </p>
                        <p className="mt-1 text-muted-foreground text-sm">
                          {report.items.length
                            ? "Ajuste a situação, o meio ou a busca."
                            : "Cadastre uma recorrência para acompanhar as próximas ocorrências."}
                        </p>
                        <Button
                          className="mt-4"
                          type="button"
                          variant="outline"
                          disabled={!report.items.length && !ready}
                          onClick={() =>
                            report.items.length
                              ? onSearchChange({ status: "all", paymentMethod: "all", q: "" })
                              : setCreating(true)
                          }
                        >
                          {report.items.length ? "Limpar filtros" : creationTitle}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </main>
      {creating ? (
        <TransactionDialog
          key={search.type}
          open
          onOpenChange={setCreating}
          accounts={accounts.data ?? []}
          cards={cards.data ?? []}
          categories={categories.data ?? []}
          people={people.data ?? []}
          transaction={null}
          defaultType={search.type}
          defaultPeriod={period}
          createDefaults={{ condition: "recurring" }}
          allowedConditions={["recurring"]}
          lockType
          createTitle={creationTitle}
          createDescription="Informe o valor, a frequência e quando começa a recorrência."
        />
      ) : null}
      {editing ? (
        <RecurringTransactionEditDialog
          key={`${editing.id}:${editing.actionDate}`}
          item={editing}
          accounts={accounts.data ?? []}
          cards={cards.data ?? []}
          categories={categories.data ?? []}
          people={people.data ?? []}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <RecurringTransactionActionDialog
        action={action?.action ?? null}
        recurrence={action?.item ?? null}
        onOpenChange={(open) => !open && setAction(null)}
      />
    </ProtectedRoute>
  );
}
