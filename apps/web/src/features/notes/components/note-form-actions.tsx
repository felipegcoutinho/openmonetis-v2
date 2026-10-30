import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
    <div
      data-mobile-form-actions
      className="flex w-full items-center justify-end gap-2 border-t pt-4"
    >
      <p className="mr-auto hidden items-center gap-1.5 text-muted-foreground text-xs sm:flex">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
        para salvar
      </p>
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
