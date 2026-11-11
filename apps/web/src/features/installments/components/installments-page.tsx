import type { InstallmentPurchaseSimulationOutput } from "@openmonetis/validators/installments";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calculator, CalendarClock, RefreshCw, SearchX, ShoppingBag } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api-client";
import {
  getPayoffSimulationErrorMessage,
  type InstallmentsSearch,
  parseDiscountInput,
} from "../installments.presentation";
import {
  installmentPayoffSimulationQueryOptions,
  installmentsQueryOptions,
} from "../installments.queries";
import { CardOptionAvatar } from "./card-option-avatar";
import { InstallmentGroupCard } from "./installment-group-card";
import { emptyPayoffDiscount, type PayoffDiscountDraft } from "./installment-payoff-discount-field";
import { InstallmentPayoffPanel } from "./installment-payoff-panel";
import { InstallmentPurchaseSimulationDialog } from "./installment-purchase-simulation-dialog";
import { InstallmentsMonthlyChart } from "./installments-monthly-chart";
import { InstallmentsSummary } from "./installments-summary";
import { SimulatedPurchaseRow } from "./simulated-purchase-row";

type InstallmentsPageProps = {
  search: InstallmentsSearch;
  onSearchChange: (patch: Partial<InstallmentsSearch>) => void;
};

