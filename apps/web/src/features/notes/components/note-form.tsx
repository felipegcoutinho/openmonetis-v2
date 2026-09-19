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
import { CalendarCheck2, Check, FileText, ListChecks, Plus, Trash2 } from "lucide-react";
import { type Ref, useId, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import { NotesApiError } from "../notes.api";
import {
  noteCompletionCheckboxClassName,
  noteKindLabels,
  noteKindOptions,
} from "../notes.presentation";

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
  dueDate: string;
  isCompleted: boolean;
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
    dueDate: note?.dueDate ?? "",
    isCompleted: note?.isCompleted ?? false,
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
    <p aria-live="polite" className="text-destructive text-xs" role="alert">
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
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain px-2 py-1">
        {note ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
            {note.kind === "text" ? (
              <FileText aria-hidden="true" className="size-4 text-brand-strong" />
            ) : note.kind === "checklist" ? (
              <ListChecks aria-hidden="true" className="size-4 text-brand-strong" />
            ) : (
              <CalendarCheck2 aria-hidden="true" className="size-4 text-brand-strong" />
            )}
            <span className="text-muted-foreground text-sm">Tipo</span>
            <Badge className="ml-auto" variant="outline">
              {noteKindLabels[note.kind]}
            </Badge>
          </div>
        ) : (
          <form.Field name="kind">
            {(field) => (
              <fieldset>
                <legend className="mb-1.5 font-medium text-sm leading-none">
                  Tipo de anotação
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {noteKindOptions.map((option) => {
                    const selected = field.state.value === option.value;
                    const optionId = `${fieldId(field.name)}-${option.value}`;
                    const Icon =
                      option.value === "text"
                        ? FileText
                        : option.value === "checklist"
                          ? ListChecks
                          : CalendarCheck2;
                    return (
                      <label className="group cursor-pointer" htmlFor={optionId} key={option.value}>
                        <input
                          checked={selected}
                          className="peer sr-only"
                          id={optionId}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={() => field.handleChange(option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span
                          className={cn(
                            "flex h-full items-start rounded-xl border border-border bg-background p-3 text-left transition-[border-color,background-color,box-shadow] group-hover:border-brand-strong/40 group-hover:bg-brand/5 peer-focus-visible:outline-none peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                            selected &&
                              "border-brand-strong/50 bg-brand/10 ring-1 ring-brand-strong/20 group-hover:border-brand-strong/60 group-hover:bg-brand/10",
                          )}
                        >
                          <span className="grid min-w-0 flex-1 gap-1">
                            <span className="flex items-center gap-1.5 font-semibold text-sm">
                              <Icon
                                aria-hidden="true"
                                className={cn(
                                  "size-3.5 shrink-0 text-muted-foreground transition-colors",
                                  selected && "text-brand-strong",
                                )}
                              />
                              <span>{option.label}</span>
                            </span>
                            <span className="text-muted-foreground text-xs leading-relaxed">
                              {option.description}
                            </span>
                          </span>
                        </span>
                      </label>
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
            ) : kind === "checklist" ? (
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
                      <div className="grid gap-1.5 rounded-lg border p-2">
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
                                    className={noteCompletionCheckboxClassName}
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
                                  <Textarea
                                    aria-invalid={!textField.state.meta.isValid}
                                    aria-label={`Texto do item ${index + 1}`}
                                    className={cn(
                                      "min-h-8 resize-none overflow-hidden border-0 bg-transparent py-1.5 shadow-none focus-visible:bg-popover",
                                      item.isCompleted && "text-muted-foreground line-through",
                                    )}
                                    maxLength={noteItemTextMaximumLength}
                                    onBlur={textField.handleBlur}
                                    onChange={(event) => textField.handleChange(event.target.value)}
                                    rows={1}
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
            ) : (
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
            )
          }
        </form.Subscribe>
      </div>

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

  if (values.kind === "task") {
    return note
      ? {
          expectedVersion: note.version,
          title: values.title,
          kind: values.kind,
          content: values.content.trim() || null,
          dueDate: values.dueDate,
          isCompleted: values.isCompleted,
        }
      : {
          title: values.title,
          kind: values.kind,
          content: values.content.trim() || null,
          dueDate: values.dueDate,
        };
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
