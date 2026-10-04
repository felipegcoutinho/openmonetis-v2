import { Bell, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

import type { NotificationView } from "./notification-panel.types";

export function NotificationPanelLoading() {
  return (
    <div aria-label="Carregando notificações" className="grid gap-3 p-4" role="status">
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-28" key={key} />
      ))}
    </div>
  );
}

export function NotificationPanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center px-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Bell aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">Não foi possível carregar as notificações</p>
        <p className="mt-1 text-muted-foreground text-sm">Tente novamente em instantes.</p>
        <Button className="mt-4" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function NotificationPanelEmpty({ view }: { view: NotificationView }) {
  return (
    <div className="grid min-h-80 place-items-center px-8 text-center">
      <div>
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/10 text-success">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">
          {view === "archived" ? "Nenhuma notificação arquivada" : "Tudo em dia por aqui"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {view === "archived"
            ? "As notificações arquivadas aparecerão neste espaço."
            : "Novos vencimentos e alertas aparecerão quando precisarem de você."}
        </p>
      </div>
    </div>
  );
}
