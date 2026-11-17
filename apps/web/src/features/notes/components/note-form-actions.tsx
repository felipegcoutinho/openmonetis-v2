import { FormActions } from "@/components/forms/form-actions";
import type { useNoteForm } from "../useNoteForm";

import type { NoteFormProps } from "./note-form.types";

export function NoteFormActions({
  onCancel,
  isEditing,
  form,
}: {
  onCancel: NoteFormProps["onCancel"];
  isEditing: ReturnType<typeof useNoteForm>["isEditing"];
  form: ReturnType<typeof useNoteForm>["form"];
}) {
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <FormActions
          busy={isSubmitting}
          onCancel={onCancel}
          submitLabel={isEditing ? "Atualizar" : "Salvar anotação"}
        />
      )}
    </form.Subscribe>
  );
}