export function InstallmentsPage({ search, onSearchChange }: InstallmentsPageProps) {
  const reportQuery = useQuery(installmentsQueryOptions({}));
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [discounts, setDiscounts] = useState<Record<string, PayoffDiscountDraft>>({});
  // Simulations are ephemeral screen state: they live only here and are never saved.
  const [simulation, setSimulation] = useState<InstallmentPurchaseSimulationOutput | null>(null);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const deferredDiscounts = useDeferredValue(discounts);
  const report = reportQuery.data;
  const selectedSeriesIds = new Set(
    (report?.groups ?? [])
      .filter((group) => group.installments.some((installment) => selectedIds.has(installment.id)))
      .map((group) => group.seriesId),
  );
  const payoffQuery = useQuery(
    installmentPayoffSimulationQueryOptions({
      installmentIds: [...selectedIds].sort(),
      // Only purchases with something selected may carry a discount.
      discounts: Object.entries(deferredDiscounts)
        .map(([seriesId, draft]) => ({
          seriesId,
          type: draft.type,
          value: parseDiscountInput(draft.value),
        }))
        .filter((item) => item.value > 0 && selectedSeriesIds.has(item.seriesId))
        .sort((left, right) => left.seriesId.localeCompare(right.seriesId)),
    }),
  );
  const payoff =
    selecting && selectedIds.size > 0 && !payoffQuery.isError ? (payoffQuery.data ?? null) : null;
  const payoffImpactBySeries = new Map((payoff?.series ?? []).map((item) => [item.seriesId, item]));
  const payoffErrorMessage =
    payoffQuery.isError && selectedIds.size > 0
      ? getPayoffSimulationErrorMessage(
          payoffQuery.error instanceof ApiClientError ? payoffQuery.error.code : undefined,
        )
      : null;
  const cardOptions = [
    ...new Map(
      (report?.groups ?? []).flatMap((group) =>
        group.cardId
          ? [[group.cardId, { name: group.cardName ?? "Cartão", logo: group.cardLogo }] as const]
          : [],
      ),
    ).entries(),
  ];
  const selectedCard = cardOptions.find(([id]) => id === search.card)?.[1];
  const term = search.q.trim().toLocaleLowerCase("pt-BR");
  const visibleGroups = (report?.groups ?? []).filter(
    (group) =>
      (search.card === "all" || group.cardId === search.card) &&
      `${group.name} ${group.cardName ?? ""}`.toLocaleLowerCase("pt-BR").includes(term),
  );
  const pendingIds = visibleGroups.flatMap((group) =>
    group.installments
      .filter((installment) => installment.status === "pending")
      .map((installment) => installment.id),
  );
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((installmentId) => selectedIds.has(installmentId));
  const hasAnyPurchase = (report?.summary.trackedInstallmentCount ?? 0) > 0;
  const hasFilters = search.card !== "all" || term.length > 0;

  function clearSelection() {
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }

  function stopSelecting() {
    clearSelection();
    setDiscounts({});
    setSelecting(false);
  }

  function toggleInstallment(installmentId: string) {
    const next = new Set(selectedIds);
    if (next.has(installmentId)) next.delete(installmentId);
    else next.add(installmentId);
    setSelectedIds(next);
  }

  function toggleGroup(installmentIds: string[]) {
    const next = new Set(selectedIds);
    const allSelected =
      installmentIds.length > 0 && installmentIds.every((installmentId) => next.has(installmentId));
    for (const installmentId of installmentIds) {
      if (allSelected) next.delete(installmentId);
      else next.add(installmentId);
    }
    setSelectedIds(next);
  }

  function changeSearch(patch: Partial<InstallmentsSearch>) {
    clearSelection();
    onSearchChange(patch);
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
            description="Todas as suas compras parceladas: quanto falta pagar e quando cada uma termina."
            icon={<CalendarClock aria-hidden="true" className="size-5" />}
            title="Despesas parceladas"
          />

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
              <InstallmentsMonthlyChart
                isFetching={reportQuery.isFetching}
                payoff={payoff}
                report={report}
                simulation={simulation}
              />

              <section aria-labelledby="installment-groups-title">
                <Card className="gap-0 py-0 shadow-none">
                  <CardHeader className="flex flex-col items-stretch gap-4 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="section-title" id="installment-groups-title">
                          Compras parceladas
                        </h2>
                        <p className="text-muted-foreground text-sm tabular-nums">
                          {visibleGroups.length} {visibleGroups.length === 1 ? "compra" : "compras"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setSimulationDialogOpen(true)}
                          type="button"
                          variant="outline"
                        >
                          <ShoppingBag aria-hidden="true" />
                          {simulation ? "Editar simulação" : "Simular compra"}
                        </Button>
                        {!selecting && pendingIds.length > 0 ? (
                          <Button
                            onClick={() => setSelecting(true)}
                            type="button"
                            variant="outline"
                          >
                            <Calculator aria-hidden="true" />
                            Simular quitação
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] lg:w-auto">
                        <Select
                          value={search.card}
                          onValueChange={(value) => {
                            if (value) changeSearch({ card: value });
                          }}
                        >
                          <SelectTrigger
                            aria-label="Filtrar compras por cartão"
                            className="w-full min-w-0 sm:w-48"
                          >
                            <SelectValue>
                              <span className="flex min-w-0 items-center gap-2">
                                <CardOptionAvatar logo={selectedCard?.logo ?? null} />
                                <span className="truncate">
                                  {search.card === "all"
                                    ? "Todos os cartões"
                                    : (selectedCard?.name ?? "Cartão selecionado")}
                                </span>
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <CardOptionAvatar logo={null} />
                              Todos os cartões
                            </SelectItem>
                            {cardOptions.map(([id, card]) => (
                              <SelectItem key={id} value={id}>
                                <CardOptionAvatar logo={card.logo} />
                                {card.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <SearchInput
                          aria-label="Buscar compras parceladas"
                          containerClassName="lg:w-60"
                          placeholder="Buscar compra ou cartão"
                          maxLength={160}
                          value={search.q}
                          onValueChange={(q) => changeSearch({ q })}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-2 px-5 pb-2 sm:px-6">
                    {selecting ? (
                      <InstallmentPayoffPanel
                        allPendingSelected={allPendingSelected}
                        errorMessage={payoffErrorMessage}
                        isLoading={payoffQuery.isFetching}
                        onClearSelection={clearSelection}
                        onClose={stopSelecting}
                        onSelectAll={() => setSelectedIds(new Set(pendingIds))}
                        selectedCount={selectedIds.size}
                        simulation={payoff}
                      />
                    ) : null}

                    {simulation ? (
                      <SimulatedPurchaseRow
                        onEdit={() => setSimulationDialogOpen(true)}
                        onRemove={() => setSimulation(null)}
                        simulation={simulation}
                      />
                    ) : null}

                    {visibleGroups.length > 0 ? (
                      <ul aria-busy={reportQuery.isFetching} className="divide-y">
                        {visibleGroups.map((group) => (
                          <InstallmentGroupCard
                            group={group}
                            key={group.seriesId}
                            onToggleGroup={toggleGroup}
                            onPayoffDiscountChange={(seriesId, discount) =>
                              setDiscounts((current) => ({ ...current, [seriesId]: discount }))
                            }
                            onToggleInstallment={toggleInstallment}
                            payoffDiscount={discounts[group.seriesId] ?? emptyPayoffDiscount}
                            payoffImpact={payoffImpactBySeries.get(group.seriesId)}
                            selectedIds={selectedIds}
                            selecting={selecting}
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
                          <p className="mt-1 text-pretty text-muted-foreground text-sm">
                            {hasAnyPurchase
                              ? "Ajuste o cartão ou a busca para ver outras compras."
                              : "Cadastre uma despesa parcelada para acompanhar o cronograma aqui."}
                          </p>
                          {hasAnyPurchase && hasFilters ? (
                            <Button
                              className="mt-4"
                              onClick={() => changeSearch({ card: "all", q: "" })}
                              type="button"
                              variant="outline"
                            >
                              Limpar filtros
                            </Button>
                          ) : !hasAnyPurchase ? (
                            <Button asChild className="mt-4" variant="outline">
                              <Link to="/transactions">Ir para lançamentos</Link>
                            </Button>
                          ) : null}
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
      {simulationDialogOpen ? (
        <InstallmentPurchaseSimulationDialog
          onOpenChange={setSimulationDialogOpen}
          onSimulated={setSimulation}
          open
          simulation={simulation}
        />
      ) : null}
    </ProtectedRoute>
  );
}

function InstallmentsSkeleton() {
  return (
    <div aria-label="Carregando parcelas" className="grid gap-4" role="status">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <span className="sr-only">Carregando relatório…</span>
    </div>
  );
}
