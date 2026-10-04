import { CalendarCheck2, FileText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { noteKindLabels, noteKindOptions } from "../notes.presentation";
import type { useNoteForm } from "../useNoteForm";
import type { NoteFormProps } from "./note-form.types";

export function NoteKindField({
  note,
  form,
  fieldId,
}: {
  note: NoteFormProps["note"];
  form: ReturnType<typeof useNoteForm>["form"];
  fieldId: ReturnType<typeof useNoteForm>["fieldId"];
}) {
  return (
    <>
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
              <legend className="mb-1.5 font-medium text-sm leading-none">Tipo de anotação</legend>
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
    </>
  );
}
