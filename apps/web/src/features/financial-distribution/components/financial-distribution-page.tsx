import type { ListFinancialDistributionQuery } from "@openmonetis/validators/financial-distribution";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  GitFork,
  PiggyBank,
  RefreshCw,
  RotateCcw,
  Tags,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { cn } from "@/lib/utils";
import { useExportFinancialDistributionMutation } from "../financial-distribution.mutations";
import { distributionColorMap } from "../financial-distribution.presentation";
import { financialDistributionQueryOptions } from "../financial-distribution.queries";
import { FinancialDistributionCategories } from "./financial-distribution-categories";
import { FinancialDistributionChart } from "./financial-distribution-chart";
import { FinancialDistributionHighlights } from "./financial-distribution-highlights";
import { FinancialDistributionPercentage } from "./financial-distribution-percentage";

type Props = {
  filters: ListFinancialDistributionQuery;
  onChange: (filters: ListFinancialDistributionQuery) => void;
};

export function FinancialDistributionPage({ filters, onChange }: Props) {
  const reportQuery = useQuery(financialDistributionQueryOptions(filters));
  const peopleQuery = useQuery(peopleQueryOptions());
  const exportMutation = useExportFinancialDistributionMutation();
  const report = reportQuery.data;
  const people = peopleQuery.data ?? [];
  const personOptions = [
    { value: "admin", label: "Você", person: people.find((person) => person.role === "admin") },
    ...people
      .filter((person) => person.role !== "admin")
      .map((person) => ({ value: person.id, label: person.name, person })),
    { value: "all", label: "Todas as pessoas", person: undefined },
  ];
  const selectedPerson = personOptions.find((option) => option.value === filters.personScope);
  const renderPerson = (option: (typeof personOptions)[number]) => (
    <span className="flex min-w-0 items-center gap-2">
      {option.person ? (
        <Avatar size="sm">
          <AvatarImage src={option.person.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{option.person.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
      ) : null}
      <span className="truncate">{option.label}</span>
    </span>
  );
  const colors = report ? distributionColorMap(report) : new Map<string, string>();
  const expenses = report?.categories.filter((category) => category.type === "expense") ?? [];
  const incomes = report?.categories.filter((category) => category.type === "income") ?? [];
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            title="Distribuição financeira"
            description="Veja de onde vem e para onde vai seu dinheiro."
            icon={<GitFork aria-hidden="true" className="size-5" />}
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Distribuição financeira" },
            ]}
            actions={
              <Button
                type="button"
                variant="outline"
                disabled={
                  !report ||
                  reportQuery.isFetching ||
                  reportQuery.isError ||
                  exportMutation.isPending
                }
                onClick={() => report && exportMutation.mutate(report)}
              >
                <Download aria-hidden="true" />
                {exportMutation.isPending ? "Exportando..." : "Exportar CSV"}
              </Button>
            }
          />
          <MonthNavigation
            onPeriodChange={(period) => onChange({ ...filters, period })}
            period={filters.period}
          />
          <section
            aria-label="Filtros do relatório"
            className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="grid min-w-0 gap-1.5 sm:w-64">
              <span className="font-medium text-muted-foreground text-xs">Pessoa</span>
              <Select
                value={filters.personScope}
                onValueChange={(value) => {
                  if (value && personOptions.some((option) => option.value === value))
                    onChange({ ...filters, personScope: value });
                }}
              >
                <SelectTrigger aria-label="Pessoa" className="w-full">
                  <SelectValue>
                    {selectedPerson ? renderPerson(selectedPerson) : "Pessoa indisponível"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {personOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {renderPerson(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {peopleQuery.isError ? (
                <p className="text-destructive text-xs">
                  Não foi possível carregar as pessoas.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void peopleQuery.refetch()}
                  >
                    Tentar novamente
                  </button>
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <span className="font-medium text-muted-foreground text-xs">Composição</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Tabs
                  value={filters.mode}
                  onValueChange={(value) => {
                    if (value === "actual" || value === "forecast")
                      onChange({ ...filters, mode: value });
                  }}
                >
                  <TabsList aria-label="Composição dos valores">
                    <TabsTrigger value="actual">Lançados</TabsTrigger>
                    <TabsTrigger value="forecast">Com previsões</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p
                  className="max-w-xs text-muted-foreground text-xs leading-snug"
                  aria-live="polite"
                >
                  {filters.mode === "actual"
                    ? "Só o que já foi lançado. Lançado não significa pago."
                    : "Inclui recorrências previstas, sem duplicar as já lançadas."}
                </p>
              </div>
            </div>
            {filters.personScope !== "admin" || filters.mode !== "actual" ? (
              <Button
                className="sm:ml-auto"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => onChange({ ...filters, personScope: "admin", mode: "actual" })}
              >
                <RotateCcw aria-hidden="true" />
                Limpar filtros
              </Button>
            ) : null}
          </section>
          {reportQuery.isLoading ? (
            <div
              role="status"
              aria-label="Carregando distribuição financeira"
              className="grid gap-6"
            >
              <Skeleton className="h-64" />
              <Skeleton className="h-96" />
              <span className="sr-only">Carregando relatório…</span>
            </div>
          ) : null}
          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar a distribuição financeira</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void reportQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {report && !reportQuery.isError ? (
            <div
              className={cn(
                "grid min-w-0 gap-6 transition-opacity",
                reportQuery.isFetching && "opacity-60",
              )}
              aria-busy={reportQuery.isFetching}
            >
              <FinancialSummaryHeader
                title={
                  filters.mode === "forecast"
                    ? "Resultado do mês com previsões"
                    : "Resultado do mês lançado"
                }
                subtitle={
                  filters.mode === "forecast"
                    ? "Inclui recorrências previstas, como na Visão geral. Não representa o saldo das contas."
                    : "Só o que já foi lançado; a Visão geral inclui também as previsões. Não representa o saldo das contas."
                }
                variant="soft"
                identity={
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
                    <GitFork aria-hidden="true" className="size-6" />
                  </span>
                }
                primaryLabel="Saldo do período"
                primaryValue={
                  <MoneyValue
                    amount={report.balanceAmount}
                    className={cn(report.balanceAmount < 0 && "text-destructive")}
                  />
                }
                metrics={[
                  {
                    label: "Receitas",
                    icon: <ArrowDownLeft aria-hidden="true" className="size-3.5" />,
                    value: <MoneyValue amount={report.incomeAmount} />,
                    description: (
                      <>
                        <FinancialDistributionPercentage
                          value={report.comparison.incomeChangePercentage}
                          signed
                        />{" "}
                        vs. mês anterior
                      </>
                    ),
                  },
                  {
                    label: "Despesas",
                    icon: <ArrowUpRight aria-hidden="true" className="size-3.5" />,
                    value: <MoneyValue amount={report.expenseAmount} />,
                    description: (
                      <>
                        <FinancialDistributionPercentage
                          value={report.comparison.expenseChangePercentage}
                          signed
                        />{" "}
                        vs. mês anterior
                      </>
                    ),
                  },
                  {
                    label: "Taxa de poupança",
                    icon: <PiggyBank aria-hidden="true" className="size-3.5" />,
                    value: (
                      <FinancialDistributionPercentage
                        value={report.savingsRatePercentage}
                        className="text-current text-xl"
                      />
                    ),
                    description: "Parte das receitas que sobrou no período.",
                  },
                ]}
              />
              {report.flowAmount > 0 ? (
                <FinancialDistributionChart report={report} personScope={filters.personScope} />
              ) : (
                <Card className="grid min-h-56 place-items-center p-6 text-center">
                  <div>
                    <Tags aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-4 font-medium">
                      {report.categories.length
                        ? "Sem fluxo líquido para exibir"
                        : "Nenhuma movimentação neste recorte"}
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Selecione outro mês, pessoa ou inclua as previsões.
                    </p>
                  </div>
                </Card>
              )}
              {report.categories.length ? (
                <>
                  <FinancialDistributionHighlights
                    report={report}
                    personScope={filters.personScope}
                  />
                  <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
                    <FinancialDistributionCategories
                      key={`expense-${report.period}-${filters.personScope}-${report.mode}`}
                      categories={expenses}
                      total={report.expenseAmount}
                      type="expense"
                      period={report.period}
                      personScope={filters.personScope}
                      colors={colors}
                    />
                    <FinancialDistributionCategories
                      key={`income-${report.period}-${filters.personScope}-${report.mode}`}
                      categories={incomes}
                      total={report.incomeAmount}
                      type="income"
                      period={report.period}
                      personScope={filters.personScope}
                      colors={colors}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}
