import type { InboxPageOutput } from "@openmonetis/validators/inbox";

import { Inbox } from "lucide-react";

import { FinancialSummaryHeader } from "@/components/financial-summary-header";

import { MoneyValue } from "@/components/money-value";

import { Skeleton } from "@/components/ui/skeleton";

import { InboxPendingSourceList } from "./inbox-pending-source-list";

export function InboxPendingSummary({
  isError,
  isLoading,
  summary,
}: {
  isError: boolean;
  isLoading: boolean;
  summary: InboxPageOutput["pendingSummary"] | undefined;
}) {
  return (
    <FinancialSummaryHeader
      details={<InboxPendingSourceList isError={isError} isLoading={isLoading} summary={summary} />}
      eyebrow="Caixa de entrada"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <Inbox aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[]}
      primaryLabel="Valor das capturas a revisar"
      primaryValue={
        isLoading ? (
          <Skeleton className="h-12 w-52 bg-current/15 before:via-current/20" />
        ) : isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={summary?.totalAmount ?? 0} />
        )
      }
      subtitle={
        isLoading
          ? "Calculando as capturas pendentes"
          : `${summary?.pendingCount ?? 0} ${
              summary?.pendingCount === 1
                ? "captura aguardando revisão"
                : "capturas aguardando revisão"
            }`
      }
      title="Pendências capturadas"
      variant="soft"
    />
  );
}
