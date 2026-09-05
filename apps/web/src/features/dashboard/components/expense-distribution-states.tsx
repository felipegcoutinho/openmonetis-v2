import { RefreshCw, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";

export function DistributionLoading() {
  return (
    <div aria-label="Carregando distribuição de despesas" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-20 w-full" key={key} />
      ))}
    </div>
  );
}

export function DistributionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar a distribuição</p>
        <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function DistributionEmpty() {
  return (
    <DashboardWidgetEmptyState
      description="A distribuição das despesas aparecerá aqui."
      icon={<WalletCards aria-hidden="true" />}
      title="Nenhuma despesa no mês"
    />
  );
}
