import type { AiToolEventOutput } from "@openmonetis/validators/ai-tools";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, LoaderCircle, type LucideIcon } from "lucide-react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { aiProviderLabels } from "@/features/ai-providers/ai-providers.presentation";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { cn } from "@/lib/utils";
import {
  aiToolEventLabels,
  aiToolEventStatusLabels,
  aiToolFailureMessages,
  formatAiToolEventDate,
} from "../ai-tools.presentation";
import { aiToolEventsQueryOptions } from "../ai-tools.queries";

/** Every change to the assistant's tools; the history is fetched only while the dialog is open. */
export function AiToolHistoryDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const query = useQuery({ ...aiToolEventsQueryOptions(), enabled: open });
  const events = query.data?.items;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" data-mobile-details>
        <DialogHeader>
          <DialogTitle>Histórico de mudanças</DialogTitle>
          <DialogDescription>
            Atualizações e trocas de versão das ferramentas do assistente, da mais recente para a
            mais antiga.
          </DialogDescription>
        </DialogHeader>
        <div className="contents" data-mobile-detail-body>
          {query.isPending ? <HistorySkeleton /> : null}
          {query.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível carregar o histórico.
            </p>
          ) : null}
          {events && !events.length ? (
            <p className="text-muted-foreground text-sm">Nenhuma mudança registrada ainda.</p>
          ) : null}
          {events?.length ? (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <HistoryItem event={event} key={event.id} />
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const statusIcons = {
  pending: LoaderCircle,
  failed: CircleAlert,
  completed: CircleCheck,
} as const satisfies Record<AiToolEventOutput["status"], LucideIcon>;

const statusTones = {
  pending: "text-muted-foreground",
  failed: "text-destructive",
  completed: "text-success",
} as const satisfies Record<AiToolEventOutput["status"], string>;

function HistoryItem({ event }: { event: AiToolEventOutput }) {
  const StatusIcon = statusIcons[event.status];
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <AiProviderMark provider={event.provider} size={16} />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate font-medium text-sm">
          {aiProviderLabels[event.provider]}
          <span className="text-muted-foreground"> · {aiToolEventLabels[event.action]}</span>
        </p>
        <p className="font-mono text-muted-foreground text-xs">
          {event.fromVersion ?? "original"} → {event.toVersion ?? "original"}
        </p>
        {event.status === "failed" && event.failureCode ? (
          <p className="text-destructive text-xs leading-relaxed">
            {aiToolFailureMessages[event.failureCode]}
          </p>
        ) : null}
      </div>
      <div className="grid shrink-0 justify-items-end gap-0.5 text-right">
        <span
          className={cn("flex items-center gap-1 font-medium text-xs", statusTones[event.status])}
        >
          <StatusIcon
            aria-hidden="true"
            className={cn("size-3.5", event.status === "pending" && "animate-spin")}
          />
          {aiToolEventStatusLabels[event.status]}
        </span>
        <time className="font-mono text-muted-foreground text-xs" dateTime={event.createdAt}>
          {formatAiToolEventDate(event.createdAt)}
        </time>
      </div>
    </li>
  );
}

function HistorySkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  );
}
