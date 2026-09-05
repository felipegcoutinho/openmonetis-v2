import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";
import {
  CreateNoteInputSchema,
  noteContentMaximumLength,
  noteItemsMaximumCount,
  noteItemTextMaximumLength,
  noteTitleMaximumLength,
  ReplaceNoteInputSchema,
} from "@openmonetis/validators/notes";
import { useForm } from "@tanstack/react-form";
import { Check, FileText, ListChecks, Plus, Trash2 } from "lucide-react";
import { type Ref, useId, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import { NotesApiError } from "../notes.api";
import { noteKindLabels, noteKindOptions } from "../notes.presentation";

type NoteFormItem = {
  formKey: string;
  id?: string;
  text: string;
  isCompleted: boolean;
};

type NoteFormValues = {
  title: string;
  kind: NoteOutput["kind"];
  content: string;
  items: NoteFormItem[];
};

type NoteFormProps = {
  note?: NoteOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateNoteInput | ReplaceNoteInput) => Promise<void>;
  ref?: Ref<NoteFormHandle>;
};

export type NoteFormHandle = {
  hasUnsavedChanges: () => boolean;
};

function initialValues(note?: NoteOutput | null): NoteFormValues {
  return {
    title: note?.title ?? "",
    kind: note?.kind ?? "text",
    content: note?.content ?? "",
    items:
      note?.items.map((item) => ({
        formKey: item.id,
        id: item.id,
        text: item.text,
        isCompleted: item.isCompleted,
      })) ?? [],
  };
}

function FieldError({ errors }: { errors: unknown[] }) {
  const message = errors.find((error): error is string => typeof error === "string");
  return message ? (
    <p aria-live="polite" className="sr-only" role="alert">
      {message}
    </p>
  ) : null;
}

export function NoteForm({ note, onCancel, onSubmit, ref }: NoteFormProps) {
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

  return (
    <form
      className="grid gap-5"
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
      {note ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
          {note.kind === "text" ? (
            <FileText aria-hidden="true" className="size-4 text-brand-strong" />
          ) : (
            <ListChecks aria-hidden="true" className="size-4 text-brand-strong" />
          )}
          <span className="text-muted-foreground text-sm">Tipo</span>
          <Badge className="ml-auto" variant="outline">
            {noteKindLabels[note.kind]}
          </Badge>
        </div>
      ) : (
        <form.Field name="kind">
          {(field) => (
            <fieldset className="grid gap-2">
              <Label htmlFor={fieldId(field.name)}>Tipo de anotação</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {noteKindOptions.map((option) => {
                  const selected = field.state.value === option.value;
                  const Icon = option.value === "text" ? FileText : ListChecks;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-brand-strong bg-brand/5"
                          : "border-border hover:bg-muted/50",
                      )}
                      key={option.value}
                      onClick={() => field.handleChange(option.value)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
                          selected ? "bg-brand text-brand-foreground" : "bg-muted",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="grid gap-0.5">
                        <span className="font-medium text-sm">{option.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {option.description.map((line) => (
                            <span className="block" key={line}>
                              {line}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </form.Field>
      )}

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
          ) : (
            <form.Field mode="array" name="items">
              {(itemsField) => (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={fieldId("new-item")}>Novo item</Label>
                    <div className="flex gap-2">
                      <Input
                        id={fieldId("new-item")}
                        maxLength={noteItemTextMaximumLength}
                        onChange={(event) => setNewItemText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addItem();
                          }
                        }}
                        placeholder="Digite e pressione Enter"
                        value={newItemText}
                      />
                      <Button
                        aria-label="Adicionar item"
                        disabled={!newItemText.trim()}
                        onClick={addItem}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {itemsField.state.value.length > 0 ? (
                    <div className="grid gap-2 rounded-lg border p-2">
                      {itemsField.state.value.map((item, index) => (
                        <div
                          className="flex items-center gap-2 rounded-md bg-muted/35 p-2"
                          key={item.formKey}
                        >
                          {isEditing ? (
                            <form.Field name={`items[${index}].isCompleted`}>
                              {(completedField) => (
                                <Checkbox
                                  aria-label={`Marcar ${item.text || `item ${index + 1}`} como ${completedField.state.value ? "pendente" : "concluído"}`}
                                  checked={completedField.state.value}
                                  onCheckedChange={(checked) =>
                                    completedField.handleChange(checked === true)
                                  }
                                />
                              )}
                            </form.Field>
                          ) : (
                            <span className="grid size-4 shrink-0 place-items-center rounded-full border text-transparent">
                              <Check aria-hidden="true" className="size-3" />
                            </span>
                          )}
                          <form.Field
                            name={`items[${index}].text`}
                            validators={{
                              onBlur: ({ value }) => {
                                const parsed = CreateNoteInputSchema.safeParse({
                                  title: "Título válido",
                                  kind: "checklist",
                                  items: [{ text: value }],
                                });
                                return parsed.success ? undefined : "Informe o texto do item.";
                              },
                            }}
                          >
                            {(textField) => (
                              <div className="grid min-w-0 flex-1 gap-1">
                                <Input
                                  aria-invalid={!textField.state.meta.isValid}
                                  aria-label={`Texto do item ${index + 1}`}
                                  className={cn(
                                    "h-8 border-0 bg-transparent shadow-none focus-visible:bg-popover",
                                    item.isCompleted && "text-muted-foreground line-through",
                                  )}
                                  maxLength={noteItemTextMaximumLength}
                                  onBlur={textField.handleBlur}
                                  onChange={(event) => textField.handleChange(event.target.value)}
                                  value={textField.state.value}
                                />
                                <FieldError errors={textField.state.meta.errors} />
                              </div>
                            )}
                          </form.Field>
                          <Button
                            aria-label={`Remover item ${index + 1}`}
                            onClick={() => itemsField.removeValue(index)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 aria-hidden="true" className="text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                      <ListChecks
                        aria-hidden="true"
                        className="mx-auto size-5 text-muted-foreground"
                      />
                      <p className="mt-2 text-muted-foreground text-sm">
                        Adicione o primeiro item da lista.
                      </p>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {itemsField.state.value.length}/{noteItemsMaximumCount} itens
                  </p>
                </div>
              )}
            </form.Field>
          )
        }
      </form.Subscribe>

      {submissionError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm" role="alert">
          {submissionError}
        </p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-2 *:w-full">
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
    </form>
  );
}

function normalizeItemText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildInput(
  values: NoteFormValues,
  note?: NoteOutput | null,
): CreateNoteInput | ReplaceNoteInput | Record<string, unknown> {
  if (values.kind === "text") {
    return note
      ? {
          expectedVersion: note.version,
          title: values.title,
          kind: values.kind,
          content: values.content,
        }
      : { title: values.title, kind: values.kind, content: values.content };
  }

  return note
    ? {
        expectedVersion: note.version,
        title: values.title,
        kind: values.kind,
        items: values.items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          text: item.text,
          isCompleted: item.isCompleted,
        })),
      }
    : {
        title: values.title,
        kind: values.kind,
        items: values.items.map((item) => ({ text: item.text })),
      };
}
