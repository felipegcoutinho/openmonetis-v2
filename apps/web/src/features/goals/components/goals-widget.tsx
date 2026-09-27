import type { GoalOutput } from "@openmonetis/validators/goals";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Goal, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { cn } from "@/lib/utils";
import { goalPaceLabels } from "../goals.presentation";
import { goalsQueryOptions } from "../goals.queries";
import { GoalAccountLogo } from "./goal-account-logo";

const maximumVisibleGoals = 4;

export function GoalsWidget() {
  const query = useQuery(goalsQueryOptions());
  const activeGoals = (query.data ?? [])
    .filter((goal) => goal.status === "active")
    .sort(
      (left, right) =>
        (left.targetDate ?? "9999-12-31").localeCompare(right.targetDate ?? "9999-12-31") ||
        left.name.localeCompare(right.name, "pt-BR"),
    );
  const hiddenCount = Math.max(0, activeGoals.length - maximumVisibleGoals);

  return (
    <DashboardWidget
      description="Acompanhamento atual dos objetivos"
      footer={
        <div className="flex items-center justify-between gap-3">
          {hiddenCount > 0 ? (
            <span className="text-muted-foreground text-xs">
              +{hiddenCount} {hiddenCount === 1 ? "meta" : "metas"}
            </span>
          ) : (
            <span />
          )}
          <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/goals">
            {activeGoals.length ? "Ver metas" : "Criar meta"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      }
      icon={<Goal aria-hidden="true" />}
      title="Progresso das metas"
    >
      {query.isLoading ? <GoalsWidgetLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar as metas</p>
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
      {query.data && !query.isError ? (
        activeGoals.length === 0 ? (
          <DashboardWidgetEmptyState
            description="Crie uma meta para acompanhar seu progresso aqui."
            icon={<Goal aria-hidden="true" />}
            title="Nenhuma meta ativa"
          />
        ) : (
          <ul className="divide-y">
            {activeGoals.slice(0, maximumVisibleGoals).map((goal) => (
              <GoalProgressRow goal={goal} key={goal.id} />
            ))}
          </ul>
        )
      ) : null}
    </DashboardWidget>
  );
}

function GoalProgressRow({ goal }: { goal: GoalOutput }) {
  const warning = goal.paceStatus === "behind" || goal.paceStatus === "overdue";
  const percentage = goal.progressPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <DashboardWidgetRow structure="progress">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-strong">
        <Goal aria-hidden="true" className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{goal.name}</p>
            <p className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
              {goal.trackingType === "account" && goal.accountName ? (
                <GoalAccountLogo logo={goal.accountLogo} name={goal.accountName} size={18} />
              ) : null}
              <span className="truncate">
                <MoneyValue amount={goal.currentAmount} className="text-xs" /> de{" "}
                <MoneyValue amount={goal.targetAmount} className="text-xs" />
              </span>
            </p>
          </div>
          <span className="grid shrink-0 justify-items-end gap-0.5">
            <span
              className={cn(
                "font-medium text-xs tabular-nums",
                warning ? "text-warning" : "text-brand-strong",
              )}
            >
              {percentage}%
            </span>
            {goal.paceStatus ? (
              <span className={cn("text-xs", warning ? "text-warning" : "text-muted-foreground")}>
                {goalPaceLabels[goal.paceStatus]}
              </span>
            ) : null}
          </span>
        </div>
        <Progress
          aria-label={`${percentage}% da meta ${goal.name} alcançada`}
          indicatorClassName={warning ? "bg-warning" : "bg-brand"}
          trackClassName={cn("h-1", warning && "bg-warning/20")}
          value={Math.min(goal.progressPercentage, 100)}
        />
      </div>
    </DashboardWidgetRow>
  );
}

function GoalsWidgetLoading() {
  return (
    <div aria-label="Carregando progresso das metas" className="grid gap-4" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <div className="grid gap-2" key={key}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <div className="ml-12">
            <Skeleton className="h-1 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
