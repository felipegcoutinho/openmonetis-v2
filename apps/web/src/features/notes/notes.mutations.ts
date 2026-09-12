import type {
  CreateNoteInput,
  NoteOutput,
  NotesPageOutput,
  ReplaceNoteInput,
} from "@openmonetis/validators/notes";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "@/features/notifications/notifications.queries";
import {
  archiveNote,
  createNote,
  deleteNote,
  replaceNote,
  setNoteItemCompletion,
  setTaskCompletion,
} from "./notes.api";
import { noteKeys } from "./notes.queries";

export function useCreateNoteMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNoteInput) => createNote(input),
    onSuccess: (note) => {
      client.setQueryData(noteKeys.detail(note.id), note);
      return invalidateNoteCollections(client);
    },
  });
}

export function useReplaceNoteMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplaceNoteInput }) => replaceNote(id, input),
    onError: (_error, variables) =>
      Promise.all([
        client.invalidateQueries({ queryKey: noteKeys.lists() }),
        client.invalidateQueries({ queryKey: noteKeys.detail(variables.id) }),
      ]),
    onSuccess: (note) => {
      client.setQueryData(noteKeys.detail(note.id), note);
      return invalidateNoteCollections(client);
    },
  });
}

export function useArchiveNoteMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      archiveNote(id, { isArchived }),
    onSuccess: (note) => {
      client.setQueryData(noteKeys.detail(note.id), note);
      return invalidateNoteCollections(client);
    },
  });
}

export function useSetNoteItemCompletionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      itemId,
      isCompleted,
    }: {
      noteId: string;
      itemId: string;
      isCompleted: boolean;
    }) => setNoteItemCompletion(noteId, itemId, { isCompleted }),
    onSuccess: (note) => {
      client.setQueryData(noteKeys.detail(note.id), note);
      client.setQueryData<NotesPageOutput>(noteKeys.dashboard(), (current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === note.id ? note : item)) }
          : current,
      );
      client.setQueriesData<NotesInfiniteData>({ queryKey: noteKeys.lists() }, (current) =>
        current
          ? mapCachedNotes(current, (candidate) => (candidate.id === note.id ? note : candidate))
          : current,
      );
    },
    onSettled: (_note, _error, variables) => {
      void client.invalidateQueries({ queryKey: noteKeys.lists() });
      void client.invalidateQueries({ queryKey: noteKeys.dashboard() });
      void client.invalidateQueries({ queryKey: noteKeys.detail(variables.noteId) });
    },
  });
}

export function useSetTaskCompletionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      setTaskCompletion(id, { isCompleted }),
    onSuccess: (note) => {
      client.setQueryData(noteKeys.detail(note.id), note);
      client.setQueryData<NotesPageOutput>(noteKeys.dashboard(), (current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === note.id ? note : item)) }
          : current,
      );
      client.setQueriesData<NotesInfiniteData>({ queryKey: noteKeys.lists() }, (current) =>
        current
          ? mapCachedNotes(current, (candidate) => (candidate.id === note.id ? note : candidate))
          : current,
      );
    },
    onSettled: (_note, _error, variables) => {
      void client.invalidateQueries({ queryKey: noteKeys.lists() });
      void client.invalidateQueries({ queryKey: noteKeys.dashboard() });
      void client.invalidateQueries({ queryKey: noteKeys.detail(variables.id) });
      void client.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNoteMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
      deleteNote(id, expectedVersion),
    onError: () => client.invalidateQueries({ queryKey: noteKeys.lists() }),
    onSuccess: (_deleted, variables) => {
      client.removeQueries({ queryKey: noteKeys.detail(variables.id) });
      return invalidateNoteCollections(client);
    },
  });
}

type NotesInfiniteData = InfiniteData<NotesPageOutput, number>;

function mapCachedNotes(data: NotesInfiniteData, update: (note: NoteOutput) => NoteOutput) {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map(update),
    })),
  };
}

function invalidateNoteCollections(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: noteKeys.lists() }),
    client.invalidateQueries({ queryKey: noteKeys.dashboard() }),
    client.invalidateQueries({ queryKey: notificationKeys.all }),
  ]);
}
