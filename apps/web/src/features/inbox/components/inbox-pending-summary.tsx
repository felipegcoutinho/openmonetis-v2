import type { InboxPageOutput } from "@openmonetis/validators/inbox";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { SummaryStrip } from "@/components/summary-strip";
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
  function display(value: ReactNode) {
    if (isLoading) return <Skeleton className="h-6 w-24" />;
    if (isError) return "Indisponível";
    return value;
  }

  return (
    <SummaryStrip
      details={<InboxPendingSourceList isError={isError} isLoading={isLoading} summary={summary} />}
      items={[
        {
          label: "Capturas a revisar",
          value: display(summary?.pendingCount ?? 0),
          emphasized: true,
        },
        {
          label: "Valor a revisar",
          value: display(<MoneyValue amount={summary?.totalAmount ?? 0} />),
          emphasized: true,
        },
      ]}
      label="Resumo das capturas pendentes"
    />
  );
}
