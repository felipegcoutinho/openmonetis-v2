import type { BudgetOverviewOutput } from "@openmonetis/validators/budgets";
import { CircleDollarSign, PiggyBank, ReceiptText, WalletCards } from "lucide-react";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";

export function BudgetsSummary({ overview }: { overview: BudgetOverviewOutput }) {
  return (
    <FinancialSummaryHeader
      eyebrow="Planejamento mensal"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <PiggyBank aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[
        {
          description: "Despesas lançadas e recorrências previstas nas categorias planejadas.",
          icon: <ReceiptText aria-hidden="true" className="size-3.5" />,
          label: "Total comprometido",
          value: <MoneyValue amount={overview.committedAmount} />,
        },
        {
          description: "Valor que ainda pode ser utilizado dentro dos limites deste mês.",
          icon: <CircleDollarSign aria-hidden="true" className="size-3.5" />,
          label: "Ainda disponível",
          value: <MoneyValue amount={overview.availableAmount} className="text-success" />,
        },
        {
          description: "Despesas previstas sem um limite de orçamento correspondente.",
          icon: <WalletCards aria-hidden="true" className="size-3.5" />,
          label: "Sem orçamento",
          value: (
            <MoneyValue
              amount={overview.unbudgetedCommittedAmount}
              className={overview.unbudgetedCommittedAmount > 0 ? "text-warning" : undefined}
            />
          ),
        },
      ]}
      primaryLabel="Limite planejado"
      primaryValue={<MoneyValue amount={overview.allocatedAmount} />}
      subtitle="Despesas realizadas e recorrências previstas no mês"
      title="Resumo do planejamento"
      variant="soft"
    />
  );
}
