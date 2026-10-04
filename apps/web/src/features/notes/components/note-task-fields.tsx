import { CreateNoteInputSchema, noteContentMaximumLength } from "@openmonetis/validators/notes";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { noteCompletionCheckboxClassName } from "../notes.presentation";
import type { useNoteForm } from "../useNoteForm";

import { FieldError } from "./note-field-error";

export function NoteTaskFields({
  isEditing,
  form,
  fieldId,
}: {
  isEditing: ReturnType<typeof useNoteForm>["isEditing"];
  form: ReturnType<typeof useNoteForm>["form"];
  fieldId: ReturnType<typeof useNoteForm>["fieldId"];
}) {
  return (
    <div className="grid gap-4">
      <form.Field
        name="dueDate"
        validators={{
          onBlur: ({ value }) => {
            const parsed = CreateNoteInputSchema.safeParse({
              title: "Título válido",
              kind: "task",
              dueDate: value,
            });
            return parsed.success ? undefined : "Informe a data da tarefa.";
          },
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId(field.name)}>Data da tarefa</Label>
            <DatePicker
              aria-invalid={!field.state.meta.isValid}
              id={fieldId(field.name)}
              onChange={field.handleChange}
              placeholder="Selecione a data"
              value={field.state.value}
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="content">
        {(field) => (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={fieldId("task-content")}>Detalhes (opcional)</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {field.state.value.length}/{noteContentMaximumLength}
              </span>
            </div>
            <Textarea
              className="min-h-28 resize-y"
              id={fieldId("task-content")}
              maxLength={noteContentMaximumLength}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Adicione contexto para concluir esta tarefa."
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>

      {isEditing ? (
        <form.Field name="isCompleted">
          {(field) => (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"
              htmlFor={fieldId(field.name)}
            >
              <Checkbox
                checked={field.state.value}
                className={noteCompletionCheckboxClassName}
                id={fieldId(field.name)}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <span>
                <span className="block font-medium">Tarefa concluída</span>
                <span className="block text-muted-foreground text-xs">
                  Tarefas concluídas deixam de aparecer na Central de atenção.
                </span>
              </span>
            </label>
          )}
        </form.Field>
      ) : null}
    </div>
  );
}
