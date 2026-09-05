import type { DashboardMetricsOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleHelp,
  type LucideIcon,
  Minus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { buildFilterSlugMap } from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import {
  formatProjectedMetricHelp,
  getMetricComparison,
  type MetricTrend,
} from "../dashboard.presentation";

type MetricKey = "balance" | "expenses" | "income" | "projected";

const cards: Array<{
  description: string;
  help: string;
  icon: LucideIcon;
  iconClassName: string;
  invertTrend: boolean;
  key: MetricKey;
  label: string;
  transactionType?: "expense" | "income";
}> = [
  {
    key: "income",
    label: "Suas receitas",
    description: "Sua parte nas entradas do mês",
    help: "Soma das receitas atribuídas à pessoa principal em contas consideradas no saldo.",
    icon: ArrowDownLeft,
    iconClassName: "text-success",
    invertTrend: false,
    transactionType: "income",
  },
  {
    key: "expenses",
    label: "Suas despesas",
    description: "Sua parte nas despesas do mês",
    help: "Soma das despesas atribuídas à pessoa principal em contas consideradas no saldo.",
    icon: ArrowUpRight,
    iconClassName: "text-destructive",
    invertTrend: true,
    transactionType: "expense",
  },
  {
    key: "balance",
    label: "Resultado do mês",
    description: "Suas receitas menos suas despesas",
    help: "Receitas menos despesas atribuídas à pessoa principal no período de competência.",
    icon: Scale,
    iconClassName: "text-warning",
    invertTrend: false,
  },
  {
    key: "projected",
    label: "Saldo previsto",
    description: "Previsão para o fim do mês",
    help: "",
    icon: CalendarClock,
    iconClassName: "text-info",
    invertTrend: false,
  },
];

export function DashboardMetrics({ metrics }: { metrics: DashboardMetricsOutput }) {
  const peopleQuery = useQuery(peopleQueryOptions());
  const people = peopleQuery.data ?? [];
  const primaryPerson = people.find((person) => person.role === "admin");
  const primarySlug = primaryPerson
    ? buildFilterSlugMap(people).idToSlug.get(primaryPerson.id)
    : undefined;
  return (
    <section aria-labelledby="dashboard-metrics-title">
      <h2 className="sr-only" id="dashboard-metrics-title">
        Principais métricas financeiras
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const metric = metrics[card.key];
          const comparison = getMetricComparison(metric.current, metric.previous);
          const help =
            card.key === "projected" ? formatProjectedMetricHelp(metrics.period) : card.help;

          return (
            <Card className="gap-4 border py-5" key={card.key}>
              <CardHeader className="gap-1 px-5">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <card.icon aria-hidden="true" className={cn("size-4", card.iconClassName)} />
                    {card.label}
                    <Tooltip>
                      <TooltipTrigger
                        aria-label={`Como calculamos ${card.label.toLocaleLowerCase("pt-BR")}`}
                        className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <CircleHelp aria-hidden="true" className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>{help}</TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  {card.transactionType && primarySlug ? (
                    <Link
                      aria-label={`Ver lançamentos de ${card.label.toLocaleLowerCase("pt-BR")}`}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      search={{
                        period: metrics.period,
                        type: card.transactionType,
                        people: primarySlug,
                      }}
                      to="/transactions"
                    >
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  ) : null}
                </div>
                <CardDescription className="text-xs">{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 px-5">
                <MoneyValue amount={metric.current} className="font-medium text-2xl leading-none" />
                <MetricComparison
                  hasPreviousData={metric.hasPreviousData}
                  invertTrend={card.invertTrend}
                  previous={metric.previous}
                  trend={comparison.trend}
                  trendLabel={comparison.label}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function MetricComparison({
  hasPreviousData,
  invertTrend,
  previous,
  trend,
  trendLabel,
}: {
  hasPreviousData: boolean;
  invertTrend: boolean;
  previous: number;
  trend: MetricTrend;
  trendLabel: string | null;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const isPositive = invertTrend ? trend === "down" : trend === "up";
  const isNegative = invertTrend ? trend === "up" : trend === "down";

  if (!hasPreviousData) {
    return (
      <div className="flex min-h-5 items-center text-muted-foreground text-xs">Sem histórico</div>
    );
  }

  return (
    <div className="flex min-h-5 flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      <span>Mês anterior:</span>
      <MoneyValue amount={previous} className="font-sans text-xs" />
      {trendLabel ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium tabular-nums",
            isPositive && "text-success",
            isNegative && "text-destructive",
          )}
        >
          <TrendIcon aria-hidden="true" className="size-3" />
          {trendLabel}
        </span>
      ) : null}
    </div>
  );
}

export function DashboardMetricsSkeleton() {
  return (
    <div
      aria-label="Carregando métricas"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
    >
      {cards.map((card) => (
        <Card className="gap-5 border py-5" key={card.key}>
          <CardHeader className="px-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </CardHeader>
          <CardContent className="grid gap-3 px-5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-44" />
          </CardContent>
        </Card>
      ))}
      <span className="sr-only">Carregando métricas financeiras…</span>
    </div>
  );
}

export function DashboardMetricsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="grid min-h-48 place-items-center border p-6 text-center">
      <div>
        <p className="font-medium">Não foi possível carregar as métricas</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Verifique sua conexão e tente novamente.
        </p>
        <Button className="mt-4" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    </Card>
  );
}
