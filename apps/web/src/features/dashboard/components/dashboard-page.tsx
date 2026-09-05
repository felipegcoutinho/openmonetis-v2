import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { authClient } from "@/lib/auth-client";
import { dashboardMetricsQueryOptions } from "../dashboard.queries";
import { DashboardCustomizer } from "./dashboard-customizer";
import {
  DashboardMetrics,
  DashboardMetricsError,
  DashboardMetricsSkeleton,
} from "./dashboard-metrics";
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
  const metricsQuery = useQuery(dashboardMetricsQueryOptions(period));

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <div className="app-page project-container">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <DashboardWelcome name={session.data?.user.name} />
            <div className="flex w-full items-center gap-1 lg:w-auto">
              <div className="min-w-0 flex-1">
                <DashboardQuickActions period={period} />
              </div>
              <DashboardCustomizer />
            </div>
          </div>

          <MonthNavigation
            className="sticky top-24 z-20"
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

          <DashboardWidgetGrid period={period} />
        </div>
      </main>
    </ProtectedRoute>
  );
}
