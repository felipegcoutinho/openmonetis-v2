import type {
  BudgetOutput,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@openmonetis/validators/budgets";
import { CreateBudgetInputSchema, UpdateBudgetInputSchema } from "@openmonetis/validators/budgets";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { PeriodPicker } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/features/categories/category-icons";
import { showInvalidFormToast } from "@/lib/form-feedback";

type BudgetDialogProps = {
  budget: BudgetOutput | null;
  initialCategoryId?: string;
  categories: CategoryOutput[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateBudgetInput | UpdateBudgetInput) => Promise<void>;
  open: boolean;
  period: string;
};

export function BudgetDialog({
  budget,
  initialCategoryId,
  categories,
  onOpenChange,
  onSubmit,
  open,
  period,
}: BudgetDialogProps) {
  const id = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const editing = Boolean(budget);
  const form = useForm({
    defaultValues: {
      categoryId: budget?.categoryId ?? initialCategoryId ?? "",
      amount: budget ? String(budget.amount) : "",
      period: budget?.period ?? period,
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const amount = Number(value.amount);
      const result = editing
        ? UpdateBudgetInputSchema.safeParse({ amount, period: value.period })
        : CreateBudgetInputSchema.safeParse({
            categoryId: value.categoryId,
            period: value.period,
            amount,
          });

      if (!result.success) {
        showInvalidFormToast();
        return;
      }

      try {
        await onSubmit(result.data);
        onOpenChange(false);
      } catch {
        setSubmitError(
          editing
            ? "Não foi possível atualizar. A categoria pode já possuir um orçamento no mês escolhido."
            : "Não foi possível criar. A categoria pode já possuir um orçamento neste mês.",
        );
      }
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Atualizar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Ajuste o limite mensal desta categoria."
              : "Defina quanto pretende gastar nesta categoria durante o mês."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="categoryId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-category`}>Categoria de despesa</Label>
                {editing && budget ? (
                  <output
                    className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm"
                    id={`${id}-category`}
                  >
                    <CategoryIcon
                      className="size-4 text-muted-foreground"
                      name={budget.categoryIcon}
                    />
                    <span>{budget.categoryName}</span>
                  </output>
                ) : (
                  <Select
                    onValueChange={(value) => value && field.handleChange(value)}
                    value={field.state.value}
                  >
                    <SelectTrigger className="w-full" id={`${id}-category`}>
                      <SelectValue placeholder="Selecione">
                        {(value: string) =>
                          value ? (
                            <CategoryOption
                              category={categories.find((item) => item.id === value)}
                            />
                          ) : (
                            "Selecione"
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <CategoryOption category={category} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="period">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-period`}>Mês do orçamento</Label>
                <PeriodPicker
                  id={`${id}-period`}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
                <p className="text-muted-foreground text-xs">
                  Pré-selecionada conforme o mês da tela.
                </p>
              </div>
            )}
          </form.Field>

          <form.Field
            name="amount"
            validators={{
              onBlur: ({ value }) =>
                CreateBudgetInputSchema.shape.amount.safeParse(Number(value)).success
                  ? undefined
                  : "Informe um limite maior que zero.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-amount`}>Limite mensal</Label>
                <CurrencyInput
                  aria-invalid={field.state.meta.errors.length > 0}
                  id={`${id}-amount`}
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                />
                {field.state.meta.errors[0] ? (
                  <p className="sr-only" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          {submitError ? (
            <p className="text-destructive text-sm" role="alert">
              {submitError}
            </p>
          ) : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <div className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
                <Button
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}

function CategoryOption({ category }: { category?: CategoryOutput }) {
  if (!category) return null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CategoryIcon className="size-4 shrink-0 text-muted-foreground" name={category.icon} />
      <span className="truncate">{category.name}</span>
    </span>
  );
}
