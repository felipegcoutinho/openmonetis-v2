import { Button } from "@/components/ui/button";
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
    <div data-mobile-form-actions className="grid w-full grid-cols-2 gap-2 *:w-full">
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar anotação"}
            </Button>
          </>
        )}
      </form.Subscribe>
    </div>
  );
}
