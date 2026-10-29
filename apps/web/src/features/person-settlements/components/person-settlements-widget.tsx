import type { PersonSettlementSummaryItemOutput } from "@openmonetis/validators/person-settlements";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HandCoins, RefreshCw } from "lucide-react";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { getInitials } from "@/lib/name-presentation";
import { cn } from "@/lib/utils";
import {
  formatPendingPeopleCount,
  getSettlementProgressPercentage,
} from "../person-settlements.presentation";
import { personSettlementsSummaryQueryOptions } from "../person-settlements.queries";

const maximumVisiblePeople = 2;
const skeletonKeys = ["first", "second"] as const;

export function PersonSettlementsWidget({ period }: { period: string }) {
  const query = useQuery(personSettlementsSummaryQueryOptions(period));
  const summary = query.data;
  const items = summary?.items ?? [];

  return (
    <DashboardWidget
      action={
        summary?.pendingCount ? (
          <Badge variant="secondary">{formatPendingPeopleCount(summary.pendingCount)}</Badge>
        ) : null
      }
      description="Repasses recebidos e pendentes"
      footer={
        items.length ? (
          <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/people">
            Ver pessoas <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<HandCoins aria-hidden="true" />}
      title="Acertos por pessoas"
    >
      {query.isLoading ? <PersonSettlementsLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar os acertos</p>
            <Button
              className="mt-3"
              onClick={() => void query.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {summary && !query.isError ? (
        items.length ? (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <PersonSettlementList items={items.slice(0, maximumVisiblePeople)} period={period} />
          </div>
        ) : (
          <DashboardWidgetEmptyState
            collapseWidget
            description="Nenhum valor foi atribuído a outras pessoas neste mês."
            icon={<HandCoins aria-hidden="true" />}
            title="Nada para acertar"
          />
        )
      ) : null}
    </DashboardWidget>
  );
}

function PersonSettlementList({
  items,
  period,
}: {
  items: PersonSettlementSummaryItemOutput[];
  period: string;
}) {
  return (
    <ol className="divide-y">
      {items.map((item) => (
        <PersonSettlementItem item={item} key={item.personId} period={period} />
      ))}
    </ol>
  );
}

function PersonSettlementItem({
  item,
  period,
}: {
  item: PersonSettlementSummaryItemOutput;
  period: string;
}) {
  const { balance } = item;
  const isSettled = balance.status === "settled";
  const isCredit = balance.status === "credit";
  const percentage = getSettlementProgressPercentage(balance.coveredAmount, balance.dueAmount);

  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-center gap-3">
        <Avatar className={cn("size-9 overflow-hidden", isSettled && "opacity-70")}>
          {item.personAvatarUrl ? (
            <AvatarImage
              alt={`Avatar de ${item.personName}`}
              className="scale-[1.06]"
              src={item.personAvatarUrl}
            />
          ) : null}
          <AvatarFallback>{getInitials(item.personName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              params={{ personId: item.personId }}
              search={{ period, view: "panel" }}
              to="/people/$personId"
            >
              <span className="truncate">{item.personName}</span>
              <DashboardItemLinkArrow />
            </Link>
            {item.personStatus === "inactive" ? (
              <span className="shrink-0 text-muted-foreground text-2xs">Inativa</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {isSettled ? "Acertado" : `${percentage}% recebido`}
          </p>
        </div>
        <MoneyValue amount={balance.dueAmount} className="shrink-0 font-medium text-sm" />
      </div>

      <Progress
        aria-label={`${item.personName}: ${percentage}% recebido em repasses`}
        indicatorClassName="bg-success"
        trackClassName="bg-warning/25"
        value={percentage}
      />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ChartLegendMarker className="text-success" />
            Recebido
          </span>
          <MoneyValue amount={balance.coveredAmount} className="mt-1 font-medium text-sm" />
        </div>
        <div className="min-w-0 text-right">
          <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
            <ChartLegendMarker className={isCredit ? "text-success" : "text-warning"} />
            {isCredit ? "Crédito" : "Falta receber"}
          </span>
          <MoneyValue
            amount={isCredit ? balance.creditAmount : balance.receivableAmount}
            className="mt-1 font-medium text-sm"
          />
        </div>
      </div>
    </li>
  );
}

function PersonSettlementsLoading() {
  return (
    <div aria-label="Carregando acertos por pessoas" className="grid gap-3 py-3" role="status">
      {skeletonKeys.map((key) => (
        <Skeleton className="h-32 w-full" key={key} />
      ))}
    </div>
  );
}
