import type { NoteOutput } from "@openmonetis/validators/notes";
import {
  Archive,
  CalendarCheck2,
  CalendarDays,
  FileText,
  ListChecks,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatNoteUpdatedAt,
  formatTaskDueDate,
  getChecklistProgressLabel,
  noteCompletionCheckboxClassName,
  noteKindLabels,
} from "../notes.presentation";

type NoteCardProps = {
  note: NoteOutput;
  onArchive: (note: NoteOutput, isArchived: boolean) => void;
  onEdit: (note: NoteOutput) => void;
  onOpen: (note: NoteOutput) => void;
  onRemove: (note: NoteOutput) => void;
  onSetItemCompletion: (note: NoteOutput, itemId: string, isCompleted: boolean) => void;
  onSetTaskCompletion: (note: NoteOutput, isCompleted: boolean) => void;
  pendingAction?: boolean;
  pendingItemId?: string;
};

export function NoteCard({
  note,
  onArchive,
  onEdit,
  onOpen,
  onRemove,
  onSetItemCompletion,
  onSetTaskCompletion,
  pendingAction = false,
  pendingItemId,
}: NoteCardProps) {
  const isChecklist = note.kind === "checklist";
  const isTask = note.kind === "task";
  const visibleItems = note.items.slice(0, 5);
  const hiddenItemCount = note.items.length - visibleItems.length;

  return (
    <Card className={cn("gap-4", note.isArchived && "opacity-70")}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              {isChecklist ? (
                <ListChecks aria-hidden="true" className="size-5" />
              ) : isTask ? (
                <CalendarCheck2 aria-hidden="true" className="size-5" />
              ) : (
                <FileText aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <button
                className="block max-w-full text-left focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onOpen(note)}
                type="button"
              >
                <CardTitle className="truncate transition-colors hover:text-brand-strong">
                  {note.title}
                </CardTitle>
              </button>
              <p className="mt-0.5 text-muted-foreground text-xs">{noteKindLabels[note.kind]}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                note.isArchived ? "bg-muted-foreground" : "bg-emerald-500",
              )}
            />
            {note.isArchived ? "Arquivada" : "Ativa"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-brand/5 p-3 text-xs">
          <span className="text-muted-foreground">Última atualização</span>
          <span className="text-right font-medium tabular-nums">
            {formatNoteUpdatedAt(note.updatedAt)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {isChecklist ? (
          <>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{getChecklistProgressLabel(note)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {note.completionPercentage}%
                </span>
              </div>
              <Progress aria-label="Progresso da lista" value={note.completionPercentage} />
            </div>
            <div className="grid gap-1">
              {visibleItems.map((item) => (
                <div
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                  key={item.id}
                >
                  <Checkbox
                    aria-label={`Marcar ${item.text} como ${item.isCompleted ? "pendente" : "concluído"}`}
                    checked={item.isCompleted}
                    className={noteCompletionCheckboxClassName}
                    disabled={note.isArchived || Boolean(pendingItemId)}
                    id={`note-card-item-${item.id}`}
                    onCheckedChange={(checked) =>
                      onSetItemCompletion(note, item.id, checked === true)
                    }
                  />
                  <label
                    className={cn(
                      "min-w-0 flex-1 wrap-break-word leading-4",
                      "line-clamp-2",
                      note.isArchived ? "cursor-default" : "cursor-pointer",
                      item.isCompleted && "text-muted-foreground line-through",
                    )}
                    htmlFor={`note-card-item-${item.id}`}
                  >
                    {item.text}
                  </label>
                </div>
              ))}
              {hiddenItemCount > 0 ? (
                <button
                  className="mt-1 w-fit rounded-sm px-2 text-left text-brand-strong text-xs hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onOpen(note)}
                  type="button"
                >
                  Ver mais {hiddenItemCount} {hiddenItemCount === 1 ? "item" : "itens"}
                </button>
              ) : null}
            </div>
          </>
        ) : isTask ? (
          <div className="grid gap-4">
            <label
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              htmlFor={`note-task-${note.id}`}
            >
              <Checkbox
                aria-label={`Marcar tarefa ${note.title} como ${note.isCompleted ? "pendente" : "concluída"}`}
                checked={note.isCompleted}
                className={noteCompletionCheckboxClassName}
                disabled={note.isArchived || pendingAction}
                id={`note-task-${note.id}`}
                onCheckedChange={(checked) => onSetTaskCompletion(note, checked === true)}
              />
              <span className="grid min-w-0 gap-1">
                <span
                  className={cn(
                    "font-medium text-sm",
                    note.isCompleted && "text-muted-foreground line-through",
                  )}
                >
                  {note.isCompleted ? "Concluída" : "Pendente"}
                </span>
                {note.dueDate ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                    <CalendarDays aria-hidden="true" className="size-3.5" />
                    {formatTaskDueDate(note.dueDate)}
                  </span>
                ) : null}
              </span>
            </label>
            {note.content ? (
              <button
                className="line-clamp-4 whitespace-pre-wrap text-left text-muted-foreground text-sm leading-relaxed wrap-break-word focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onOpen(note)}
                type="button"
              >
                {note.content}
              </button>
            ) : null}
          </div>
        ) : (
          <button
            aria-label={`Abrir anotação ${note.title}`}
            className="line-clamp-6 whitespace-pre-wrap text-left text-muted-foreground text-sm leading-relaxed wrap-break-word focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => onOpen(note)}
            type="button"
          >
            {note.content}
          </button>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap gap-3 border-t pt-3">
        {!note.isArchived ? (
          <button
            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={pendingAction}
            onClick={() => onEdit(note)}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Editar
          </button>
        ) : null}
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pendingAction}
          onClick={() => onArchive(note, !note.isArchived)}
          type="button"
        >
          {note.isArchived ? (
            <RotateCcw aria-hidden="true" className="size-3.5" />
          ) : (
            <Archive aria-hidden="true" className="size-3.5" />
          )}
          {note.isArchived ? "Restaurar" : "Arquivar"}
        </button>
        <button
          className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-destructive text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pendingAction}
          onClick={() => onRemove(note)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          Excluir
        </button>
      </CardFooter>
    </Card>
  );
}
