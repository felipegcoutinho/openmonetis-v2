import { Skeleton } from "@/components/ui/skeleton";

const TRANSACTION_ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

/** Placeholder for detail pages built on `FinancialSummaryHeader` + chart + transactions list. */
export function FinancialDetailLoading({ message }: { message: string }) {
  return (
    <section aria-label={message} className="app-page project-container grid gap-6" role="status">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-8 rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-56" />
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-2">
        {TRANSACTION_ROW_KEYS.map((key) => (
          <Skeleton className="h-12 w-full" key={key} />
        ))}
      </div>
    </section>
  );
}
