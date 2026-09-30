import type { ListCategoryTrendsQuery } from "@openmonetis/validators/category-trends";
import { useQuery } from "@tanstack/react-query";
import { Download, FileChartColumn, LineChart, RefreshCw, Table2, Tags } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExportCategoryTrendsMutation } from "../category-trends.mutations";
import { categoryTrendsQueryOptions } from "../category-trends.queries";
import { CategoryTrendsChart } from "./category-trends-chart";
import { CategoryTrendsFilters } from "./category-trends-filters";
import { CategoryTrendsList } from "./category-trends-list";

type CategoryTrendsPageProps = {
  filters: ListCategoryTrendsQuery;
  onFiltersChange: (filters: ListCategoryTrendsQuery) => void;
};

export function CategoryTrendsPage({ filters, onFiltersChange }: CategoryTrendsPageProps) {
  const reportQuery = useQuery(categoryTrendsQueryOptions(filters));
  const exportMutation = useExportCategoryTrendsMutation();
  const report = reportQuery.data;

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            actions={
              <Button
                disabled={!report || exportMutation.isPending || reportQuery.isFetching}
                onClick={() => report && exportMutation.mutate(report)}
                type="button"
                variant="outline"
              >
                <Download aria-hidden="true" />
                {exportMutation.isPending ? "Exportando..." : "Exportar CSV"}
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Evolução por categoria" },
            ]}
            description="Acompanhe a evolução dos seus gastos e receitas por categoria ao longo do tempo."
            icon={<FileChartColumn aria-hidden="true" className="size-5" />}
            title="Evolução por categoria"
          />

          {report ? (
            <CategoryTrendsFilters
              categories={report.availableCategories}
              filters={filters}
              isFetching={reportQuery.isFetching}
              onChange={onFiltersChange}
            />
          ) : (
            <Skeleton className="h-32 rounded-xl" />
          )}

          {reportQuery.isLoading ? <CategoryTrendsSkeleton /> : null}

          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as tendências</p>
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
            report.categories.length ? (
              <div className="grid gap-6" aria-busy={reportQuery.isFetching}>
                <p className="text-muted-foreground text-sm">
                  A média de cada categoria considera apenas os meses com movimento. Os totais
                  incluem os valores previstos de recorrências.
                </p>
                <Tabs className="gap-0" defaultValue="table">
                  <TabsList variant="line">
                    <TabsTrigger value="table">
                      <Table2 aria-hidden="true" />
                      Tabela
                    </TabsTrigger>
                    <TabsTrigger value="chart">
                      <LineChart aria-hidden="true" />
                      Gráfico
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent className="pt-5" value="table">
                    <CategoryTrendsList categories={report.categories} periods={report.periods} />
                  </TabsContent>
                  <TabsContent className="pt-5" value="chart">
                    <CategoryTrendsChart categories={report.categories} periods={report.periods} />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card className="grid min-h-64 place-items-center p-6 text-center">
                <div className="max-w-md">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Tags aria-hidden="true" className="size-5" />
                  </span>
                  <p className="mt-4 font-medium">Nenhum lançamento neste recorte</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Amplie o intervalo ou limpe as categorias selecionadas para encontrar
                    movimentos.
                  </p>
                  {filters.categoryIds.length ? (
                    <Button
                      className="mt-4"
                      onClick={() => onFiltersChange({ ...filters, categoryIds: [] })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Ver todas as categorias
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}

function CategoryTrendsSkeleton() {
  return (
    <div aria-label="Carregando tendências" className="grid gap-6" role="status">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-96" />
      <span className="sr-only">Carregando relatório…</span>
    </div>
  );
}
