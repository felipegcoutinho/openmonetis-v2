import type { DashboardPeopleExpensesOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/name-presentation";
import { formatDashboardTransactionCount } from "../dashboard.presentation";
import { dashboardPeopleExpensesQueryOptions } from "../dashboard.queries";
import { DashboardItemLinkArrow } from "./dashboard-item-link-arrow";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "./dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "./dashboard-widget-row";

type PersonExpense = DashboardPeopleExpensesOutput["items"][number];

const maximumVisiblePeople = 4;
const peopleSkeletonKeys = ["first", "second", "third", "fourth"] as const;

export function PeopleWidget({ period }: { period: string }) {
  const [isListOpen, setIsListOpen] = useState(false);
  const query = useQuery(dashboardPeopleExpensesQueryOptions(period));
  const people = query.data?.items ?? [];
  const visiblePeople = people.slice(0, maximumVisiblePeople);
  const hiddenCount = Math.max(0, people.length - visiblePeople.length);

  return (
    <DashboardWidget
      description="Participação nas despesas do mês"
      footer={
        people.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            {hiddenCount > 0 ? (
              <DashboardWidgetListSheet
                description="Veja a participação de cada pessoa nas despesas do período."
                onOpenChange={setIsListOpen}
                open={isListOpen}
                title="Despesas por pessoa"
                triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "pessoa" : "pessoas"}`}
              >
                <PeopleList people={people} />
              </DashboardWidgetListSheet>
            ) : (
              <span />
            )}
            <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/people">
              Ver pessoas <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<Users aria-hidden="true" />}
      title="Pessoas"
    >
      {query.isLoading ? <PeopleLoading /> : null}
      {query.isError ? <PeopleError onRetry={() => void query.refetch()} /> : null}
      {query.data && !query.isError ? (
        people.length ? (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <PeopleList people={visiblePeople} />
          </div>
        ) : (
          <PeopleEmpty />
        )
      ) : null}
    </DashboardWidget>
  );
}

function PeopleList({ people }: { people: PersonExpense[] }) {
  return (
    <ol className="divide-y">
      {people.map((person) => (
        <DashboardWidgetRow key={person.personId} structure="progress">
          <Avatar className="size-9 overflow-hidden">
            {person.personAvatarUrl ? (
              <AvatarImage
                alt={`Avatar de ${person.personName}`}
                className="scale-[1.06]"
                src={person.personAvatarUrl}
              />
            ) : null}
            <AvatarFallback>{getInitials(person.personName)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                    params={{ personId: person.personId }}
                    to="/people/$personId"
                  >
                    <span className="truncate">{person.personName}</span>
                    <DashboardItemLinkArrow />
                  </Link>
                  {person.personRole === "admin" ? <CurrentUserBadge /> : null}
                  {person.personStatus === "inactive" ? (
                    <span className="shrink-0 text-muted-foreground text-[0.65rem]">Inativa</span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-muted-foreground text-xs">
                  {formatDashboardTransactionCount(person.count)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <MoneyValue amount={person.amount} className="font-medium text-sm" />
                <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
                  {formatPercentage(person.percentage)}%
                </p>
              </div>
            </div>
            <Progress
              aria-label={`${person.personName}: ${formatPercentage(person.percentage)}% das despesas`}
              indicatorClassName="bg-brand/70"
              trackClassName="h-1"
              value={person.percentage}
            />
          </div>
        </DashboardWidgetRow>
      ))}
    </ol>
  );
}

function PeopleLoading() {
  return (
    <div aria-label="Carregando despesas por pessoa" className="grid gap-3" role="status">
      {peopleSkeletonKeys.map((key) => (
        <Skeleton className="h-20 w-full" key={key} />
      ))}
    </div>
  );
}

function PeopleError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar as pessoas</p>
        <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function PeopleEmpty() {
  return (
    <DashboardWidgetEmptyState
      description="As despesas por pessoa aparecerão aqui."
      icon={<Users aria-hidden="true" />}
      title="Nenhuma despesa por pessoa"
    />
  );
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}
