import type { BudgetOverviewOutput } from "@openmonetis/validators/budgets";
import { CircleDollarSign, ReceiptText, Target, TriangleAlert } from "lucide-react";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";

export function BudgetsSummary({ overview }: { overview: BudgetOverviewOutput }) {
  return (
    <FinancialSummaryHeader
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <Target aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[
        {
          description: (
            <>
              {" "}
              <MoneyValue amount={overview.actualSpentAmount} /> lançados +{" "}
              <MoneyValue amount={overview.projectedAmount} /> em recorrências previstas
            </>
          ),
          icon: <ReceiptText aria-hidden="true" className="size-3.5" />,
          label: "Consumo dos limites",
          value: <MoneyValue amount={overview.committedAmount} />,
        },
        {
          description: "Soma das sobras nas categorias acompanhadas.",
          icon: <CircleDollarSign aria-hidden="true" className="size-3.5" />,
          label: "Restante nos limites",
          value: <MoneyValue amount={overview.availableAmount} />,
        },
        ...(overview.exceededAmount > 0
          ? [
              {
                description: "Excessos nas categorias que ultrapassaram o limite.",
                icon: <TriangleAlert aria-hidden="true" className="size-3.5" />,
                label: "Acima dos limites",
                value: <MoneyValue amount={overview.exceededAmount} className="text-destructive" />,
              },
            ]
          : []),
      ]}
      primaryLabel="Total dos limites"
      primaryValue={<MoneyValue amount={overview.allocatedAmount} />}
      subtitle="Limites e consumo das categorias acompanhadas."
      title="Orçamentos do mês"
      variant="soft"
    />
  );
}
