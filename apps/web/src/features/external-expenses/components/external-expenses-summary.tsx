import { HandCoins } from "lucide-react";

import { FinancialSummaryHeader } from "@/components/financial-summary-header";

import { MoneyValue } from "@/components/money-value";

import { Skeleton } from "@/components/ui/skeleton";

export function ExternalExpensesSummary({
  isError,
  isLoading,
  total,
  totalAmount,
}: {
  isError: boolean;
  isLoading: boolean;
  total: number | undefined;
  totalAmount: number | undefined;
}) {
  return (
    <FinancialSummaryHeader
      eyebrow="Lançamentos externos"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <HandCoins aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[]}
      primaryLabel="Total aguardando importação"
      primaryValue={
        isLoading ? (
          <Skeleton className="h-12 w-52 bg-current/15 before:via-current/20" />
        ) : isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={totalAmount ?? 0} />
        )
      }
      subtitle={
        isLoading
          ? "Calculando os lançamentos recebidos"
          : `${total ?? 0} ${
              total === 1 ? "lançamento aguardando importação" : "lançamentos aguardando importação"
            }`
      }
      title="Pendências recebidas"
      variant="soft"
    />
  );
}
