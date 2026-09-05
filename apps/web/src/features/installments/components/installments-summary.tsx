import type { InstallmentsReportOutput } from "@openmonetis/validators/installments";
import { CircleCheckBig, Layers3, WalletCards } from "lucide-react";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";

type InstallmentsSummaryProps = {
  report: InstallmentsReportOutput;
};

export function InstallmentsSummary({ report }: InstallmentsSummaryProps) {
  const { summary } = report;

  return (
    <FinancialSummaryHeader
      eyebrow="Relatório"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <WalletCards aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[
        {
          icon: <Layers3 aria-hidden="true" className="size-3.5" />,
          label: "Compras em andamento",
          value: <span className="font-mono tabular-nums">{summary.openSeriesCount}</span>,
          description: "Compras com parcelas pendentes ou faltantes.",
        },
        {
          icon: <CircleCheckBig aria-hidden="true" className="size-3.5" />,
          label: "Parcelas pagas",
          value: (
            <span className="font-mono tabular-nums text-success">
              {summary.paidInstallmentCount}/{summary.trackedInstallmentCount}
            </span>
          ),
          description: "Pagas entre todas as parcelas acompanhadas.",
        },
      ]}
      primaryLabel="Total em aberto"
      primaryValue={<MoneyValue amount={summary.totalPendingAmount} />}
      subtitle="Soma somente das parcelas que ainda não foram pagas"
      title="Despesas parceladas"
      variant="soft"
    />
  );
}
