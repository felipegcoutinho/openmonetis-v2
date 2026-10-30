import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import { CreateNoteInputSchema, noteContentMaximumLength } from "@openmonetis/validators/notes";
import { FieldError } from "@/components/forms/field-error";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDaysToDateOnly, noteCompletionCheckboxClassName } from "../notes.presentation";
import type { useNoteForm } from "../useNoteForm";
import { NoteCharacterCount } from "./note-character-count";

const quickDueDates = [
  { label: "Hoje", days: 0 },
  { label: "Amanhã", days: 1 },
  { label: "Em 7 dias", days: 7 },
] as const;

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
            <div className="flex flex-wrap gap-1.5">
              {quickDueDates.map((option) => {
                const date = addDaysToDateOnly(getCurrentDateInBrazil(), option.days);
                return (
                  <Button
                    aria-pressed={field.state.value === date}
                    className="aria-pressed:border-brand-strong/50 aria-pressed:bg-brand/10"
                    key={option.label}
                    onClick={() => field.handleChange(date)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field name="content">
        {(field) => (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={fieldId("task-content")}>Detalhes (opcional)</Label>
              <NoteCharacterCount
                length={field.state.value.length}
                maximum={noteContentMaximumLength}
              />
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
