import type { PersonSettlementSummaryItemOutput } from "@openmonetis/validators/person-settlements";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HandCoins, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { personSettlementsSummaryQueryOptions } from "../person-settlements.queries";

const maximumVisiblePeople = 4;
const skeletonKeys = ["first", "second", "third", "fourth"] as const;

export function PersonSettlementsWidget({ period }: { period: string }) {
  const query = useQuery(personSettlementsSummaryQueryOptions(period));
  const summary = query.data;
  const items = summary?.items ?? [];

  return (
    <DashboardWidget
      action={
        items.length ? (
          <Badge variant="secondary">
            {items.length} {items.length === 1 ? "pessoa" : "pessoas"}
          </Badge>
        ) : null
      }
      description="Valores a receber e créditos do mês"
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
            <div className="grid grid-cols-2 gap-2 py-3">
              <SettlementTotal label="A receber" value={summary.totalReceivableAmount} />
              <SettlementTotal label="Créditos" value={summary.totalCreditAmount} />
            </div>
            <PersonSettlementList items={items.slice(0, maximumVisiblePeople)} period={period} />
          </div>
        ) : (
          <DashboardWidgetEmptyState
            description="Não há valores a receber nem créditos neste mês."
            icon={<HandCoins aria-hidden="true" />}
            title="Tudo acertado"
          />
        )
      ) : null}
    </DashboardWidget>
  );
}

function SettlementTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <MoneyValue amount={value} className="mt-1 font-semibold text-sm" />
    </div>
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
        <li className="flex min-h-14 items-center gap-3 py-2" key={item.personId}>
          <Avatar className="size-9 overflow-hidden" showBorder={false}>
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
                className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                params={{ personId: item.personId }}
                search={{ period, view: "panel" }}
                to="/people/$personId"
              >
                <span className="truncate">{item.personName}</span>
                <DashboardItemLinkArrow />
              </Link>
              {item.personStatus === "inactive" ? (
                <span className="shrink-0 text-muted-foreground text-[0.65rem]">Inativa</span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {item.balance.status === "credit" ? "Crédito da pessoa" : "A receber"}
            </p>
          </div>
          <MoneyValue
            amount={
              item.balance.status === "credit"
                ? item.balance.creditAmount
                : item.balance.receivableAmount
            }
            className="shrink-0 font-medium text-sm"
          />
        </li>
      ))}
    </ol>
  );
}

function PersonSettlementsLoading() {
  return (
    <div aria-label="Carregando acertos por pessoas" className="grid gap-3 py-3" role="status">
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      {skeletonKeys.map((key) => (
        <Skeleton className="h-14 w-full" key={key} />
      ))}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("pt-BR");
}
