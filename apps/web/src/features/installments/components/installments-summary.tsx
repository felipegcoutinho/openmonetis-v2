import type { InstallmentsReportOutput } from "@openmonetis/validators/installments";
import { CalendarDays, Layers3, ShoppingBag } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Card } from "@/components/ui/card";
import { formatInstallmentPeriod } from "../installments.presentation";

type InstallmentsSummaryProps = {
  report: InstallmentsReportOutput;
};

export function InstallmentsSummary({ report }: InstallmentsSummaryProps) {
  const { summary } = report;

  return (
    <section
      aria-label="Resumo das despesas parceladas"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3"
    >
      <Card className="col-span-2 gap-0 border-brand/25 bg-brand/10 p-4 shadow-none sm:p-6 lg:col-span-1">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-strong">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-muted-foreground text-sm">Total em aberto</h2>
            <MoneyValue
              amount={summary.totalPendingAmount}
              className="mt-2 text-3xl leading-none sm:text-4xl"
            />
            <p className="mt-3 text-muted-foreground text-xs">
              Soma das parcelas registradas que ainda não foram pagas.
            </p>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-4 shadow-none sm:p-6">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
          <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground sm:grid">
            <CalendarDays aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-muted-foreground text-xs sm:text-sm">Pendentes neste mês</h2>
            <MoneyValue
              amount={summary.dueInPeriodAmount}
              className="mt-2 text-xl leading-none sm:text-4xl"
            />
            <p className="mt-3 hidden text-muted-foreground text-xs sm:block">
              Parcelas em aberto de {formatInstallmentPeriod(report.referencePeriod)}.
            </p>
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-4 shadow-none sm:p-6">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
          <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground sm:grid">
            <ShoppingBag aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-muted-foreground text-xs sm:text-sm">Compras em andamento</h2>
            <p className="mt-2 font-heading text-xl leading-none tabular-nums sm:text-4xl">
              {summary.openSeriesCount}
            </p>
            <p className="mt-3 hidden text-muted-foreground text-xs sm:block">
              Compras com parcelas pendentes ou faltantes.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
