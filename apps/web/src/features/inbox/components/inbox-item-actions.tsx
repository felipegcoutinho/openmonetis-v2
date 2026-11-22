import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";

import { ArchiveX, ClipboardPen, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

/**
 * Columns of the phone card's action row: the labelled choices share the full width equally; a
 * discarded capture keeps delete as a red 44px square beside "Restaurar", and a confirmed one, with
 * nothing else to decide, gets it as a full-width red button. Details open from the card itself.
 */
const cardColumns = {
  pending: "grid grid-cols-2 gap-2",
  discarded: "grid grid-cols-[1fr_auto] gap-2",
  processed: "grid grid-cols-1",
} satisfies Record<InboxItemSummaryOutput["status"], string>;

export function InboxItemActions({
  className,
  layout = "inline",
  onDelete,
  onDiscard,
  onProcess,
  onRestore,
  processing,
  status,
}: {
  className?: string;
  /**
   * `inline` sits beside the amount (desktop); `card` fills the width of a phone card. Details open
   * from the card itself: the title on phones, a quiet button beside the title on desktop.
   */
  layout?: "inline" | "card";
  onDelete: () => void;
  onDiscard: () => void;
  onProcess: () => void;
  onRestore: () => void;
  processing: boolean;
  status: InboxItemSummaryOutput["status"];
}) {
  const card = layout === "card";
  const labelledClassName = card ? "h-11" : "max-md:min-h-11";
  const iconClassName = "text-muted-foreground max-md:size-11";

  return (
    <div className={cn(card ? cardColumns[status] : "flex min-w-0 items-center gap-2", className)}>
      {status === "pending" ? (
        <>
          {/* Labelled and kept apart from "Revisar" so a slip never discards a capture. */}
          <Button
            className={cn(labelledClassName, "text-muted-foreground hover:text-destructive")}
            disabled={processing}
            onClick={onDiscard}
            size="default"
            variant={card ? "outline" : "ghost"}
          >
            <ArchiveX aria-hidden="true" /> Descartar
          </Button>
          <Button
            className={cn(labelledClassName, !card && "ms-2")}
            disabled={processing}
            onClick={onProcess}
            size="default"
          >
            <ClipboardPen aria-hidden="true" /> Revisar
          </Button>
        </>
      ) : (
        <>
          {status === "discarded" ? (
            <Button
              className={labelledClassName}
              disabled={processing}
              onClick={onRestore}
              size="default"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" /> Restaurar
            </Button>
          ) : null}
          {card && status === "processed" ? (
            <Button className="h-11" onClick={onDelete} size="default" variant="destructive">
              <Trash2 aria-hidden="true" /> Excluir
            </Button>
          ) : (
            <Button
              aria-label="Excluir"
              className={card ? "size-11" : cn(iconClassName, "hover:text-destructive")}
              onClick={onDelete}
              size="icon"
              variant={card ? "destructive" : "outline"}
            >
              <Trash2 aria-hidden="true" className="size-4 max-md:size-5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
