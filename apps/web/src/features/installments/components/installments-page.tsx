import type {
  InstallmentQuoteOutput,
  ListInstallmentsQuery,
} from "@openmonetis/validators/installments";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ClipboardList, CreditCard, Info, RefreshCw, Search, SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useInstallmentQuoteMutation } from "../installments.mutations";
import { formatInstallmentPeriod } from "../installments.presentation";
import { installmentsQueryOptions } from "../installments.queries";
import { InstallmentGroupCard } from "./installment-group-card";
import { InstallmentScenarioPanel } from "./installment-scenario-panel";
import { InstallmentsMonthlyChart } from "./installments-monthly-chart";
import { InstallmentsSummary } from "./installments-summary";

type InstallmentsPageProps = {
  filters: ListInstallmentsQuery;
  onStatusChange: (status: ListInstallmentsQuery["status"]) => void;
};

export function InstallmentsPage({ filters, onStatusChange }: InstallmentsPageProps) {
  const reportQuery = useQuery(installmentsQueryOptions(filters));
  const quoteMutation = useInstallmentQuoteMutation();
  const [cardId, setCardId] = useState("all");
  const [search, setSearch] = useState("");
  const [reportExplanationOpen, setReportExplanationOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [quote, setQuote] = useState<InstallmentQuoteOutput | null>(null);
  const quoteSequence = useRef(0);
  const report = reportQuery.data;
  const cardOptions = [
    ...new Map(
      (report?.groups ?? []).flatMap((group) =>
        group.cardId
          ? [[group.cardId, { name: group.cardName ?? "Cartão", logo: group.cardLogo }] as const]
          : [],
      ),
    ).entries(),
  ];
  const selectedCard = cardOptions.find(([id]) => id === cardId)?.[1];
  const visibleGroups = (report?.groups ?? []).filter(
    (group) =>
      (cardId === "all" || group.cardId === cardId) &&
      `${group.name} ${group.cardName ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const pendingIds = visibleGroups.flatMap((group) =>
    group.installments
      .filter((installment) => installment.status === "pending")
      .map((installment) => installment.id),
  );
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((installmentId) => selectedIds.has(installmentId));
  const hasAnyPurchase = (report?.summary.trackedInstallmentCount ?? 0) > 0;

  async function applySelection(next: Set<string>) {
    setSelectedIds(next);
    const sequence = quoteSequence.current + 1;
    quoteSequence.current = sequence;

    if (next.size === 0) {
      setQuote(null);
      quoteMutation.reset();
      return;
    }

    setQuote(null);
    try {
      const result = await quoteMutation.mutateAsync({ installmentIds: [...next] });
      if (quoteSequence.current === sequence) setQuote(result);
    } catch {
      if (quoteSequence.current === sequence) {
        setQuote(null);
        toast.error("Não foi possível calcular a simulação.");
      }
    }
  }

  function clearSelection() {
    if (selectedIds.size > 0) void applySelection(new Set());
  }

  function toggleInstallment(installmentId: string) {
    const next = new Set(selectedIds);
    if (next.has(installmentId)) next.delete(installmentId);
    else next.add(installmentId);
    void applySelection(next);
  }

  function toggleGroup(installmentIds: string[]) {
    const next = new Set(selectedIds);
    const allSelected =
      installmentIds.length > 0 && installmentIds.every((installmentId) => next.has(installmentId));
    for (const installmentId of installmentIds) {
      if (allSelected) next.delete(installmentId);
      else next.add(installmentId);
    }
    void applySelection(next);
  }

  function changeStatus(status: ListInstallmentsQuery["status"]) {
    clearSelection();
    setCardId("all");
    onStatusChange(status);
  }

  function clearFilters() {
    clearSelection();
    setSearch("");
    setCardId("all");
    onStatusChange("all");
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Despesas parceladas" },
            ]}
            description="Acompanhe o saldo, os compromissos do mês e a evolução das parcelas."
            icon={<ClipboardList aria-hidden="true" className="size-5" />}
            title="Despesas parceladas"
          />

          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 text-muted-foreground text-xs">
            <Tooltip onOpenChange={setReportExplanationOpen} open={reportExplanationOpen}>
              <TooltipTrigger
                render={
                  <button
                    className="inline-flex items-center gap-1.5 rounded-sm text-info underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setReportExplanationOpen(true)}
                    type="button"
                  />
                }
              >
                <Info aria-hidden="true" className="size-3.5" />
                Como este relatório é calculado
              </TooltipTrigger>
              <TooltipContent
                align="start"
                className="max-w-sm text-left leading-relaxed"
                side="right"
                sideOffset={8}
              >
                O saldo em aberto inclui parcelas futuras. O gráfico soma as parcelas registradas em
                cada mês, pagas ou pendentes. Compras acompanhadas a partir de uma parcela
                intermediária não incluem as anteriores.
              </TooltipContent>
            </Tooltip>
            {report ? (
              <p>Referência dos compromissos: {formatInstallmentPeriod(report.referencePeriod)}</p>
            ) : null}
          </div>

          {reportQuery.isLoading ? <InstallmentsSkeleton /> : null}

          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as parcelas</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => reportQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {report && !reportQuery.isError ? (
            <>
              <InstallmentsSummary report={report} />
              <InstallmentsMonthlyChart isFetching={reportQuery.isFetching} report={report} />

              <section aria-labelledby="installment-groups-title">
                <Card className="gap-0 py-0 shadow-none">
                  <CardHeader className="flex flex-col items-stretch gap-4 p-5 sm:p-6">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <h2
                          className="font-heading font-medium text-lg"
                          id="installment-groups-title"
                        >
                          Compras parceladas
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {visibleGroups.length} {visibleGroups.length === 1 ? "compra" : "compras"}{" "}
                          na lista
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:ml-auto xl:justify-end">
                        <Tabs
                          onValueChange={(value) => {
                            if (value === "open" || value === "completed" || value === "all") {
                              changeStatus(value);
                            }
                          }}
                          value={filters.status}
                        >
                          <TabsList
                            aria-label="Situação das compras"
                            className="xl:border-b-0"
                            variant="line"
                          >
                            <TabsTrigger value="open">Em andamento</TabsTrigger>
                            <TabsTrigger value="completed">Concluídas</TabsTrigger>
                            <TabsTrigger value="all">Todas</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Select
                          value={cardId}
                          onValueChange={(value) => {
                            if (value) {
                              clearSelection();
                              setCardId(value);
                            }
                          }}
                        >
                          <SelectTrigger
                            aria-label="Filtrar compras por cartão"
                            className="w-full min-w-0 sm:w-45"
                          >
                            <SelectValue>
                              <span className="flex min-w-0 items-center gap-2">
                                <CardOptionAvatar logo={selectedCard?.logo ?? null} />
                                <span className="truncate">
                                  {cardId === "all"
                                    ? "Todos os meios"
                                    : (selectedCard?.name ?? "Cartão selecionado")}
                                </span>
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <CardOptionAvatar logo={null} />
                              Todos os meios
                            </SelectItem>
                            {cardOptions.map(([id, card]) => (
                              <SelectItem key={id} value={id}>
                                <CardOptionAvatar logo={card.logo} />
                                {card.name}
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
                            aria-label="Buscar compras parceladas"
                            className="w-full pl-9"
                            placeholder="Buscar compra ou cartão"
                            value={search}
                            onChange={(event) => {
                              clearSelection();
                              setSearch(event.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-2 px-5 pb-2 sm:px-6">
                    {pendingIds.length > 0 ? (
                      <InstallmentScenarioPanel
                        allPendingSelected={allPendingSelected}
                        hasPendingInstallments={pendingIds.length > 0}
                        isQuoting={quoteMutation.isPending}
                        onClear={() => void applySelection(new Set())}
                        onSelectAll={() => void applySelection(new Set(pendingIds))}
                        quote={quote}
                        selectedCount={selectedIds.size}
                      />
                    ) : null}

                    {visibleGroups.length > 0 ? (
                      <ul aria-busy={reportQuery.isFetching} className="divide-y">
                        {visibleGroups.map((group) => (
                          <InstallmentGroupCard
                            group={group}
                            key={group.seriesId}
                            onToggleGroup={toggleGroup}
                            onToggleInstallment={toggleInstallment}
                            selectedIds={selectedIds}
                          />
                        ))}
                      </ul>
                    ) : (
                      <div className="grid min-h-48 place-items-center p-6 text-center">
                        <div className="max-w-md">
                          <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                            <SearchX aria-hidden="true" className="size-5" />
                          </span>
                          <p className="mt-3 font-medium">
                            {hasAnyPurchase
                              ? "Nenhuma compra corresponde aos filtros"
                              : "Nenhuma compra parcelada cadastrada"}
                          </p>
                          <p className="mt-1 text-muted-foreground text-sm">
                            {hasAnyPurchase
                              ? "Ajuste a situação, o cartão ou a busca para ver outras compras."
                              : "Cadastre uma despesa parcelada para acompanhar o cronograma aqui."}
                          </p>
                          {hasAnyPurchase ? (
                            <Button
                              className="mt-4"
                              onClick={clearFilters}
                              type="button"
                              variant="outline"
                            >
                              Limpar filtros
                            </Button>
                          ) : (
                            <Button asChild className="mt-4" variant="outline">
                              <Link to="/transactions">Ir para lançamentos</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function InstallmentsSkeleton() {
  return (
    <div aria-label="Carregando parcelas" className="grid gap-4" role="status">
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <span className="sr-only">Carregando relatório…</span>
    </div>
  );
}

function CardOptionAvatar({ logo }: { logo: string | null }) {
  return logo ? (
    <Image
      alt=""
      className="size-5 shrink-0 rounded-full object-contain"
      height={20}
      layout="fixed"
      src={logo}
      width={20}
    />
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <CreditCard aria-hidden="true" className="size-3" />
    </span>
  );
}
