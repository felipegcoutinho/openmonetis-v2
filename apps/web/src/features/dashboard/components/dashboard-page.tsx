import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { useIsMobile } from "@/hooks/useIsMobile";
import { authClient } from "@/lib/auth-client";
import { dashboardMetricsQueryOptions } from "../dashboard.queries";
import { DashboardCustomizer } from "./dashboard-customizer";
import {
  DashboardMetrics,
  DashboardMetricsError,
  DashboardMetricsSkeleton,
} from "./dashboard-metrics";
import { DashboardMobileOverview } from "./dashboard-mobile-overview";
import { DashboardQuickActions } from "./dashboard-quick-actions";
import { DashboardWelcome } from "./dashboard-welcome";
import { DashboardWidgetGrid } from "./dashboard-widget-grid";

export function DashboardPage({
  onPeriodChange,
  period,
}: {
  onPeriodChange: (period: string) => void;
  period: string;
}) {
  const session = authClient.useSession();
  const accountsQuery = useQuery(accountsQueryOptions());
  const metricsQuery = useQuery(dashboardMetricsQueryOptions(period));
  const isMobile = useIsMobile();

  return (
    <ProtectedRoute>
      <main className="relative isolate min-h-svh bg-background">
        <div aria-hidden="true" className="dashboard-atmosphere hidden md:block" />
        <Navbar />
        <div className="app-page project-container relative z-10 max-md:gap-5 max-md:py-4">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <div className="min-w-0 flex-1">
              <DashboardWelcome compactName name={session.data?.user.name} />
            </div>
            <DashboardCustomizer />
          </div>

          <div className="hidden gap-6 md:flex lg:flex-row lg:items-center lg:justify-between">
            <DashboardWelcome name={session.data?.user.name} />
            <div className="flex w-full items-center gap-1 lg:w-auto">
              <div className="min-w-0 flex-1">
                <DashboardQuickActions period={period} />
              </div>
              <DashboardCustomizer />
            </div>
          </div>

          {accountsQuery.data?.length === 0 ? (
            <Card className="hidden gap-3 p-5 md:grid">
              <h2 className="font-semibold">Comece cadastrando sua primeira conta</h2>
              <p className="text-muted-foreground text-sm">
                Depois, informe o saldo que você já tem e registre suas receitas e despesas.
              </p>
              <Button asChild className="w-fit">
                <Link to="/accounts">Cadastrar primeira conta</Link>
              </Button>
            </Card>
          ) : null}
          <MonthNavigation
            className="sticky top-20 z-20 md:top-24"
            onPeriodChange={onPeriodChange}
            period={period}
          />

          {metricsQuery.isLoading ? <DashboardMetricsSkeleton /> : null}
          {metricsQuery.isError ? (
            <DashboardMetricsError onRetry={() => void metricsQuery.refetch()} />
          ) : null}
          {metricsQuery.data && !metricsQuery.isError ? (
            <div aria-busy={metricsQuery.isFetching} className="grid gap-2">
              <DashboardMetrics metrics={metricsQuery.data} />
            </div>
          ) : null}

          {isMobile === true ? <DashboardQuickActions period={period} /> : null}

          {isMobile === true && accountsQuery.data?.length === 0 ? (
            <Card className="gap-3 p-5 md:hidden">
              <h2 className="font-semibold">Comece cadastrando sua primeira conta</h2>
              <p className="text-muted-foreground text-sm">
                Depois, informe o saldo que você já tem e registre suas receitas e despesas.
              </p>
              <Button asChild className="w-fit">
                <Link to="/accounts">Cadastrar primeira conta</Link>
              </Button>
            </Card>
          ) : null}

          {isMobile === true ? <DashboardMobileOverview period={period} /> : null}
          {isMobile === false ? <DashboardWidgetGrid period={period} /> : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
