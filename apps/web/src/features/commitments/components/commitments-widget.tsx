import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Gauge, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { cn } from "@/lib/utils";
import {
  commitmentStatusLabel,
  commitmentStatusTextClassName,
  formatCommitmentPercentage,
  formatCommitmentPercentagePointChange,
} from "../commitments.presentation";
import { commitmentsQueryOptions } from "../commitments.queries";
import { CommitmentGauge } from "./commitment-gauge";
import { CommitmentsWidgetHelp } from "./commitments-widget-help";

/** Share of the month's expected income already committed, with the previous month for context. */
export function CommitmentsWidget({ period }: { period: string }) {
  const query = useQuery(
    commitmentsQueryOptions({ startPeriod: addMonthsToPeriod(period, -1), endPeriod: period }),
  );
  const [previous, current] = query.data?.months ?? [];
  const isEmpty = current ? current.committedAmount === 0 && current.incomeAmount === 0 : false;

  return (
    <DashboardWidget
      action={<CommitmentsWidgetHelp />}
      description="Quanto da receita do mês já está comprometido"
      footer={
        current && !isEmpty ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ period: undefined, startPeriod: period, endPeriod: undefined }}
            to="/reports/commitments"
          >
            Ver compromissos <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<Gauge aria-hidden="true" />}
      title="Comprometimento do mês"
    >
      {query.isLoading ? (
        <div
          aria-label="Carregando comprometimento"
          className="grid flex-1 place-items-center gap-4"
          role="status"
        >
          <Skeleton className="h-32 w-64 rounded-t-full" />
          <Skeleton className="h-6 w-40" />
        </div>
      ) : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar o comprometimento</p>
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
      {current && !query.isError ? (
        isEmpty ? (
          <DashboardWidgetEmptyState
            description="Lance receitas e despesas do mês para acompanhar o comprometimento."
            icon={<Gauge aria-hidden="true" />}
            title="Nenhuma movimentação no mês"
          />
        ) : (
          <div
            aria-busy={query.isFetching}
            className="flex flex-1 flex-col items-center justify-center gap-4 py-2 text-center"
          >
            <CommitmentGauge percentage={current.commitmentPercentage} status={current.status} />
            <div className="grid justify-items-center gap-1">
              <span className="kpi-value text-4xl leading-none">
                {formatCommitmentPercentage(current.commitmentPercentage)}
              </span>
              <p className="text-muted-foreground text-xs">
                <span className={cn("font-medium", commitmentStatusTextClassName(current.status))}>
                  {current.commitmentPercentage === null
                    ? "Sem receita prevista"
                    : commitmentStatusLabel(current.status)}
                </span>
                {previous
                  ? ` · ${
                      formatCommitmentPercentagePointChange(
                        current.commitmentPercentage,
                        previous.commitmentPercentage,
                      ) ?? "sem comparação"
                    }`
                  : null}
              </p>
            </div>
            <dl className="grid w-full grid-cols-3 border-t pt-3 text-left">
              {[
                { label: "Comprometido", amount: current.committedAmount },
                { label: "Receita", amount: current.incomeAmount },
                { label: "Folga", amount: current.freeAmount },
              ].map((item) => (
                <div className="grid min-w-0 justify-items-center gap-0.5" key={item.label}>
                  <dt className="text-muted-foreground text-xs">{item.label}</dt>
                  <dd className="min-w-0 truncate">
                    <MoneyValue
                      amount={item.amount}
                      className={cn("text-sm", item.amount < 0 && "text-destructive")}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}
