import {
  CreateNoteInputSchema,
  noteContentMaximumLength,
  noteTitleMaximumLength,
} from "@openmonetis/validators/notes";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNoteForm } from "../useNoteForm";
import { NoteChecklistEditor } from "./note-checklist-editor";
import { FieldError } from "./note-field-error";
import type { NoteFormProps } from "./note-form.types";
import { NoteFormActions } from "./note-form-actions";
import { NoteKindField } from "./note-kind-field";
import { NoteTaskFields } from "./note-task-fields";

export type { NoteFormHandle } from "./note-form.types";

export function NoteForm({ note, onCancel, onSubmit, ref }: NoteFormProps) {
  const { newItemText, setNewItemText, submissionError, isEditing, form, fieldId, addItem } =
    useNoteForm({ note, onCancel, onSubmit, ref });
  return (
    <form
      data-mobile-page-form
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden"
      noValidate
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          if (form.state.isSubmitting) return;
          void form.handleSubmit();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (form.state.isSubmitting) return;
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <div
        data-mobile-form-body
        className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain px-2 py-1"
      >
        <NoteKindField note={note} form={form} fieldId={fieldId} />

        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) => {
              const parsed = CreateNoteInputSchema.safeParse({
                title: value,
                kind: "text",
                content: "Conteúdo válido",
              });
              return parsed.success ? undefined : "Informe um título válido.";
            },
          }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={fieldId(field.name)}>Título</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {field.state.value.length}/{noteTitleMaximumLength}
                </span>
              </div>
              <Input
                aria-invalid={!field.state.meta.isValid}
                autoFocus
                id={fieldId(field.name)}
                maxLength={noteTitleMaximumLength}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Decisões para o próximo mês"
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.kind}>
          {(kind) =>
            kind === "text" ? (
              <form.Field
                name="content"
                validators={{
                  onBlur: ({ value }) => {
                    const parsed = CreateNoteInputSchema.safeParse({
                      title: "Título válido",
                      kind: "text",
                      content: value,
                    });
                    return parsed.success ? undefined : "Escreva o conteúdo da nota.";
                  },
                }}
              >
                {(field) => (
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={fieldId(field.name)}>Conteúdo</Label>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {field.state.value.length}/{noteContentMaximumLength}
                      </span>
                    </div>
                    <Textarea
                      aria-invalid={!field.state.meta.isValid}
                      className="min-h-44 resize-y"
                      id={fieldId(field.name)}
                      maxLength={noteContentMaximumLength}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Registre o contexto, decisões ou informações que você quer consultar depois."
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>
            ) : kind === "checklist" ? (
              <NoteChecklistEditor
                newItemText={newItemText}
                setNewItemText={setNewItemText}
                isEditing={isEditing}
                form={form}
                fieldId={fieldId}
                addItem={addItem}
              />
            ) : (
              <NoteTaskFields isEditing={isEditing} form={form} fieldId={fieldId} />
            )
          }
        </form.Subscribe>
      </div>

      {submissionError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm" role="alert">
          {submissionError}
        </p>
      ) : null}

      <NoteFormActions onCancel={onCancel} isEditing={isEditing} form={form} />
    </form>
  );
}
