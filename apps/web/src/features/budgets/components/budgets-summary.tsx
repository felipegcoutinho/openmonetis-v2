import type { BudgetOverviewOutput } from "@openmonetis/validators/budgets";
import { CalendarClock, ReceiptText, TriangleAlert, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import {
  financialSummaryMetricClassName,
  financialSummaryMetricGridClassNames,
  financialSummarySoftClassName,
} from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { statLabelClassName, statValueClassName } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBudgetAttention, formatBudgetPercentage } from "../budgets.presentation";

/**
 * Answers the page's main question first (how much of the month's limits is used), then breaks
 * that amount down so the numbers add up: launched + expected = used; used + available − above
 * the limit = total of the limits. Uses the same soft surface as the category summary header.
 */
export function BudgetsSummary({ overview }: { overview: BudgetOverviewOutput }) {
  const hasExceeded = overview.exceededAmount > 0;
  const percentage = formatBudgetPercentage(overview.usagePercentage);
  const metrics = [
    {
      description: "Despesas já registradas",
      icon: <ReceiptText aria-hidden="true" />,
      label: "Lançado",
      value: <MoneyValue amount={overview.actualSpentAmount} />,
    },
    {
      description: "Recorrências que ainda vão cair",
      icon: <CalendarClock aria-hidden="true" />,
      label: "Previsto",
      value: <MoneyValue amount={overview.projectedAmount} />,
    },
    {
      description: "O que ainda cabe nos limites",
      icon: <Wallet aria-hidden="true" />,
      label: "Disponível",
      value: <MoneyValue amount={overview.availableAmount} />,
    },
    ...(hasExceeded
      ? [
          {
            description: "Soma do que passou em cada categoria",
            icon: <TriangleAlert aria-hidden="true" />,
            label: "Acima do limite",
            tone: "destructive" as const,
            value: <MoneyValue amount={overview.exceededAmount} />,
          },
        ]
      : []),
  ];

  return (
    <Card className={cn("relative gap-0 overflow-hidden py-0", financialSummarySoftClassName)}>
      <CardContent className="relative grid gap-6 p-6">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="grid gap-1">
              <h2 className="font-heading font-medium text-base text-current/85 leading-normal">
                Usado dos limites do mês
              </h2>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <MoneyValue
                  amount={overview.committedAmount}
                  className="kpi-value text-4xl sm:text-5xl"
                />
                <span className="text-base text-current/85">
                  de <MoneyValue amount={overview.allocatedAmount} />
                </span>
              </p>
            </div>
            <p
              className={cn(
                "flex items-center gap-1.5 font-medium text-sm tabular-nums",
                hasExceeded ? "text-destructive" : "text-current/85",
              )}
            >
              {hasExceeded ? <TriangleAlert aria-hidden="true" className="size-3.5" /> : null}
              {percentage}% usado
            </p>
          </div>
          <Progress
            aria-label={`${percentage}% dos limites do mês usado`}
            indicatorClassName={hasExceeded ? "bg-destructive" : "bg-brand"}
            trackClassName="bg-current/20"
            value={Math.min(overview.usagePercentage, 100)}
          />
        </div>

        <dl
          className={cn("grid gap-3", financialSummaryMetricGridClassNames[metrics.length] ?? "")}
        >
          {metrics.map((metric) => (
            <SummaryMetric key={metric.label} {...metric} />
          ))}
        </dl>

        {overview.warningCount > 0 ? (
          <p className="-mt-2 flex items-center gap-2 text-current/85 text-sm">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {formatBudgetAttention(overview.warningCount)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  description,
  icon,
  label,
  tone,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  tone?: "destructive";
  value: ReactNode;
}) {
  return (
    <div className={financialSummaryMetricClassName}>
      <dt className={statLabelClassName}>
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </dt>
      <dd
        className={cn(statValueClassName, "truncate", tone === "destructive" && "text-destructive")}
      >
        {value}
      </dd>
      <dd className="text-current/85 text-xs leading-relaxed">{description}</dd>
    </div>
  );
}
