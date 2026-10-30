import {
  type CreateTagInput,
  CreateTagInputSchema,
  type TagOutput,
} from "@openmonetis/validators/tags";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import { getTagErrorMessage, tagColorOptions, tagColorTokens } from "../tags.presentation";
import { TagColorIcon } from "./tag-color-icon";
export function TagForm({
  tag,
  onSubmit,
  onCancel,
}: {
  tag: TagOutput | null;
  onSubmit: (input: CreateTagInput) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { name: tag?.name ?? "", color: tag?.color ?? "neutral" },
    validators: { onSubmit: CreateTagInputSchema.required() },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await onSubmit(CreateTagInputSchema.parse(value));
        toast.success(tag ? "Etiqueta atualizada" : "Etiqueta criada");
      } catch (cause) {
        setError(getTagErrorMessage(cause));
      }
    },
  });
  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <form.Field name="name">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={id}>Nome</Label>
            <Input
              autoFocus
              id={id}
              maxLength={80}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Ex.: Viagem"
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.length ? (
              <p className="text-destructive text-sm" role="alert">
                Informe um nome com até 80 caracteres.
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field name="color">
        {(field) => (
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm leading-none">Cor</legend>
            <div className="flex flex-wrap gap-2">
              {tagColorOptions.map((option) => {
                const selected = field.state.value === option.value;
                return (
                  <label
                    className="cursor-pointer"
                    htmlFor={`${id}-color-${option.value}`}
                    key={option.value}
                    title={option.label}
                  >
                    <input
                      checked={selected}
                      className="peer sr-only"
                      id={`${id}-color-${option.value}`}
                      name={field.name}
                      onChange={() => field.handleChange(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span className="sr-only">{option.label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                        selected && "ring-2 ring-foreground/70",
                      )}
                      style={{
                        backgroundColor: `color-mix(in srgb, ${tagColorTokens[option.value]} 18%, transparent)`,
                      }}
                    >
                      <TagColorIcon color={option.value} />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div data-mobile-form-actions className="grid grid-cols-2 gap-2">
            <Button
              data-mobile-cancel
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
