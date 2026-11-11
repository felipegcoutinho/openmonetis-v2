import type { InstallmentsReportOutput } from "@openmonetis/validators/installments";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  ShoppingBag,
} from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { formatPeriod } from "@/lib/period-presentation";

type InstallmentsSummaryProps = {
  report: InstallmentsReportOutput;
};

export function InstallmentsSummary({ report }: InstallmentsSummaryProps) {
  const { summary } = report;
  const missing = summary.missingInstallmentCount;
  const notices = [
    summary.overdueAmount > 0 ? (
      <Notice key="overdue">
        <MoneyValue amount={summary.overdueAmount} className="font-medium" /> do saldo são parcelas
        de meses anteriores que ainda não foram pagas.
      </Notice>
    ) : null,
    missing > 0 ? (
      <Notice key="missing">
        {missing === 1
          ? "Falta 1 parcela no cronograma de uma compra, então o saldo pode estar menor. Revise a compra marcada na lista."
          : `Faltam ${missing} parcelas no cronograma de algumas compras, então o saldo pode estar menor. Revise as compras marcadas na lista.`}
      </Notice>
    ) : null,
  ].filter(Boolean);

  return (
    <section aria-label="Resumo das despesas parceladas" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CircleDollarSign />}
          label="Saldo a pagar"
          value={<MoneyValue amount={summary.totalPendingAmount} />}
        />
        <StatCard
          icon={<CalendarClock />}
          label={`A pagar em ${formatPeriod(report.referencePeriod)}`}
          value={<MoneyValue amount={summary.dueInPeriodAmount} />}
        />
        <StatCard
          icon={<ShoppingBag />}
          label="Compras em andamento"
          value={summary.openSeriesCount}
        />
        <StatCard
          icon={<CalendarCheck />}
          label="Última parcela"
          value={
            summary.lastInstallmentPeriod
              ? formatPeriod(summary.lastInstallmentPeriod)
              : "Nenhuma pendente"
          }
        />
      </div>
      {notices.length > 0 ? <Card className="gap-2 px-5 py-3">{notices}</Card> : null}
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-pretty text-sm">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  );
}
