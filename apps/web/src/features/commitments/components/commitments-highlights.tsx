import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import { CalendarCheck, Gauge, Lock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  commitmentGaugeBands,
  commitmentStatusClassName,
  commitmentStatusLabel,
  commitmentStatusVariant,
  describeCommitmentGauge,
  formatCommitmentPercentage,
  getCommitmentGaugePosition,
} from "../commitments.presentation";

export function CommitmentsHighlights({ report }: { report: CommitmentsOutput }) {
  const current = report.months[0];
  if (!current) return null;
  return (
    <>
      <section aria-label="Resumo do mês" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description={`Em ${formatPeriod(current.period)}`}
          icon={<Lock />}
          label="Comprometido"
          value={<MoneyValue amount={current.committedAmount} />}
        />
        <StatCard
          icon={<TrendingUp />}
          label="Receita prevista"
          value={<MoneyValue amount={current.incomeAmount} />}
        />
        <StatCard
          icon={<Gauge />}
          label="Comprometimento"
          value={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{formatCommitmentPercentage(current.commitmentPercentage)}</span>
              <Badge
                className={commitmentStatusClassName(current.status)}
                variant={commitmentStatusVariant(current.status)}
              >
                {commitmentStatusLabel(current.status)}
              </Badge>
            </div>
          }
        >
          <CommitmentBandBar percentage={current.commitmentPercentage} status={current.status} />
        </StatCard>
        <StatCard
          icon={<Wallet />}
          label="Folga estimada"
          value={<MoneyValue amount={current.freeAmount} />}
          valueClassName={cn(current.freeAmount < 0 && "text-destructive")}
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-2 p-5 shadow-none">
          <h2 className="flex items-center gap-2 font-heading font-medium text-base leading-normal">
            <TrendingDown aria-hidden="true" className="size-4 shrink-0" />
            Próximo alívio
          </h2>
          {report.relief ? (
            <p className="text-muted-foreground text-sm">
              Em {formatPeriod(report.relief.period)} os compromissos caem{" "}
              <MoneyValue
                amount={report.relief.releasedAmount}
                className="font-medium text-foreground"
              />{" "}
              ({formatCommitmentPercentage(report.relief.percentage)}) em relação a{" "}
              {formatPeriod(report.relief.previousPeriod)}.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma queda relevante de compromissos no período analisado.
            </p>
          )}
        </Card>
        <Card className="gap-2 p-5 shadow-none">
          <h2 className="flex items-center gap-2 font-heading font-medium text-base leading-normal">
            <CalendarCheck aria-hidden="true" className="size-4 shrink-0" />
            Parcelamentos que terminam
          </h2>
          {report.endingSeries.length ? (
            <ul className="grid gap-2 text-sm">
              {report.endingSeries.map((series) => (
                <li className="flex items-center justify-between gap-3" key={series.seriesId}>
                  <span className="flex min-w-0 items-center gap-2">
                    <EstablishmentLogo
                      categoryIcon={null}
                      className="opacity-90"
                      editable={false}
                      name={series.name}
                      size={20}
                    />
                    <span className="min-w-0 truncate">
                      {series.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · termina em {formatPeriod(series.endPeriod)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    libera{" "}
                    <MoneyValue
                      amount={series.monthlyAmount}
                      className="font-medium text-foreground"
                    />
                    /mês
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum parcelamento termina no período analisado.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

const gaugeBandAnimationStepMs = 120;

const gaugeBandClassNames = {
  healthy: "bg-success/35",
  attention: "bg-warning/40",
  critical: "bg-destructive/40",
} as const;

function CommitmentBandBar({
  percentage,
  status,
}: {
  percentage: number | null;
  status: CommitmentsOutput["months"][number]["status"];
}) {
  const position = getCommitmentGaugePosition(percentage);
  return (
    <div
      aria-label={describeCommitmentGauge(percentage, status)}
      className="relative mt-2 flex h-2 w-full overflow-visible rounded-full"
      role="img"
    >
      {commitmentGaugeBands.map((band, index) => (
        <span
          className={cn(
            "h-full origin-left animate-[progress-fill_0.5s_cubic-bezier(0.22,1,0.36,1)_both] first:rounded-l-full last:rounded-r-full motion-reduce:animate-none",
            gaugeBandClassNames[band.status],
          )}
          key={band.status}
          style={{
            width: `${band.to - band.from}%`,
            animationDelay: `${index * gaugeBandAnimationStepMs}ms`,
          }}
        />
      ))}
      {position !== null ? (
        <span
          aria-hidden="true"
          className="-translate-x-1/2 absolute -top-1 h-4 w-1 animate-[gauge-marker-in_0.6s_var(--ease-out-strong)_0.15s_both] rounded-full bg-foreground motion-reduce:animate-none"
          style={{ left: `${position}%` }}
        />
      ) : null}
    </div>
  );
}
