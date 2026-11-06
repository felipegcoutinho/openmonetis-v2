import {
  type CategoryOutput,
  type CreateCategoryInput,
  CreateCategoryInputSchema,
} from "@openmonetis/validators/categories";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { getCategoryErrorMessage } from "../categories.presentation";

export function SubcategoryForm({
  parent,
  onCancel,
  onSubmit,
}: {
  parent: CategoryOutput;
  onCancel: () => void;
  onSubmit: (input: CreateCategoryInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: "",
      type: parent.type,
      parentId: parent.id,
      icon: parent.icon,
    } as CreateCategoryInput,
    validators: { onSubmit: CreateCategoryInputSchema },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await onSubmit(CreateCategoryInputSchema.parse(value));
        toast.success("Subcategoria criada");
        onCancel();
      } catch (error) {
        setError(getCategoryErrorMessage(error));
      }
    },
  });
  return (
    <form
      data-mobile-page-form
      className="grid gap-3 border-t pt-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{
          onBlur: ({ value }) =>
            CreateCategoryInputSchema.shape.name.safeParse(value).success
              ? undefined
              : "Informe um nome de até 120 caracteres.",
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label className="font-mono" htmlFor={id}>
              Nova subcategoria de <span className="font-sans">{parent.name}</span>
            </Label>
            <Input
              id={id}
              placeholder="Digite o nome da subcategoria"
              maxLength={120}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0}
              aria-describedby={error || field.state.meta.errors.length ? `${id}-error` : undefined}
            />
            {field.state.meta.errors.length > 0 ? (
              <p id={`${id}-error`} className="text-destructive text-xs" role="alert">
                Informe um nome de até 120 caracteres.
              </p>
            ) : error ? (
              <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Adicionar subcategoria"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
