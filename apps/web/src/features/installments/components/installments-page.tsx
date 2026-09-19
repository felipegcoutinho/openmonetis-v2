import type {
  InstallmentQuoteOutput,
  ListInstallmentsQuery,
} from "@openmonetis/validators/installments";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Info, RefreshCw, SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstallmentQuoteMutation } from "../installments.mutations";
import { formatInstallmentPeriod } from "../installments.presentation";
import { installmentsQueryOptions } from "../installments.queries";
import { InstallmentGroupCard } from "./installment-group-card";
import { InstallmentScenarioPanel } from "./installment-scenario-panel";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [quote, setQuote] = useState<InstallmentQuoteOutput | null>(null);
  const quoteSequence = useRef(0);
  const report = reportQuery.data;
  const cardOptions = [
    ...new Map(
      (report?.groups ?? [])
        .filter((group) => group.cardId)
        .map((group) => [group.cardId, group.cardName]),
    ).entries(),
  ];
  const visibleGroups = (report?.groups ?? []).filter(
    (group) =>
      (cardId === "all" || group.cardId === cardId) &&
      `${group.name} ${group.cardName ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const pendingIds =
    visibleGroups.flatMap((group) =>
      group.installments
        .filter((installment) => installment.status === "pending")
        .map((installment) => installment.id),
    ) ?? [];
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((installmentId) => selectedIds.has(installmentId));

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
            description="Veja o saldo de compras parceladas, os próximos compromissos e simule a quitação das parcelas em aberto."
            icon={<ClipboardList aria-hidden="true" className="size-5" />}
            title="Despesas parceladas"
          />

          <div className="flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 p-3 text-sm">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
            <p>
              Selecione parcelas para simular a quitação. Nada será alterado. O relatório inclui
              parcelas futuras; compras cadastradas a partir de uma parcela intermediária não
              incluem as anteriores.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.status}
              onValueChange={(value) => {
                if (value) {
                  void applySelection(new Set());
                  onStatusChange(value as ListInstallmentsQuery["status"]);
                }
              }}
            >
              <SelectTrigger aria-label="Situação das compras parceladas">
                <SelectValue>
                  {filters.status === "open"
                    ? "Em andamento"
                    : filters.status === "completed"
                      ? "Concluídas"
                      : "Todas as situações"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="open">Em andamento</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
              </SelectContent>
            </Select>
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
              <p className="text-muted-foreground text-xs">
                Referência dos próximos compromissos:{" "}
                {formatInstallmentPeriod(report.referencePeriod)}
              </p>
              <InstallmentsSummary report={report} />
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

              {report.groups.length > 0 ? (
                <section aria-labelledby="installment-groups-title" className="grid gap-4">
                  <div>
                    <h2 className="font-semibold text-lg" id="installment-groups-title">
                      Compras parceladas
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Ordenadas pela próxima parcela pendente.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={cardId} onValueChange={(value) => value && setCardId(value)}>
                      <SelectTrigger aria-label="Filtrar compras por cartão">
                        <SelectValue>
                          {cardId === "all"
                            ? "Todos os cartões"
                            : (cardOptions.find(([id]) => id === cardId)?.[1] ??
                              "Cartão selecionado")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os cartões</SelectItem>
                        {cardOptions.map(([id, name]) => (
                          <SelectItem key={id} value={id as string}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>{" "}
                    <Input
                      aria-label="Buscar compras parceladas"
                      className="min-w-48 flex-1"
                      placeholder="Buscar compra ou cartão"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  {!visibleGroups.length ? (
                    <div className="rounded-lg border p-6 text-center">
                      <p>Nenhuma compra corresponde aos filtros.</p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        onClick={() => {
                          setSearch("");
                          setCardId("all");
                          onStatusChange("all");
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleGroups.map((group) => (
                      <InstallmentGroupCard
                        group={group}
                        key={group.seriesId}
                        onToggleGroup={toggleGroup}
                        onToggleInstallment={toggleInstallment}
                        selectedIds={selectedIds}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <Card className="grid min-h-64 place-items-center p-6 text-center">
                  <div className="max-w-md">
                    <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                      <SearchX aria-hidden="true" className="size-5" />
                    </span>
                    <p className="mt-4 font-medium">Nenhuma compra parcelada encontrada</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      As compras parceladas cadastradas aparecerão aqui com seu cronograma.
                    </p>
                  </div>
                </Card>
              )}
            </>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function InstallmentsSkeleton() {
  return (
    <div aria-label="Carregando parcelas" className="grid gap-6" role="status">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-28" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="hidden h-80 xl:block" />
      </div>
      <span className="sr-only">Carregando relatório…</span>
    </div>
  );
}
