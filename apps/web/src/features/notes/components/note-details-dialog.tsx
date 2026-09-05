import type { NoteOutput } from "@openmonetis/validators/notes";
import { CheckSquare2, FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatNoteUpdatedAt,
  getChecklistProgressLabel,
  noteKindLabels,
} from "../notes.presentation";

type NoteDetailsDialogProps = {
  note: NoteOutput | null;
  onEdit: (note: NoteOutput) => void;
  onOpenChange: (open: boolean) => void;
  onSetItemCompletion: (note: NoteOutput, itemId: string, isCompleted: boolean) => void;
  open: boolean;
  pendingItemId?: string;
};

export function NoteDetailsDialog({
  note,
  onEdit,
  onOpenChange,
  onSetItemCompletion,
  open,
  pendingItemId,
}: NoteDetailsDialogProps) {
  if (!note) return null;
  const isChecklist = note.kind === "checklist";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand-strong">
              {isChecklist ? (
                <CheckSquare2 aria-hidden="true" className="size-4" />
              ) : (
                <FileText aria-hidden="true" className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="wrap-break-word">{note.title}</DialogTitle>
              <DialogDescription className="mt-1">
                Atualizada em {formatNoteUpdatedAt(note.updatedAt)}
              </DialogDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{noteKindLabels[note.kind]}</Badge>
            {note.isArchived ? <Badge variant="secondary">Somente leitura</Badge> : null}
          </div>
        </DialogHeader>

        {isChecklist ? (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{getChecklistProgressLabel(note)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {note.completionPercentage}%
                </span>
              </div>
              <Progress
                aria-label={`Progresso: ${getChecklistProgressLabel(note)}`}
                value={note.completionPercentage}
              />
            </div>
            <div className="grid max-h-[50svh] gap-1 overflow-y-auto rounded-lg border p-2">
              {note.items.map((item) => (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2 text-sm",
                    note.isArchived ? "cursor-default" : "cursor-pointer hover:bg-muted/60",
                  )}
                  key={item.id}
                >
                  <Checkbox
                    aria-label={`Marcar ${item.text} como ${item.isCompleted ? "pendente" : "concluído"}`}
                    checked={item.isCompleted}
                    disabled={note.isArchived || Boolean(pendingItemId)}
                    id={`note-details-item-${item.id}`}
                    onCheckedChange={(checked) =>
                      onSetItemCompletion(note, item.id, checked === true)
                    }
                  />
                  <label
                    className={cn(
                      "wrap-break-word",
                      note.isArchived ? "cursor-default" : "cursor-pointer",
                      item.isCompleted && "text-muted-foreground line-through",
                    )}
                    htmlFor={`note-details-item-${item.id}`}
                  >
                    {item.text}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[55svh] overflow-y-auto rounded-lg border bg-muted/20 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed wrap-break-word">
              {note.content}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Fechar
          </Button>
          {!note.isArchived ? (
            <Button
              disabled={Boolean(pendingItemId)}
              onClick={() => {
                onOpenChange(false);
                onEdit(note);
              }}
              type="button"
            >
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
