import {
  type ListCommitmentsQuery,
  ListCommitmentsQuerySchema,
  maxCommitmentMonths,
} from "@openmonetis/validators/commitments";
import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EntityLoadError } from "@/components/entity-load-error";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { PeriodRangePicker } from "@/components/period-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { commitmentsQueryOptions } from "../commitments.queries";
import { CommitmentsChart } from "./commitments-chart";
import { CommitmentsHighlights } from "./commitments-highlights";
import { CommitmentsTable } from "./commitments-table";

type Props = {
  filters: ListCommitmentsQuery;
  onChange: (filters: ListCommitmentsQuery) => void;
};

export function CommitmentsPage({ filters, onChange }: Props) {
  const reportQuery = useQuery(commitmentsQueryOptions(filters));
  const report = reportQuery.data;
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            title="Compromissos futuros"
            description="Quanto da sua renda já está comprometido nos próximos meses."
            icon={<Gauge aria-hidden="true" className="size-5" />}
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Compromissos futuros" },
            ]}
          />
          <section
            aria-label="Filtros do relatório"
            className="flex min-w-0 flex-wrap items-center justify-between gap-3"
          >
            <PeriodRangePicker
              value={filters}
              onChange={onChange}
              schema={ListCommitmentsQuerySchema}
              maxMonths={maxCommitmentMonths}
            />
            <p className="text-muted-foreground text-xs sm:max-w-md">
              Considera parcelas, recorrências e despesas avulsas lançadas, descontando estornos.
              Receita prevista: recorrentes e lançadas.
            </p>
          </section>
          {reportQuery.isError ? (
            <EntityLoadError
              entity="os compromissos"
              error={reportQuery.error}
              onRetry={() => void reportQuery.refetch()}
            >
              {null}
            </EntityLoadError>
          ) : report ? (
            <div className="grid min-w-0 gap-6">
              <CommitmentsHighlights report={report} />
              <CommitmentsChart report={report} isFetching={reportQuery.isFetching} />
              <CommitmentsTable report={report} />
            </div>
          ) : (
            <div className="grid gap-4" aria-busy="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}
        </section>
      </main>
    </ProtectedRoute>
  );
}
