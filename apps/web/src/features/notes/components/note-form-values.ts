import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";

import type { NoteFormValues } from "./note-form.types";

export function initialValues(note?: NoteOutput | null): NoteFormValues {
  return {
    title: note?.title ?? "",
    kind: note?.kind ?? "text",
    content: note?.content ?? "",
    dueDate: note?.dueDate ?? "",
    isCompleted: note?.isCompleted ?? false,
    items:
      note?.items.map((item) => ({
        formKey: item.id,
        id: item.id,
        text: item.text,
        isCompleted: item.isCompleted,
      })) ?? [],
  };
}

export function normalizeItemText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildInput(
  values: NoteFormValues,
  note?: NoteOutput | null,
): CreateNoteInput | ReplaceNoteInput | Record<string, unknown> {
  if (values.kind === "text") {
    return note
      ? {
          expectedVersion: note.version,
          title: values.title,
          kind: values.kind,
          content: values.content,
        }
      : { title: values.title, kind: values.kind, content: values.content };
  }

  if (values.kind === "task") {
    return note
      ? {
          expectedVersion: note.version,
          title: values.title,
          kind: values.kind,
          content: values.content.trim() || null,
          dueDate: values.dueDate,
          isCompleted: values.isCompleted,
        }
      : {
          title: values.title,
          kind: values.kind,
          content: values.content.trim() || null,
          dueDate: values.dueDate,
        };
  }

  return note
    ? {
        expectedVersion: note.version,
        title: values.title,
        kind: values.kind,
        items: values.items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          text: item.text,
          isCompleted: item.isCompleted,
        })),
      }
    : {
        title: values.title,
        kind: values.kind,
        items: values.items.map((item) => ({ text: item.text })),
      };
}
