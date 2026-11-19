import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";

import type { Ref } from "react";

export type NoteFormItem = {
  formKey: string;
  id?: string;
  text: string;
  isCompleted: boolean;
};

export type NoteFormValues = {
  title: string;
  kind: NoteOutput["kind"];
  content: string;
  dueDate: string;
  isCompleted: boolean;
  items: NoteFormItem[];
};

export type NoteFormProps = {
  note?: NoteOutput | null;
  onCancel: () => void;
  /** Pending files are only sent when creating; existing notes save attachments immediately. */
  onSubmit: (
    input: CreateNoteInput | ReplaceNoteInput,
    pendingFiles: File[],
  ) => Promise<NoteSubmitResult | undefined>;
  ref?: Ref<NoteFormHandle>;
};

export type NoteSubmitResult = {
  failedUploadCount: number;
};

export type NoteFormHandle = {
  hasUnsavedChanges: () => boolean;
};
