import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import {
  CreateCategoryInputSchema,
  ReplaceCategoryInputSchema,
} from "@openmonetis/validators/categories";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { categoryTypeLabels } from "../categories.presentation";
import { CategoryIconPicker } from "./category-icon-picker";

export function CategoryForm({
  category,
  defaultType = "expense",
  onCancel,
  onSubmit,
}: {
  category?: CategoryOutput | null;
  defaultType?: CreateCategoryInput["type"];
  onCancel: () => void;
  onSubmit: (input: CreateCategoryInput | ReplaceCategoryInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(category);
  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? defaultType,
      icon: category?.icon ?? "tag",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const result = (editing ? ReplaceCategoryInputSchema : CreateCategoryInputSchema).safeParse(
        value,
      );
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      } catch {
        setError("Não foi possível salvar.");
        toast.error("Não foi possível salvar.");
      }
    },
  });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="name"
        validators={{
          onBlur: ({ value }) =>
            CreateCategoryInputSchema.shape.name.safeParse(value).success
              ? undefined
              : "Informe o nome.",
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>Nome</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              id={`${id}-name`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Ex.: Alimentação"
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs" role="alert">
                {field.state.meta.errors[0]}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field name="type">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-type`}>Tipo da categoria</Label>
            <Select
              onValueChange={(value) => {
                if (value) field.handleChange(value);
              }}
              value={field.state.value}
            >
              <SelectTrigger className="w-full" id={`${id}-type`}>
                <SelectValue>
                  <TypeOption type={field.state.value} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">
                  <TypeOption type="income" />
                </SelectItem>
                <SelectItem value="expense">
                  <TypeOption type="expense" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Field name="icon">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-icon`}>Ícone</Label>
            <CategoryIconPicker
              id={`${id}-icon`}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
            <Button disabled={submitting} onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "Salvando..." : editing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
function TypeOption({ type }: { type: CategoryOutput["type"] }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`size-2 rounded-full ${type === "income" ? "bg-emerald-500" : "bg-destructive"}`}
      />
      <span>{categoryTypeLabels[type]}</span>
    </span>
  );
}
