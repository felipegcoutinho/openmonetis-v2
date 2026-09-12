export const noteKinds = ["text", "checklist", "task"] as const;

export type NoteKind = (typeof noteKinds)[number];

export const noteTitleMaximumLength = 120;
export const noteContentMaximumLength = 5_000;
export const noteItemTextMaximumLength = 300;
export const noteItemsMaximumCount = 100;

export type NoteItemDraft = {
  id?: string;
  userId: string;
  text: string;
  isCompleted: boolean;
  position: number;
};

export type NoteAggregateDraft = {
  note: {
    userId: string;
    title: string;
    kind: NoteKind;
    content: string | null;
    dueDate: string | null;
    isCompleted: boolean;
  };
  items: NoteItemDraft[];
};

export type NoteRuleCode =
  | "invalid_note_title"
  | "invalid_note_content"
  | "invalid_note_due_date"
  | "invalid_note_items"
  | "note_kind_mismatch";

export class NoteRuleError extends Error {
  readonly code: NoteRuleCode;

  constructor(code: NoteRuleCode, message: string) {
    super(message);
    this.name = "NoteRuleError";
    this.code = code;
  }
}

type TextNoteInput = {
  kind: "text";
  content: string;
};

type ChecklistNoteInput = {
  kind: "checklist";
  items: Array<{ id?: string; text: string; isCompleted?: boolean }>;
};

type TaskNoteInput = {
  kind: "task";
  content?: string | null;
  dueDate: string;
  isCompleted?: boolean;
};

export type CreateNoteAggregateInput = {
  userId: string;
  title: string;
} & (TextNoteInput | ChecklistNoteInput | TaskNoteInput);

export type ReplaceNoteAggregateInput = CreateNoteAggregateInput & {
  currentKind: NoteKind;
};

export function createNoteAggregateDraft(input: CreateNoteAggregateInput): NoteAggregateDraft {
  return buildNoteAggregateDraft(input, false);
}

export function replaceNoteAggregateDraft(input: ReplaceNoteAggregateInput): NoteAggregateDraft {
  if (input.kind !== input.currentKind) {
    throw new NoteRuleError("note_kind_mismatch", "A note kind cannot be changed");
  }

  return buildNoteAggregateDraft(input, true);
}

export function calculateChecklistProgress(items: Array<{ isCompleted: boolean }>) {
  const totalItemCount = items.length;
  const completedItemCount = items.reduce((total, item) => total + Number(item.isCompleted), 0);
  const completionPercentage =
    totalItemCount === 0 ? 0 : Math.round((completedItemCount / totalItemCount) * 100);

  return { totalItemCount, completedItemCount, completionPercentage };
}

export function sortNoteItemsByCompletion<T extends { isCompleted: boolean; position: number }>(
  items: readonly T[],
) {
  return [...items].sort(
    (left, right) =>
      Number(left.isCompleted) - Number(right.isCompleted) || left.position - right.position,
  );
}

function buildNoteAggregateDraft(
  input: CreateNoteAggregateInput,
  allowExistingItemIds: boolean,
): NoteAggregateDraft {
  const title = normalizeSingleLine(input.title);

  if (!title || title.length > noteTitleMaximumLength) {
    throw new NoteRuleError("invalid_note_title", "A note title is required and must be valid");
  }

  if (input.kind === "text") {
    const content = input.content.trim();

    if (!content || content.length > noteContentMaximumLength) {
      throw new NoteRuleError("invalid_note_content", "Text notes require valid content");
    }

    return {
      note: {
        userId: input.userId,
        title,
        kind: input.kind,
        content,
        dueDate: null,
        isCompleted: false,
      },
      items: [],
    };
  }

  if (input.kind === "task") {
    const content = input.content?.trim() || null;
    if (content && content.length > noteContentMaximumLength) {
      throw new NoteRuleError("invalid_note_content", "Task notes require valid content");
    }
    if (!isValidCalendarDate(input.dueDate)) {
      throw new NoteRuleError("invalid_note_due_date", "Task notes require a valid due date");
    }

    return {
      note: {
        userId: input.userId,
        title,
        kind: input.kind,
        content,
        dueDate: input.dueDate,
        isCompleted: input.isCompleted ?? false,
      },
      items: [],
    };
  }

  if (input.items.length === 0 || input.items.length > noteItemsMaximumCount) {
    throw new NoteRuleError("invalid_note_items", "Checklists require a valid number of items");
  }

  const existingItemIds = input.items.flatMap((item) => (item.id ? [item.id] : []));
  if (
    (!allowExistingItemIds && existingItemIds.length > 0) ||
    new Set(existingItemIds).size !== existingItemIds.length
  ) {
    throw new NoteRuleError("invalid_note_items", "Checklist item IDs must be valid and unique");
  }

  const items = input.items.map((item, position) => {
    const text = normalizeSingleLine(item.text);

    if (!text || text.length > noteItemTextMaximumLength) {
      throw new NoteRuleError("invalid_note_items", "Checklist items must have valid text");
    }

    return {
      ...(item.id ? { id: item.id } : {}),
      userId: input.userId,
      text,
      isCompleted: item.isCompleted ?? false,
      position,
    };
  });

  return {
    note: {
      userId: input.userId,
      title,
      kind: input.kind,
      content: null,
      dueDate: null,
      isCompleted: false,
    },
    items,
  };
}

function normalizeSingleLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
