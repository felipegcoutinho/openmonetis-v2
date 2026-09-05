import { z } from "@hono/zod-openapi";
import {
  noteContentMaximumLength,
  noteItemsMaximumCount,
  noteItemTextMaximumLength,
  noteKinds,
  noteTitleMaximumLength,
} from "@openmonetis/domain/notes";

export {
  noteContentMaximumLength,
  noteItemsMaximumCount,
  noteItemTextMaximumLength,
  noteKinds,
  noteTitleMaximumLength,
} from "@openmonetis/domain/notes";

const NoteTitleSchema = z.string().trim().min(1).max(noteTitleMaximumLength);
const NoteContentSchema = z.string().trim().min(1).max(noteContentMaximumLength);
const NoteItemTextSchema = z.string().trim().min(1).max(noteItemTextMaximumLength);

const CreateChecklistItemInputSchema = z.object({ text: NoteItemTextSchema }).strict();
const ReplaceChecklistItemInputSchema = z
  .object({
    id: z.uuid().optional(),
    text: NoteItemTextSchema,
    isCompleted: z.boolean(),
  })
  .strict();

const CreateTextNoteInputSchema = z
  .object({
    title: NoteTitleSchema,
    kind: z.literal("text"),
    content: NoteContentSchema,
  })
  .strict();

const CreateChecklistNoteInputSchema = z
  .object({
    title: NoteTitleSchema,
    kind: z.literal("checklist"),
    items: z.array(CreateChecklistItemInputSchema).min(1).max(noteItemsMaximumCount),
  })
  .strict();

const ReplaceTextNoteInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: NoteTitleSchema,
    kind: z.literal("text"),
    content: NoteContentSchema,
  })
  .strict();

const ReplaceChecklistNoteInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: NoteTitleSchema,
    kind: z.literal("checklist"),
    items: z.array(ReplaceChecklistItemInputSchema).min(1).max(noteItemsMaximumCount),
  })
  .strict();

export const CreateNoteInputSchema = z
  .discriminatedUnion("kind", [CreateTextNoteInputSchema, CreateChecklistNoteInputSchema])
  .openapi("CreateNoteInput");

export const ReplaceNoteInputSchema = z
  .discriminatedUnion("kind", [ReplaceTextNoteInputSchema, ReplaceChecklistNoteInputSchema])
  .refine(
    (input) =>
      input.kind === "text" ||
      new Set(input.items.flatMap((item) => (item.id ? [item.id] : []))).size ===
        input.items.filter((item) => item.id).length,
    "Checklist item IDs must be unique",
  )
  .openapi("ReplaceNoteInput");

export const ArchiveNoteInputSchema = z
  .object({ isArchived: z.boolean() })
  .strict()
  .openapi("ArchiveNoteInput");

export const SetNoteItemCompletionInputSchema = z
  .object({ isCompleted: z.boolean() })
  .strict()
  .openapi("SetNoteItemCompletionInput");

export const ListNotesQuerySchema = z
  .object({
    status: z.enum(["active", "archived", "all"]).default("active"),
    kind: z.enum(noteKinds).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .openapi("ListNotesQuery");

export const DeleteNoteQuerySchema = z
  .object({ expectedVersion: z.coerce.number().int().positive() })
  .openapi("DeleteNoteQuery");

export const NoteParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("NoteParams");

export const NoteItemParamsSchema = z
  .object({
    noteId: z.uuid().openapi({ param: { name: "noteId", in: "path" } }),
    itemId: z.uuid().openapi({ param: { name: "itemId", in: "path" } }),
  })
  .openapi("NoteItemParams");

export const NoteItemOutputSchema = z
  .object({
    id: z.uuid(),
    text: z.string(),
    isCompleted: z.boolean(),
    position: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("NoteItem");

export const NoteOutputSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    kind: z.enum(noteKinds),
    content: z.string().nullable(),
    isArchived: z.boolean(),
    items: z.array(NoteItemOutputSchema),
    totalItemCount: z.number().int().nonnegative(),
    completedItemCount: z.number().int().nonnegative(),
    completionPercentage: z.number().int().min(0).max(100),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Note");

export const NotesPageOutputSchema = z
  .object({
    items: z.array(NoteOutputSchema),
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .openapi("NotesPage");

export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;
export type ReplaceNoteInput = z.infer<typeof ReplaceNoteInputSchema>;
export type ArchiveNoteInput = z.infer<typeof ArchiveNoteInputSchema>;
export type SetNoteItemCompletionInput = z.infer<typeof SetNoteItemCompletionInputSchema>;
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;
export type DeleteNoteQuery = z.infer<typeof DeleteNoteQuerySchema>;
export type NoteOutput = z.infer<typeof NoteOutputSchema>;
export type NotesPageOutput = z.infer<typeof NotesPageOutputSchema>;
