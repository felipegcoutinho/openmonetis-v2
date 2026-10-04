import { useQuery } from "@tanstack/react-query";

import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";

import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { inboxItemQueryOptions } from "../inbox.queries";

export function InboxDetailsDialog({
  itemId,
  onOpenChange,
}: {
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery(inboxItemQueryOptions(itemId ?? ""));
  const item = query.data;
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(itemId)}>
      <DialogContent data-mobile-details>
        <DialogHeader>
          <DialogTitle>Detalhes da captura</DialogTitle>
          <DialogDescription>
            Conteúdo original enviado pelo Companion. Confirme os dados antes de usar.
          </DialogDescription>
        </DialogHeader>
        <div className="contents" data-mobile-detail-body>
          {query.isLoading ? <Skeleton className="h-40" /> : null}
          {query.isError ? (
            <p className="text-destructive text-sm">Não foi possível carregar os detalhes.</p>
          ) : null}
          {item && !query.isError ? (
            <dl className="grid gap-4">
              <div>
                <dt className="font-medium text-muted-foreground text-xs">Origem</dt>
                <dd className="mt-1 text-sm">{item.sourceAppName ?? item.sourceApp}</dd>
              </div>
              {item.originalTitle ? (
                <div>
                  <dt className="font-medium text-muted-foreground text-xs">Título</dt>
                  <dd className="mt-1 wrap-break-word text-sm">{item.originalTitle}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-medium text-muted-foreground text-xs">Texto da notificação</dt>
                <dd className="mt-1 rounded-lg border bg-muted/30 p-3 wrap-break-word text-sm leading-relaxed">
                  {item.originalText}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
