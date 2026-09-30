import {
  createDefaultDashboardWidgetPreferences,
  type DashboardWidgetId,
} from "@openmonetis/domain/dashboard";
import { useQuery } from "@tanstack/react-query";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardWidgetPreferencesQueryOptions } from "../dashboard.queries";
import { dashboardWidgetById } from "./dashboard-widget-registry";

export function DashboardWidgetGrid({
  excludedWidgetIds = [],
  period,
  placeBillsAfterInvoices = false,
}: {
  excludedWidgetIds?: readonly DashboardWidgetId[];
  period: string;
  placeBillsAfterInvoices?: boolean;
}) {
  const defaults = createDefaultDashboardWidgetPreferences();
  const preferencesQuery = useQuery(dashboardWidgetPreferencesQueryOptions());
  const preferences = preferencesQuery.data ?? defaults;
  const excludedWidgets = new Set(excludedWidgetIds);
  const visibleWidgets = preferences.order.flatMap((widgetId) => {
    const widget = dashboardWidgetById.get(widgetId);
    return widget && !preferences.hidden.includes(widgetId) && !excludedWidgets.has(widgetId)
      ? [widget]
      : [];
  });
  if (placeBillsAfterInvoices) {
    const invoicesIndex = visibleWidgets.findIndex((widget) => widget.id === "invoices");
    const billsIndex = visibleWidgets.findIndex((widget) => widget.id === "bills");
    if (invoicesIndex >= 0 && billsIndex >= 0) {
      const [bills] = visibleWidgets.splice(billsIndex, 1);
      const nextInvoicesIndex = visibleWidgets.findIndex((widget) => widget.id === "invoices");
      visibleWidgets.splice(nextInvoicesIndex + 1, 0, bills);
    }
  }

  return (
    <div className="grid gap-6">
      {preferencesQuery.isError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Não foi possível carregar suas preferências. Exibindo a organização padrão.
          </p>
          <Button
            className="shrink-0"
            onClick={() => void preferencesQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {visibleWidgets.length > 0 ? (
        <section
          aria-label="Widgets do dashboard"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {visibleWidgets.map((widget) => (
            <div className="min-w-0" key={widget.id}>
              {widget.render(period)}
            </div>
          ))}
        </section>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card/50 px-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <EyeOff aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 font-heading font-medium">Seu dashboard está vazio</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Use a personalização para ativar os widgets que deseja acompanhar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
