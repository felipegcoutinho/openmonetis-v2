import type { InboxPageOutput } from "@openmonetis/validators/inbox";
import { CircleDollarSign, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
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
    if (isError) return <span className="text-muted-foreground">Indisponível</span>;
    return value;
  }

  return (
    <section aria-label="Resumo das capturas pendentes" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Inbox />}
          label="Capturas a revisar"
          value={display(summary?.pendingCount ?? 0)}
        />
        <StatCard
          icon={<CircleDollarSign />}
          label="Valor a revisar"
          value={display(<MoneyValue amount={summary?.totalAmount ?? 0} />)}
        />
      </div>
      <Card className="gap-0 py-0">
        <InboxPendingSourceList isError={isError} isLoading={isLoading} summary={summary} />
      </Card>
    </section>
  );
}
