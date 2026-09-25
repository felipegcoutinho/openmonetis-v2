import type { DashboardWidgetId } from "@openmonetis/domain/dashboard";
import { ChevronDown, ChevronUp, PanelsTopLeft } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardAccountsCardsStrip } from "./dashboard-accounts-cards-strip";
import { DashboardAttentionWidget } from "./dashboard-attention-widget";
import { DashboardMonthlyInsight } from "./dashboard-monthly-insight";
import { DashboardRecentTransactionsWidget } from "./dashboard-recent-transactions-widget";
import { DashboardWidgetGrid } from "./dashboard-widget-grid";

const essentialWidgetIds: readonly DashboardWidgetId[] = [
  "accounts",
  "bills",
  "expense-categories",
  "inbox",
];

export function DashboardMobileOverview({ period }: { period: string }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsId = useId();

  return (
    <section aria-label="Resumo do dashboard" className="grid gap-6">
      <DashboardAttentionWidget period={period} />
      <DashboardAccountsCardsStrip period={period} />
      <DashboardRecentTransactionsWidget period={period} />
      <DashboardMonthlyInsight period={period} />

      <Button
        aria-controls={detailsId}
        aria-expanded={detailsExpanded}
        className="h-11 w-full"
        onClick={() => setDetailsExpanded((expanded) => !expanded)}
        type="button"
        variant="ghost"
      >
        <PanelsTopLeft aria-hidden="true" />
        {detailsExpanded ? "Ocultar indicadores" : "Ver mais indicadores"}
        {detailsExpanded ? (
          <ChevronUp aria-hidden="true" className="ml-auto" />
        ) : (
          <ChevronDown aria-hidden="true" className="ml-auto" />
        )}
      </Button>

      {detailsExpanded ? (
        <div className="grid gap-6" id={detailsId}>
          <header>
            <h2 className="font-heading font-medium">Outros indicadores</h2>
            <p className="mt-1 text-muted-foreground text-sm">Na ordem que você escolheu.</p>
          </header>
          <DashboardWidgetGrid excludedWidgetIds={essentialWidgetIds} period={period} />
        </div>
      ) : null}
    </section>
  );
}
