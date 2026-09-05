import type { ListNotesQuery } from "@openmonetis/validators/notes";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { getNote, getNotes } from "./notes.api";

type NotesListFilters = Omit<ListNotesQuery, "offset">;

export const noteKeys = {
  all: ["notes"] as const,
  dashboard: () => [...noteKeys.all, "dashboard"] as const,
  lists: () => [...noteKeys.all, "list"] as const,
  list: (filters: NotesListFilters) => [...noteKeys.lists(), filters] as const,
  detail: (id: string) => [...noteKeys.all, "detail", id] as const,
};

export function notesDashboardQueryOptions() {
  return queryOptions({
    queryKey: noteKeys.dashboard(),
    queryFn: ({ signal }) => getNotes({ status: "active", limit: 5, offset: 0 }, signal),
  });
}

export function notesInfiniteQueryOptions(filters: NotesListFilters) {
  return infiniteQueryOptions({
    queryKey: noteKeys.list(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => getNotes({ ...filters, offset: pageParam }, signal),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((total, page) => total + page.items.length, 0) : undefined,
  });
}

export function noteQueryOptions(id: string) {
  return queryOptions({ queryKey: noteKeys.detail(id), queryFn: () => getNote(id) });
}
