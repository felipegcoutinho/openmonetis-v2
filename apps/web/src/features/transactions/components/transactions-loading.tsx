import { Skeleton } from "@/components/ui/skeleton";

export function TransactionsLoading() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="grid gap-3">
        {["first", "second", "third", "fourth", "fifth", "sixth"].map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <Skeleton className="size-9 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
