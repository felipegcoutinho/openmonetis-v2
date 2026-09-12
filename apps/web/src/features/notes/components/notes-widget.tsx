import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck2,
  CheckSquare2,
  Eye,
  FileText,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import {
  useCreateNoteMutation,
  useReplaceNoteMutation,
  useSetNoteItemCompletionMutation,
  useSetTaskCompletionMutation,
} from "../notes.mutations";
import { formatTaskDueDate, getChecklistProgressLabel } from "../notes.presentation";
import { notesDashboardQueryOptions } from "../notes.queries";
import { NoteDetailsDialog } from "./note-details-dialog";
import { NoteDialog } from "./note-dialog";

const maximumVisibleNotes = 4;

export function NotesWidget() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteOutput | null>(null);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const query = useQuery(notesDashboardQueryOptions());
  const createMutation = useCreateNoteMutation();
  const replaceMutation = useReplaceNoteMutation();
  const completionMutation = useSetNoteItemCompletionMutation();
  const taskCompletionMutation = useSetTaskCompletionMutation();
  const notes = query.data?.items ?? [];
  const viewingNote = notes.find((note) => note.id === viewingNoteId) ?? null;
  const pendingItemId = completionMutation.isPending
    ? completionMutation.variables?.itemId
    : undefined;

  function changeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingNote(null);
  }

  function openCreate() {
    setEditingNote(null);
    setDialogOpen(true);
  }

  function openEdit(note: NoteOutput) {
    setViewingNoteId(null);
    setEditingNote(note);
    setDialogOpen(true);
  }

  async function save(input: CreateNoteInput | ReplaceNoteInput) {
    try {
      if (editingNote) {
        await replaceMutation.mutateAsync({ id: editingNote.id, input: input as ReplaceNoteInput });
      } else {
        await createMutation.mutateAsync(input as CreateNoteInput);
      }
      changeDialog(false);
      toast.success(editingNote ? "Anotação atualizada" : "Anotação criada");
    } catch {
      toast.error("Não foi possível salvar a anotação.");
    }
  }

  async function setItemCompletion(note: NoteOutput, itemId: string, isCompleted: boolean) {
    try {
      await completionMutation.mutateAsync({ noteId: note.id, itemId, isCompleted });
    } catch {
      toast.error("Não foi possível atualizar o item.");
    }
  }

  async function setTaskCompletion(note: NoteOutput, isCompleted: boolean) {
    try {
      await taskCompletionMutation.mutateAsync({ id: note.id, isCompleted });
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    }
  }

  return (
    <>
      <DashboardWidget
        action={
          notes.length > 0 ? (
            <Button aria-label="Nova anotação" onClick={openCreate} size="icon-sm" variant="ghost">
              <Plus aria-hidden="true" />
            </Button>
          ) : undefined
        }
        description="Anotações ativas atualizadas recentemente"
        footer={
          notes.length > 0 ? (
            <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/notes">
              Ver anotações <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : undefined
        }
        icon={<NotebookPen aria-hidden="true" />}
        title="Anotações"
      >
        {query.isLoading ? <NotesWidgetLoading /> : null}
        {query.isError ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="font-medium text-sm">Não foi possível carregar as anotações</p>
              <Button
                className="mt-3"
                onClick={() => void query.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : null}
        {query.data && !query.isError ? (
          notes.length === 0 ? (
            <DashboardWidgetEmptyState
              description="As anotações ativas aparecerão aqui."
              icon={<NotebookPen aria-hidden="true" />}
              title="Nenhuma anotação ativa"
            />
          ) : (
            <NotesWidgetList
              notes={notes.slice(0, maximumVisibleNotes)}
              onEdit={openEdit}
              onOpen={setViewingNoteId}
            />
          )
        ) : null}
      </DashboardWidget>

      <NoteDialog
        note={editingNote}
        onOpenChange={changeDialog}
        onSubmit={save}
        open={dialogOpen}
        pending={createMutation.isPending || replaceMutation.isPending}
      />
      <NoteDetailsDialog
        note={viewingNote}
        onEdit={openEdit}
        onOpenChange={(open) => {
          if (!open) setViewingNoteId(null);
        }}
        onSetItemCompletion={setItemCompletion}
        onSetTaskCompletion={setTaskCompletion}
        open={Boolean(viewingNoteId)}
        pendingItemId={
          taskCompletionMutation.isPending ? (viewingNoteId ?? undefined) : pendingItemId
        }
      />
    </>
  );
}

function NotesWidgetList({
  notes,
  onEdit,
  onOpen,
}: {
  notes: NoteOutput[];
  onEdit: (note: NoteOutput) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="divide-y">
      {notes.map((note) => {
        const checklist = note.kind === "checklist";
        const task = note.kind === "task";

        return (
          <DashboardWidgetRow
            className="group"
            key={note.id}
            structure={checklist ? "progress" : "details"}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              {checklist ? (
                <CheckSquare2 aria-hidden="true" className="size-4" />
              ) : task ? (
                <CalendarCheck2 aria-hidden="true" className="size-4" />
              ) : (
                <FileText aria-hidden="true" className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <button
                className="block max-w-full truncate text-left font-medium text-sm hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onOpen(note.id)}
                type="button"
              >
                {note.title}
              </button>
              {checklist ? (
                <div className="mt-1 grid gap-1">
                  <p className="truncate text-muted-foreground text-xs">
                    {getChecklistProgressLabel(note)}
                  </p>
                  <Progress
                    aria-label={`Progresso: ${getChecklistProgressLabel(note)}`}
                    indicatorClassName="bg-brand/70"
                    trackClassName="h-1"
                    value={note.completionPercentage}
                  />
                </div>
              ) : task ? (
                <p className="truncate text-muted-foreground text-xs">
                  {note.isCompleted
                    ? "Concluída"
                    : note.dueDate
                      ? `Para ${formatTaskDueDate(note.dueDate)}`
                      : "Pendente"}
                </p>
              ) : (
                <p className="truncate text-muted-foreground text-xs">{note.content}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                aria-label={`Editar ${note.title}`}
                className="text-muted-foreground"
                onClick={() => onEdit(note)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                aria-label={`Abrir ${note.title}`}
                className="text-muted-foreground"
                onClick={() => onOpen(note.id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Eye aria-hidden="true" />
              </Button>
            </div>
          </DashboardWidgetRow>
        );
      })}
    </ul>
  );
}

function NotesWidgetLoading() {
  return (
    <div aria-label="Carregando anotações" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}
