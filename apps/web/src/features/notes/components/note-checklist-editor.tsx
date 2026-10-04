import {
  CreateNoteInputSchema,
  noteItemsMaximumCount,
  noteItemTextMaximumLength,
} from "@openmonetis/validators/notes";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { noteCompletionCheckboxClassName } from "../notes.presentation";
import type { useNoteForm } from "../useNoteForm";

import { FieldError } from "./note-field-error";

export function NoteChecklistEditor({
  newItemText,
  setNewItemText,
  isEditing,
  form,
  fieldId,
  addItem,
}: {
  newItemText: ReturnType<typeof useNoteForm>["newItemText"];
  setNewItemText: ReturnType<typeof useNoteForm>["setNewItemText"];
  isEditing: ReturnType<typeof useNoteForm>["isEditing"];
  form: ReturnType<typeof useNoteForm>["form"];
  fieldId: ReturnType<typeof useNoteForm>["fieldId"];
  addItem: ReturnType<typeof useNoteForm>["addItem"];
}) {
  return (
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
              <ListChecks aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
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
  );
}
