import type {
  ArchiveNoteInput,
  CreateNoteInput,
  ListNotesQuery,
  NoteOutput,
  NotesPageOutput,
  ReplaceNoteInput,
  SetNoteItemCompletionInput,
  SetTaskCompletionInput,
} from "@openmonetis/validators/notes";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class NotesApiError extends ApiClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "NotesApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message }) => new NotesApiError(message, code),
    useResponseMessage: true,
  });
}

export function getNotes(query: ListNotesQuery, signal?: AbortSignal) {
  const search = new URLSearchParams({
    status: query.status,
    limit: String(query.limit),
    offset: String(query.offset),
  });
  if (query.kind) search.set("kind", query.kind);
  if (query.q) search.set("q", query.q);
  return request<NotesPageOutput>(`/notes?${search.toString()}`, { signal });
}

export function getNote(id: string) {
  return request<NoteOutput>(`/notes/${id}`);
}

export function createNote(input: CreateNoteInput) {
  return request<NoteOutput>("/notes", { method: "POST", body: JSON.stringify(input) });
}

export function replaceNote(id: string, input: ReplaceNoteInput) {
  return request<NoteOutput>(`/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function archiveNote(id: string, input: ArchiveNoteInput) {
  return request<NoteOutput>(`/notes/${id}/archive`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setNoteItemCompletion(
  noteId: string,
  itemId: string,
  input: SetNoteItemCompletionInput,
) {
  return request<NoteOutput>(`/notes/${noteId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setTaskCompletion(id: string, input: SetTaskCompletionInput) {
  return request<NoteOutput>(`/notes/${id}/completion`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteNote(id: string, expectedVersion: number) {
  return request<{ id: string }>(`/notes/${id}?expectedVersion=${expectedVersion}`, {
    method: "DELETE",
  });
}
