import type { NoteOutput } from "@openmonetis/validators/notes";
import { CalendarCheck2, CalendarDays, CheckSquare2, FileText, Pencil } from "lucide-react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatNoteUpdatedAt,
  formatTaskDueDate,
  getChecklistProgressLabel,
  noteCompletionCheckboxClassName,
  noteKindLabels,
} from "../notes.presentation";

type NoteDetailsDialogProps = {
  note: NoteOutput | null;
  onEdit: (note: NoteOutput) => void;
  onOpenChange: (open: boolean) => void;
  onSetItemCompletion: (note: NoteOutput, itemId: string, isCompleted: boolean) => void;
  onSetTaskCompletion: (note: NoteOutput, isCompleted: boolean) => void;
  open: boolean;
  pendingItemId?: string;
};

export function NoteDetailsDialog({
  note,
  onEdit,
  onOpenChange,
  onSetItemCompletion,
  onSetTaskCompletion,
  open,
  pendingItemId,
}: NoteDetailsDialogProps) {
  if (!note) return null;
  const isChecklist = note.kind === "checklist";
  const isTask = note.kind === "task";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-mobile-details className="min-w-0 overflow-x-hidden sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand-strong">
              {isChecklist ? (
                <CheckSquare2 aria-hidden="true" className="size-4" />
              ) : isTask ? (
                <CalendarCheck2 aria-hidden="true" className="size-4" />
              ) : (
                <FileText aria-hidden="true" className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="break-all">{note.title}</DialogTitle>
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
        <div className="contents" data-mobile-detail-body>
          {isChecklist ? (
            <div className="grid min-w-0 gap-4">
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
              <div
                data-mobile-detail-list
                className="grid min-w-0 max-h-[50svh] gap-1 overflow-x-hidden overflow-y-auto rounded-lg border p-2"
              >
                {note.items.map((item) => (
                  <div
                    className={cn(
                      "flex min-w-0 items-start gap-3 rounded-md px-2 py-2 text-sm",
                      note.isArchived ? "cursor-default" : "cursor-pointer hover:bg-muted/60",
                    )}
                    key={item.id}
                  >
                    <Checkbox
                      aria-label={`Marcar ${item.text} como ${item.isCompleted ? "pendente" : "concluído"}`}
                      checked={item.isCompleted}
                      className={noteCompletionCheckboxClassName}
                      disabled={note.isArchived || Boolean(pendingItemId)}
                      id={`note-details-item-${item.id}`}
                      onCheckedChange={(checked) =>
                        onSetItemCompletion(note, item.id, checked === true)
                      }
                    />
                    <label
                      className={cn(
                        "block min-w-0 flex-1 whitespace-pre-wrap break-all",
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
          ) : isTask ? (
            <div className="grid gap-4">
              <label
                className={cn(
                  "flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors",
                  note.isArchived ? "cursor-default" : "cursor-pointer hover:bg-muted/60",
                )}
                htmlFor={`note-details-task-${note.id}`}
              >
                <Checkbox
                  aria-label={`Marcar tarefa ${note.title} como ${note.isCompleted ? "pendente" : "concluída"}`}
                  checked={note.isCompleted}
                  className={noteCompletionCheckboxClassName}
                  disabled={note.isArchived || Boolean(pendingItemId)}
                  id={`note-details-task-${note.id}`}
                  onCheckedChange={(checked) => onSetTaskCompletion(note, checked === true)}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span
                    className={cn(
                      "font-medium text-sm",
                      note.isCompleted && "text-muted-foreground line-through",
                    )}
                  >
                    {note.isCompleted ? "Concluída" : "Pendente"}
                  </span>
                  {note.dueDate ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                      <CalendarDays aria-hidden="true" className="size-3.5" />
                      {formatTaskDueDate(note.dueDate)}
                    </span>
                  ) : null}
                </span>
              </label>
              {note.content ? (
                <div
                  data-mobile-detail-list
                  className="min-w-0 max-h-[45svh] overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/20 p-4"
                >
                  <p className="w-full min-w-0 whitespace-pre-wrap break-all text-sm leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              data-mobile-detail-list
              className="min-w-0 max-h-[55svh] overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/20 p-4"
            >
              <p className="w-full min-w-0 whitespace-pre-wrap break-all text-sm leading-relaxed">
                {note.content}
              </p>
            </div>
          )}
        </div>
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
