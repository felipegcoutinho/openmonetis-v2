import { Skeleton } from "@/components/ui/skeleton";

export function RecurringTransactionsReportSkeleton() {
  return (
    <div aria-label="Carregando lançamentos recorrentes" className="grid gap-6" role="status">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
