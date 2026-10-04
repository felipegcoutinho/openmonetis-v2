import {
  CreateNoteInputSchema,
  noteItemsMaximumCount,
  noteItemTextMaximumLength,
  ReplaceNoteInputSchema,
} from "@openmonetis/validators/notes";
import { useForm } from "@tanstack/react-form";

import { useId, useImperativeHandle, useState } from "react";
import { toast } from "sonner";

import { showInvalidFormToast } from "@/lib/form-feedback";
import type { NoteFormProps } from "./components/note-form.types";
import { buildInput, initialValues, normalizeItemText } from "./components/note-form-values";
import { NotesApiError } from "./notes.api";

export function useNoteForm({ note, onSubmit, ref }: NoteFormProps) {
  const idPrefix = useId();
  const [newItemText, setNewItemText] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = Boolean(note);
  const form = useForm({
    defaultValues: initialValues(note),
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmissionError(null);
      const pendingItemText = normalizeItemText(newItemText);
      if (
        value.kind === "checklist" &&
        pendingItemText &&
        value.items.length >= noteItemsMaximumCount
      ) {
        setSubmissionError(`Uma lista pode ter até ${noteItemsMaximumCount} itens.`);
        return;
      }
      const submittedValue =
        value.kind === "checklist" && pendingItemText
          ? {
              ...value,
              items: [
                ...value.items,
                { formKey: crypto.randomUUID(), text: pendingItemText, isCompleted: false },
              ],
            }
          : value;
      if (submittedValue !== value) {
        form.setFieldValue("items", submittedValue.items);
        setNewItemText("");
      }
      const rawInput = buildInput(submittedValue, note);
      const parsed = isEditing
        ? ReplaceNoteInputSchema.safeParse(rawInput)
        : CreateNoteInputSchema.safeParse(rawInput);

      if (!parsed.success) {
        showInvalidFormToast();
        return;
      }

      try {
        await onSubmit(parsed.data);
        toast.success(isEditing ? "Anotação atualizada" : "Anotação criada");
      } catch (error) {
        const message =
          error instanceof NotesApiError && error.code === "note_version_conflict"
            ? "Esta anotação mudou em outro lugar. Reabra e tente novamente."
            : "Não foi possível salvar a anotação.";
        setSubmissionError(message);
        toast.error(message);
      }
    },
  });
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => form.state.isDirty || Boolean(newItemText.trim()),
  }));
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  function addItem() {
    const text = normalizeItemText(newItemText);
    if (!text) return;
    if (text.length > noteItemTextMaximumLength) {
      setSubmissionError(`Cada item pode ter até ${noteItemTextMaximumLength} caracteres.`);
      return;
    }
    const items = form.getFieldValue("items");
    if (items.length >= noteItemsMaximumCount) {
      setSubmissionError(`Uma lista pode ter até ${noteItemsMaximumCount} itens.`);
      return;
    }
    form.setFieldValue("items", [
      ...items,
      { formKey: crypto.randomUUID(), text, isCompleted: false },
    ]);
    setNewItemText("");
    setSubmissionError(null);
  }

  return { newItemText, setNewItemText, submissionError, isEditing, form, fieldId, addItem };
}

export type NoteFormApi = ReturnType<typeof useNoteForm>["form"];
