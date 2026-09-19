import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FileSearch, ListChecks, NotebookPen, Plus, RefreshCw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesApiError } from "../notes.api";
import {
  useArchiveNoteMutation,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useReplaceNoteMutation,
  useSetNoteItemCompletionMutation,
  useSetTaskCompletionMutation,
} from "../notes.mutations";
import { noteQueryOptions, notesInfiniteQueryOptions } from "../notes.queries";
import { NoteCard } from "./note-card";
import { NoteDetailsDialog } from "./note-details-dialog";
import { NoteDialog } from "./note-dialog";

type NoteStatus = "active" | "archived";
const skeletonKeys = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

export function NotesPage() {
  const [status, setStatus] = useState<NoteStatus>("active");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteOutput | null>(null);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<NoteOutput | null>(null);
  const createMutation = useCreateNoteMutation();
  const replaceMutation = useReplaceNoteMutation();
  const archiveMutation = useArchiveNoteMutation();
  const completionMutation = useSetNoteItemCompletionMutation();
  const taskCompletionMutation = useSetTaskCompletionMutation();
  const deleteMutation = useDeleteNoteMutation();
  const query = useInfiniteQuery(
    notesInfiniteQueryOptions({
      status,
      q: deferredSearch || undefined,
      limit: 30,
    }),
  );
  const detailQuery = useQuery({
    ...noteQueryOptions(viewingNoteId ?? ""),
    enabled: Boolean(viewingNoteId),
  });
  const [hideCompleted, setHideCompleted] = useState(false);
  const notes = query.data?.pages.flatMap((page) => page.items) ?? [];
  const viewingNote = viewingNoteId
    ? (detailQuery.data ?? notes.find((note) => note.id === viewingNoteId) ?? null)
    : null;
  const hasSearch = Boolean(deferredSearch);
  const hasInitialError = query.isError && notes.length === 0;
  const hasBackgroundError = query.isRefetchError && notes.length > 0;
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
    setEditingNote(note);
    setDialogOpen(true);
  }

  async function save(input: CreateNoteInput | ReplaceNoteInput) {
    if (editingNote) {
      await replaceMutation.mutateAsync({ id: editingNote.id, input: input as ReplaceNoteInput });
    } else {
      await createMutation.mutateAsync(input as CreateNoteInput);
    }
    changeDialog(false);
  }

  async function setArchived(note: NoteOutput, isArchived: boolean) {
    try {
      await archiveMutation.mutateAsync({ id: note.id, isArchived });
      toast.success(isArchived ? "Anotação arquivada" : "Anotação restaurada", {
        description: isArchived
          ? "Ela continua disponível na aba Arquivadas."
          : "Ela voltou para as anotações ativas.",
        action: {
          label: "Desfazer",
          onClick: () =>
            archiveMutation.mutate(
              { id: note.id, isArchived: !isArchived },
              { onError: () => toast.error("Não foi possível desfazer.") },
            ),
        },
      });
    } catch {
      toast.error("Não foi possível alterar o arquivamento.");
    }
  }

  async function setItemCompletion(note: NoteOutput, itemId: string, isCompleted: boolean) {
    try {
      await completionMutation.mutateAsync({
        noteId: note.id,
        itemId,
        isCompleted,
      });
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

  async function removeNote() {
    if (!deletingNote) return;
    try {
      await deleteMutation.mutateAsync({
        id: deletingNote.id,
        expectedVersion: deletingNote.version,
      });
      toast.success("Anotação excluída");
      setDeletingNote(null);
    } catch (error) {
      const message =
        error instanceof NotesApiError && error.code === "note_version_conflict"
          ? "A anotação mudou. Revise a versão atual antes de excluir."
          : "Não foi possível excluir a anotação.";
      toast.error(message);
      if (error instanceof NotesApiError && error.code === "note_version_conflict") {
        setDeletingNote(null);
      }
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={openCreate} type="button">
                <Plus aria-hidden="true" />
                Nova anotação
              </Button>
            }
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Organização" }]}
            description="Notas, listas e tarefas com lembretes para acompanhar o que você precisa fazer."
            eyebrow="Organização"
            icon={<NotebookPen aria-hidden="true" className="size-5" />}
            title="Anotações"
          />

          <Tabs
            className="gap-0"
            onValueChange={(value) => {
              if (value === "active" || value === "archived") setStatus(value);
            }}
            value={status}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:border-border lg:border-b">
              <TabsList className="lg:border-b-0" variant="line">
                <TabsTrigger value="active">Ativas</TabsTrigger>
                <TabsTrigger value="archived">Arquivadas</TabsTrigger>
              </TabsList>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    aria-label="Buscar anotações"
                    className="pl-9"
                    maxLength={120}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar título, conteúdo ou item"
                    type="search"
                    value={search}
                  />
                </div>
              </div>
            </div>

            <TabsContent className="grid gap-5 pt-5" value={status}>
              {query.isLoading ? <NotesSkeleton /> : null}

              {hasInitialError ? (
                <Card className="grid min-h-60 place-items-center p-6 text-center" role="alert">
                  <div>
                    <RefreshCw
                      aria-hidden="true"
                      className="mx-auto size-6 text-muted-foreground"
                    />
                    <p className="mt-3 font-medium">Não foi possível carregar as anotações</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Verifique sua conexão e tente novamente.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => void query.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                </Card>
              ) : null}

              {!query.isLoading && !hasInitialError && notes.length === 0 ? (
                <NotesEmptyState
                  hasSearch={hasSearch}
                  onClearSearch={() => setSearch("")}
                  onCreate={openCreate}
                  status={status}
                />
              ) : null}

              {hasBackgroundError && !query.isFetchNextPageError ? (
                <div
                  className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <span>
                    Não foi possível atualizar a lista. Os dados anteriores continuam visíveis.
                  </span>
                  <Button onClick={() => void query.refetch()} size="sm" variant="outline">
                    Tentar novamente
                  </Button>
                </div>
              ) : null}

              <Button
                className="w-fit"
                variant="outline"
                size="sm"
                aria-pressed={hideCompleted}
                onClick={() => setHideCompleted(!hideCompleted)}
              >
                {hideCompleted ? "Mostrar tarefas concluídas" : "Ocultar tarefas concluídas"}
              </Button>
              {notes.length > 0 ? (
                <>
                  {hideCompleted &&
                  notes.every((note) => note.kind === "task" && note.isCompleted) ? (
                    <p className="rounded-lg border p-6 text-center text-muted-foreground">
                      As tarefas carregadas estão concluídas. Use “Mostrar tarefas concluídas” para
                      vê-las.
                    </p>
                  ) : null}
                  <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {notes
                      .filter((note) => !hideCompleted || note.kind !== "task" || !note.isCompleted)
                      .map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onArchive={(item, isArchived) => void setArchived(item, isArchived)}
                          onEdit={openEdit}
                          onOpen={(item) => setViewingNoteId(item.id)}
                          onRemove={setDeletingNote}
                          onSetItemCompletion={(item, itemId, isCompleted) =>
                            void setItemCompletion(item, itemId, isCompleted)
                          }
                          onSetTaskCompletion={(item, isCompleted) =>
                            void setTaskCompletion(item, isCompleted)
                          }
                          pendingAction={
                            (archiveMutation.isPending &&
                              archiveMutation.variables?.id === note.id) ||
                            (completionMutation.isPending &&
                              completionMutation.variables?.noteId === note.id) ||
                            (taskCompletionMutation.isPending &&
                              taskCompletionMutation.variables?.id === note.id)
                          }
                          pendingItemId={
                            completionMutation.variables?.noteId === note.id
                              ? pendingItemId
                              : undefined
                          }
                        />
                      ))}
                  </div>
                  {query.isFetchNextPageError ? (
                    <div className="flex flex-col items-center gap-2 text-center" role="alert">
                      <p className="text-destructive text-sm">
                        Não foi possível carregar mais anotações.
                      </p>
                      <Button
                        onClick={() => void query.fetchNextPage()}
                        type="button"
                        variant="outline"
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : query.hasNextPage ? (
                    <div className="flex justify-center">
                      <Button
                        disabled={query.isFetchingNextPage}
                        onClick={() => void query.fetchNextPage()}
                        type="button"
                        variant="outline"
                      >
                        {query.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </section>

        <NoteDialog
          key={`${editingNote?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
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
          onSetItemCompletion={(note, itemId, isCompleted) =>
            void setItemCompletion(note, itemId, isCompleted)
          }
          onSetTaskCompletion={(note, isCompleted) => void setTaskCompletion(note, isCompleted)}
          open={Boolean(viewingNote)}
          pendingItemId={
            taskCompletionMutation.isPending &&
            taskCompletionMutation.variables?.id === viewingNoteId
              ? (viewingNoteId ?? undefined)
              : pendingItemId
          }
        />
        <AlertDialog
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) setDeletingNote(null);
          }}
          open={Boolean(deletingNote)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingNote
                  ? `“${deletingNote.title}” será excluída permanentemente. Essa ação não pode ser desfeita.`
                  : "Essa ação não pode ser desfeita."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => void removeNote()}
                variant="destructive"
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </ProtectedRoute>
  );
}

function NotesEmptyState({
  hasSearch,
  onClearSearch,
  onCreate,
  status,
}: {
  hasSearch: boolean;
  onClearSearch: () => void;
  onCreate: () => void;
  status: NoteStatus;
}) {
  return (
    <Card className="grid min-h-52 place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {hasSearch ? (
            <FileSearch aria-hidden="true" className="size-5" />
          ) : (
            <ListChecks aria-hidden="true" className="size-5" />
          )}
        </span>
        <p className="mt-4 font-medium">
          {hasSearch
            ? "Nenhuma anotação corresponde à busca"
            : status === "archived"
              ? "Nenhuma anotação arquivada"
              : "Sua área de anotações está vazia"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {hasSearch
            ? "Tente outro termo de busca."
            : status === "archived"
              ? "Quando você arquivar uma anotação, ela aparecerá aqui em modo somente leitura."
              : "Crie uma nota para registrar contexto ou uma lista para acompanhar tarefas."}
        </p>
        {hasSearch ? (
          <Button className="mt-4" onClick={onClearSearch} size="sm" variant="outline">
            Limpar busca
          </Button>
        ) : status === "active" ? (
          <Button className="mt-4" onClick={onCreate} size="sm">
            <Plus aria-hidden="true" />
            Criar primeira anotação
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function NotesSkeleton() {
  return (
    <div
      aria-label="Carregando anotações"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      role="status"
    >
      {skeletonKeys.map((key) => (
        <Card className="p-5" key={key}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-32" />
        </Card>
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
