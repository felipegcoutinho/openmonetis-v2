import { cn } from "@/lib/utils";
import { noteKindIcons, noteKindOptions } from "../notes.presentation";
import type { useNoteForm } from "../useNoteForm";
import type { NoteFormProps } from "./note-form.types";

/** The kind is chosen once, on creation; editing shows it in the dialog title instead. */
export function NoteKindField({
  note,
  form,
  fieldId,
}: {
  note: NoteFormProps["note"];
  form: ReturnType<typeof useNoteForm>["form"];
  fieldId: ReturnType<typeof useNoteForm>["fieldId"];
}) {
  if (note) return null;

  return (
    <form.Field name="kind">
      {(field) => {
        const selectedOption = noteKindOptions.find((option) => option.value === field.state.value);
        return (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Tipo de anotação</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {noteKindOptions.map((option) => {
                const selected = field.state.value === option.value;
                const optionId = `${fieldId(field.name)}-${option.value}`;
                const Icon = noteKindIcons[option.value];
                return (
                  <label className="group cursor-pointer" htmlFor={optionId} key={option.value}>
                    <input
                      aria-describedby={selected ? fieldId("kind-description") : undefined}
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
                        "flex h-9 items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground text-sm transition-[background-color,color,box-shadow] group-hover:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                        selected && "bg-background text-foreground shadow-sm",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn("size-4 shrink-0", selected && "text-brand-strong")}
                      />
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs" id={fieldId("kind-description")}>
              {selectedOption?.description}
            </p>
          </fieldset>
        );
      }}
    </form.Field>
  );
}
