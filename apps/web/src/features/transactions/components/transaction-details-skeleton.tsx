import { Skeleton } from "@/components/ui/skeleton";

export function TransactionDetailsSkeleton() {
  return (
    <div aria-label="Carregando detalhes do lançamento" className="grid gap-5 p-4" role="status">
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
