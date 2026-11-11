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
    <div className={`flex min-w-0 items-center gap-2${className ? ` ${className}` : ""}`}>
      <Tooltip>
        <TooltipTrigger
          aria-label="Ver detalhes"
          onClick={onDetails}
          render={
            <Button
              className="text-muted-foreground hover:text-foreground max-md:size-11"
              size="icon"
              variant="outline"
            />
          }
        >
          <Eye aria-hidden="true" className="size-4 max-md:size-5" />
        </TooltipTrigger>
        <TooltipContent>Ver detalhes</TooltipContent>
      </Tooltip>
      {status === "pending" ? (
        <>
          {/* Labelled and kept apart from "Revisar" so a slip never discards a capture. */}
          <Button
            className="text-muted-foreground hover:text-destructive max-md:min-h-11"
            disabled={processing}
            onClick={onDiscard}
            size="default"
            variant="ghost"
          >
            <ArchiveX aria-hidden="true" /> Descartar
          </Button>
          <Button
            className="ms-2 max-md:min-h-11 max-md:min-w-28"
            disabled={processing}
            onClick={onProcess}
            size="default"
          >
            <ClipboardPen aria-hidden="true" /> Revisar
          </Button>
        </>
      ) : status === "discarded" ? (
        <>
          <Button
            className="max-md:min-h-11 max-md:min-w-28"
            disabled={processing}
            onClick={onRestore}
            size="default"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" /> Restaurar
          </Button>
          <Button
            aria-label="Excluir"
            className="max-md:size-11"
            onClick={onDelete}
            size="icon"
            variant="outline"
          >
            <Trash2 aria-hidden="true" className="size-4 max-md:size-5" />
          </Button>
        </>
      ) : (
        <Button
          aria-label="Excluir"
          className="max-md:size-11"
          onClick={onDelete}
          size="icon"
          variant="outline"
        >
          <Trash2 aria-hidden="true" className="size-4 max-md:size-5" />
        </Button>
      )}
    </div>
  );
}
