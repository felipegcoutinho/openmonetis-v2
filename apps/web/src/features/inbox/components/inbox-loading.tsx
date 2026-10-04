import { Skeleton } from "@/components/ui/skeleton";

export function InboxLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Carregando pré-lançamentos">
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-24" key={key} />
      ))}
    </div>
  );
}
