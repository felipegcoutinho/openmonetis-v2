import { Skeleton } from "@/components/ui/skeleton";

export function MobileCollectionLoading({ message }: { message: string }) {
  return (
    <>
      <div aria-label={message} role="status" className="grid gap-4 md:hidden">
        {["first", "second", "third"].map((key) => (
          <div className="grid gap-4 rounded-xl border bg-card p-4" key={key}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-8 w-1/2" />
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
        ))}
      </div>
      <p className="hidden text-muted-foreground text-sm md:block">{message}</p>
    </>
  );
}
