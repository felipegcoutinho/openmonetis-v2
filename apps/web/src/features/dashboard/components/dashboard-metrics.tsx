import type { DashboardMetricsOutput } from "@openmonetis/validators/dashboard";
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
import { cn } from "@/lib/utils";
import {
  formatProjectedMetricHelp,
  getMetricComparison,
  type MetricTrend,
} from "../dashboard.presentation";
import { useAdminPersonSlug } from "../useAdminPersonSlug";

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
    help: "Soma das receitas atribuídas a você em contas consideradas no saldo.",
    icon: ArrowDownLeft,
    iconClassName: "text-success",
    invertTrend: false,
    transactionType: "income",
  },
  {
    key: "expenses",
    label: "Suas despesas",
    description: "Sua parte nas despesas do mês",
    help: "Soma das despesas atribuídas a você em contas consideradas no saldo.",
    icon: ArrowUpRight,
    iconClassName: "text-destructive",
    invertTrend: true,
    transactionType: "expense",
  },
  {
    key: "balance",
    label: "Resultado do mês",
    description: "Suas receitas menos suas despesas",
    help: "Receitas menos despesas atribuídas a você no mês selecionado.",
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
  const primarySlug = useAdminPersonSlug();
  const projectedComparison = getMetricComparison(
    metrics.projected.current,
    metrics.projected.previous,
  );
  return (
    <section aria-labelledby="dashboard-metrics-title">
      <h2 className="sr-only" id="dashboard-metrics-title">
        Principais métricas financeiras
      </h2>
      <Card className="relative gap-0 overflow-hidden border py-0 shadow-none md:hidden">
        <div className="grid gap-5 bg-brand/8 py-5">
          <CardHeader className="gap-1 px-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              Saldo previsto
              <Tooltip>
                <TooltipTrigger
                  aria-label="Como calculamos o saldo previsto"
                  className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CircleHelp aria-hidden="true" className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{formatProjectedMetricHelp(metrics.period)}</TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription className="text-xs">Previsão para o fim do mês</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <div className="grid gap-3">
              <MoneyValue
                amount={metrics.projected.current}
                className="font-semibold text-3xl leading-none tracking-tight"
              />
              <MetricComparison
                subtle
                hasPreviousData={metrics.projected.hasPreviousData}
                invertTrend={false}
                previous={metrics.projected.previous}
                trend={projectedComparison.trend}
                trendLabel={projectedComparison.label}
              />
            </div>
          </CardContent>
        </div>
        <CardContent className="border-t bg-card px-5 py-4">
          <div className="grid gap-1">
            <MobileMetric
              amount={metrics.income.current}
              href={
                primarySlug
                  ? { people: primarySlug, period: metrics.period, type: "income" as const }
                  : null
              }
              label="Receitas"
              valueClassName="text-success"
            />
            <MobileMetric
              amount={metrics.expenses.current}
              href={
                primarySlug
                  ? { people: primarySlug, period: metrics.period, type: "expense" as const }
                  : null
              }
              label="Despesas"
              valueClassName="text-destructive"
            />
            <MobileMetric amount={metrics.balance.current} label="Resultado" />
          </div>
        </CardContent>
      </Card>

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
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
                      className="group/metric-link rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      search={{
                        period: metrics.period,
                        type: card.transactionType,
                        people: primarySlug,
                      }}
                      to="/transactions"
                    >
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 ease-out group-hover/metric-link:translate-x-1 group-focus-visible/metric-link:translate-x-1 motion-reduce:transition-none"
                      />
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

function MobileMetric({
  amount,
  href,
  label,
  valueClassName,
}: {
  amount: number;
  href?: { people: string; period: string; type: "expense" | "income" } | null;
  label: string;
  valueClassName?: string;
}) {
  const content = (
    <>
      <span className="text-muted-foreground text-xs">{label}</span>
      <MoneyValue amount={amount} className={cn("shrink-0 font-medium text-sm", valueClassName)} />
    </>
  );

  return href ? (
    <Link
      aria-label={`Ver lançamentos de ${label.toLocaleLowerCase("pt-BR")}`}
      className="flex min-h-8 min-w-0 items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      search={href}
      to="/transactions"
    >
      {content}
    </Link>
  ) : (
    <div className="flex min-h-8 min-w-0 items-center justify-between gap-3">{content}</div>
  );
}

function MetricComparison({
  subtle = false,
  hasPreviousData,
  invertTrend,
  previous,
  trend,
  trendLabel,
}: {
  subtle?: boolean;
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
      <div className="flex min-h-5 items-center text-muted-foreground text-xs">
        Sem dados do mês anterior
      </div>
    );
  }

  return (
    <div className="flex min-h-5 flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      <span>{subtle ? "Mês anterior ·" : "Mês anterior:"}</span>
      <MoneyValue amount={previous} className="text-xs" />
      {trendLabel ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular-nums",
            !subtle && "rounded-full bg-muted px-2 py-0.5 font-medium",
            !subtle && isPositive && "text-success",
            !subtle && isNegative && "text-destructive",
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
    <div aria-label="Carregando métricas" role="status">
      <Card className="gap-0 border py-0 shadow-none md:hidden">
        <div className="grid gap-5 bg-brand/8 py-5">
          <CardHeader className="gap-1 px-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="grid gap-3 px-5">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-5 w-44" />
          </CardContent>
        </div>
        <CardContent className="grid gap-1 border-t bg-card px-5 py-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
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
      </div>
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
