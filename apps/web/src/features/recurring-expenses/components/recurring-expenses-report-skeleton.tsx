import { Skeleton } from "@/components/ui/skeleton";

export function RecurringExpensesReportSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}
