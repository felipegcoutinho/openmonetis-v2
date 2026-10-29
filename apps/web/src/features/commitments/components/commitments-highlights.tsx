import type { CommitmentsOutput } from "@openmonetis/validators/commitments";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import {
  commitmentGaugeBands,
  commitmentStatusClassName,
  commitmentStatusLabel,
  commitmentStatusVariant,
  describeCommitmentGauge,
  formatCommitmentPercentage,
  formatCommitmentPeriod,
  getCommitmentGaugePosition,
} from "../commitments.presentation";

export function CommitmentsHighlights({ report }: { report: CommitmentsOutput }) {
  const current = report.months[0];
  if (!current) return null;
  return (
    <>
      <section aria-label="Resumo do mês" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="min-w-0 gap-1 px-5 py-4">
          <p className="text-muted-foreground text-xs">
            Comprometido em {formatCommitmentPeriod(current.period)}
          </p>
          <MoneyValue
            amount={current.committedAmount}
            className="font-medium text-xl leading-tight"
          />
        </Card>
        <Card className="min-w-0 gap-1 px-5 py-4">
          <p className="text-muted-foreground text-xs">Receita prevista</p>
          <MoneyValue amount={current.incomeAmount} className="font-medium text-xl leading-tight" />
        </Card>
        <Card className="min-w-0 gap-1 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">Índice de comprometimento</p>
            <Badge
              className={commitmentStatusClassName(current.status)}
              variant={commitmentStatusVariant(current.status)}
            >
              {commitmentStatusLabel(current.status)}
            </Badge>
          </div>
          <span className="font-medium font-mono text-xl leading-tight tabular-nums tracking-tighter">
            {formatCommitmentPercentage(current.commitmentPercentage)}
          </span>
          <CommitmentGauge percentage={current.commitmentPercentage} status={current.status} />
        </Card>
        <Card className="min-w-0 gap-1 px-5 py-4">
          <p className="text-muted-foreground text-xs">Folga estimada</p>
          <MoneyValue
            amount={current.freeAmount}
            className={cn(
              "font-medium text-xl leading-tight",
              current.freeAmount < 0 && "text-destructive",
            )}
          />
        </Card>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-2 p-5 shadow-none">
          <h2 className="font-heading font-medium text-lg">Próximo alívio</h2>
          {report.relief ? (
            <p className="text-muted-foreground text-sm">
              Em {formatCommitmentPeriod(report.relief.period)} os compromissos caem{" "}
              <MoneyValue
                amount={report.relief.releasedAmount}
                className="font-medium text-foreground"
              />{" "}
              ({formatCommitmentPercentage(report.relief.percentage)}) em relação a{" "}
              {formatCommitmentPeriod(report.relief.previousPeriod)}.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma queda relevante de compromissos no período analisado.
            </p>
          )}
        </Card>
        <Card className="gap-2 p-5 shadow-none">
          <h2 className="font-heading font-medium text-lg">Parcelamentos que terminam</h2>
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
                        · termina em {formatCommitmentPeriod(series.endPeriod)}
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

const gaugeBandClassNames = {
  healthy: "bg-success/35",
  attention: "bg-warning/40",
  critical: "bg-destructive/40",
} as const;

function CommitmentGauge({
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
      {commitmentGaugeBands.map((band) => (
        <span
          className={cn(
            "h-full first:rounded-l-full last:rounded-r-full",
            gaugeBandClassNames[band.status],
          )}
          key={band.status}
          style={{ width: `${band.to - band.from}%` }}
        />
      ))}
      {position !== null ? (
        <span
          aria-hidden="true"
          className="-translate-x-1/2 absolute -top-1 h-4 w-1 rounded-full bg-foreground"
          style={{ left: `${position}%` }}
        />
      ) : null}
    </div>
  );
}
