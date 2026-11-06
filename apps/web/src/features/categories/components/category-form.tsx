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
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { categoryTypeLabels, getCategoryErrorMessage } from "../categories.presentation";
import { categoriesQueryOptions } from "../categories.queries";
import { CategoryIconPicker } from "./category-icon-picker";

export function CategoryForm({
  category,
  defaultType = "expense",
  lockType = false,
  onCancel,
  onSubmit,
}: {
  category?: CategoryOutput | null;
  defaultType?: CreateCategoryInput["type"];
  lockType?: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateCategoryInput | ReplaceCategoryInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(category);
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const categories = categoriesQuery.data ?? [];
  const hasChildren = categories.some((item) => item.parentId === category?.id);
  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? defaultType,
      icon: category?.icon ?? "tag",
      parentId: category?.parentId ?? "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const result = (editing ? ReplaceCategoryInputSchema : CreateCategoryInputSchema).safeParse({
        ...value,
        parentId: value.parentId || null,
      });
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      } catch (error) {
        const message = getCategoryErrorMessage(error);
        setError(message);
        toast.error(message);
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
            <Label className="font-mono" htmlFor={`${id}-name`}>
              Nome
            </Label>
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
            <Label className="font-mono" htmlFor={`${id}-type`}>
              Tipo da categoria
            </Label>
            <Select
              disabled={hasChildren || lockType}
              onValueChange={(value) => {
                if (value) {
                  field.handleChange(value);
                  form.setFieldValue("parentId", "");
                }
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
            {lockType ? (
              <p className="text-muted-foreground text-xs">O tipo acompanha o lançamento.</p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.type}>
        {(type) => (
          <form.Field name="parentId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-parent`}>
                  Categoria principal
                </Label>
                <Select
                  disabled={hasChildren || categoriesQuery.isPending || categoriesQuery.isError}
                  value={field.state.value || "root"}
                  onValueChange={(value) => {
                    if (value) field.handleChange(value === "root" ? "" : value);
                  }}
                >
                  <SelectTrigger className="w-full" id={`${id}-parent`}>
                    <SelectValue>
                      {categories.find((item) => item.id === field.state.value)?.name ??
                        "Nenhuma — categoria principal"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Nenhuma — categoria principal</SelectItem>
                    {categories
                      .filter(
                        (item) =>
                          !item.parentId &&
                          !item.isSystem &&
                          item.type === type &&
                          item.id !== category?.id,
                      )
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {categoriesQuery.isError
                    ? "Não foi possível carregar as categorias principais."
                    : hasChildren
                      ? "Mova as subcategorias antes de alterar o tipo ou a categoria principal."
                      : editing
                        ? "Trocar o grupo também reorganiza os lançamentos anteriores nos relatórios."
                        : "Escolha um grupo para transformar este cadastro em uma subcategoria."}
                </p>
              </div>
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <form.Field name="icon">
        {(field) => (
          <div className="grid gap-1.5">
            <Label className="font-mono" htmlFor={`${id}-icon`}>
              Ícone
            </Label>
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
          <div data-mobile-form-actions className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
            <Button
              data-mobile-cancel
              disabled={submitting}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
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
