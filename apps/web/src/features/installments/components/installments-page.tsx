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
import { Skeleton } from "@/components/ui/skeleton";
import { useInstallmentQuoteMutation } from "../installments.mutations";
import { installmentsQueryOptions } from "../installments.queries";
import { InstallmentGroupCard } from "./installment-group-card";
import { InstallmentScenarioPanel } from "./installment-scenario-panel";
import { InstallmentsSummary } from "./installments-summary";

type InstallmentsPageProps = {
  filters: ListInstallmentsQuery;
};

export function InstallmentsPage({ filters }: InstallmentsPageProps) {
  const reportQuery = useQuery(installmentsQueryOptions(filters));
  const quoteMutation = useInstallmentQuoteMutation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [quote, setQuote] = useState<InstallmentQuoteOutput | null>(null);
  const quoteSequence = useRef(0);
  const report = reportQuery.data;
  const pendingIds =
    report?.groups.flatMap((group) =>
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
              “Acompanhadas” são as parcelas cadastradas no OpenMonetis. Se uma compra começou na 5ª
              de 12, as quatro anteriores continuam fora do acompanhamento e não distorcem o
              progresso. Os checkboxes abaixo servem somente para a simulação.
            </p>
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {report.groups.map((group) => (
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
