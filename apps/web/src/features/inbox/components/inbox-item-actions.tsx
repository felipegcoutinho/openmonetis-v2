import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";

import { ArchiveX, ClipboardPen, Eye, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InboxItemActions({
  className,
  onDelete,
  onDetails,
  onDiscard,
  onProcess,
  onRestore,
  processing,
  status,
}: {
  className?: string;
  onDelete: () => void;
  onDetails: () => void;
  onDiscard: () => void;
  onProcess: () => void;
  onRestore: () => void;
  processing: boolean;
  status: InboxItemSummaryOutput["status"];
}) {
  return (
    <div className={`flex items-center gap-1${className ? ` ${className}` : ""}`}>
      <Tooltip>
        <TooltipTrigger
          aria-label="Ver detalhes"
          onClick={onDetails}
          render={
            <Button
              className="text-muted-foreground hover:text-foreground"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <Eye aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Ver detalhes</TooltipContent>
      </Tooltip>
      {status === "pending" ? (
        <>
          <Tooltip>
            <TooltipTrigger
              aria-label="Descartar captura"
              disabled={processing}
              onClick={onDiscard}
              render={
                <Button
                  className="text-muted-foreground hover:text-destructive"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <ArchiveX aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Descartar</TooltipContent>
          </Tooltip>
          <Button disabled={processing} onClick={onProcess} size="sm">
            <ClipboardPen aria-hidden="true" /> Revisar
          </Button>
        </>
      ) : status === "discarded" ? (
        <>
          <Button disabled={processing} onClick={onRestore} size="sm" variant="outline">
            <RotateCcw aria-hidden="true" /> Restaurar
          </Button>
          <Button aria-label="Excluir" onClick={onDelete} size="icon-sm" variant="ghost">
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      ) : (
        <Button aria-label="Excluir" onClick={onDelete} size="icon-sm" variant="ghost">
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
