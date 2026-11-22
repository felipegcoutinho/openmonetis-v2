import type {
  BudgetOutput,
  CreateBudgetInput,
  UpdateBudgetInput,
  UpdateBudgetRuleInput,
} from "@openmonetis/validators/budgets";
import {
  CreateBudgetInputSchema,
  UpdateBudgetInputSchema,
  UpdateBudgetRuleInputSchema,
} from "@openmonetis/validators/budgets";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { PeriodPicker } from "@/components/period-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { CategoryIcon } from "@/features/categories/category-icons";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { formatBudgetPeriod, getBudgetRuleScopeOptions } from "../budgets.presentation";

export type BudgetDialogSubmission =
  | { kind: "create"; input: CreateBudgetInput }
  | { kind: "update"; input: UpdateBudgetInput }
  | { kind: "updateRule"; ruleId: string; input: UpdateBudgetRuleInput };

type BudgetDialogProps = {
  budget: BudgetOutput | null;
  initialCategoryId?: string;
  categories: CategoryOutput[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (submission: BudgetDialogSubmission) => Promise<void>;
  open: boolean;
  period: string;
};

function parseSubmission(
  budget: BudgetOutput | null,
  value: {
    categoryId: string;
    amount: string;
    period: string;
    repeatMonthly: boolean;
    scope: UpdateBudgetRuleInput["scope"];
  },
): BudgetDialogSubmission | null {
  const amount = Number(value.amount);
  if (budget?.recurrence) {
    const result = UpdateBudgetRuleInputSchema.safeParse({
      scope: value.scope,
      period: budget.period,
      amount,
    });
    return result.success
      ? { kind: "updateRule", ruleId: budget.recurrence.ruleId, input: result.data }
      : null;
  }
  if (budget) {
    const result = UpdateBudgetInputSchema.safeParse({ amount, period: value.period });
    return result.success ? { kind: "update", input: result.data } : null;
  }
  const result = CreateBudgetInputSchema.safeParse({
    categoryId: value.categoryId,
    period: value.period,
    amount,
    repeatMonthly: value.repeatMonthly,
  });
  return result.success ? { kind: "create", input: result.data } : null;
}

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
  const recurring = Boolean(budget?.recurrence);
  const form = useForm({
    defaultValues: {
      categoryId: budget?.categoryId ?? initialCategoryId ?? "",
      amount: budget ? String(budget.amount) : "",
      period: budget?.period ?? period,
      // Budgets are usually a monthly habit, so new ones repeat unless turned off.
      repeatMonthly: true,
      scope: "future" as UpdateBudgetRuleInput["scope"],
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const submission = parseSubmission(budget, value);
      if (!submission) {
        showInvalidFormToast();
        return;
      }

      try {
        await onSubmit(submission);
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
      <DialogContent guarded>
        <DialogHeader>
          <DialogTitle>{editing ? "Atualizar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>
            {recurring
              ? "Este limite se repete todo mês. Escolha até onde a mudança vale."
              : editing
                ? "Ajuste o limite mensal desta categoria."
                : "Defina quanto pretende gastar nesta categoria por mês."}
          </DialogDescription>
        </DialogHeader>

        <form
          data-mobile-page-form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => <MobileFormState {...state} />}
          </form.Subscribe>
          <form.Field name="categoryId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-category`}>Categoria de despesa</Label>
                {editing && budget ? (
                  <output
                    className="flex items-center gap-2 text-foreground text-sm"
                    id={`${id}-category`}
                  >
                    <CategoryIcon
                      className="size-4 shrink-0 text-muted-foreground"
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

          {recurring ? null : (
            <form.Subscribe selector={(state) => state.values.repeatMonthly}>
              {(repeatMonthly) => {
                const repeats = !editing && repeatMonthly;
                return (
                  <form.Field name="period">
                    {(field) => (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-period`}>
                          {repeats ? "A partir de" : "Mês do orçamento"}
                        </Label>
                        <PeriodPicker
                          id={`${id}-period`}
                          onChange={field.handleChange}
                          value={field.state.value}
                        />
                        <p className="text-muted-foreground text-xs">
                          {repeats
                            ? "Primeiro mês do limite. Depois dá para ajustar um mês específico."
                            : "Vale só para o mês escolhido."}
                        </p>
                      </div>
                    )}
                  </form.Field>
                );
              }}
            </form.Subscribe>
          )}

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
                <Label htmlFor={`${id}-amount`}>
                  {recurring
                    ? `Limite em ${formatBudgetPeriod(period).toLocaleLowerCase("pt-BR")}`
                    : "Limite mensal"}
                </Label>
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

          {editing ? null : (
            <form.Field name="repeatMonthly">
              {(field) => (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-input bg-field p-3">
                  <Label className="grid gap-0.5 font-normal" htmlFor={`${id}-repeat`}>
                    <span className="font-medium text-sm">Repetir todo mês</span>
                    <span className="text-muted-foreground text-xs">
                      {field.state.value
                        ? "O limite vale também para os próximos meses."
                        : "O limite vale só para o mês escolhido."}
                    </span>
                  </Label>
                  <Switch
                    checked={field.state.value}
                    className="mt-0.5 shrink-0"
                    id={`${id}-repeat`}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            </form.Field>
          )}

          {recurring ? (
            <form.Field name="scope">
              {(field) => (
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm">Aplicar a mudança</legend>
                  <RadioGroup
                    className="grid gap-2"
                    onValueChange={(value) =>
                      field.handleChange(value as UpdateBudgetRuleInput["scope"])
                    }
                    value={field.state.value}
                  >
                    {getBudgetRuleScopeOptions(period).map((option) => (
                      <Label
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-field p-3 transition-colors hover:border-input-hover has-data-checked:border-brand-strong has-data-checked:bg-accent"
                        htmlFor={`${id}-scope-${option.scope}`}
                        key={option.scope}
                      >
                        <RadioGroupItem
                          className="mt-0.5"
                          id={`${id}-scope-${option.scope}`}
                          value={option.scope}
                        />
                        <span className="grid gap-0.5">
                          <span className="font-medium text-sm">{option.label}</span>
                          <span className="font-normal text-muted-foreground text-xs">
                            {option.description}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}
            </form.Field>
          ) : null}

          {submitError ? (
            <p className="text-destructive text-sm" role="alert">
              {submitError}
            </p>
          ) : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <FormActions
                busy={submitting}
                onCancel={() => onOpenChange(false)}
                submitLabel={editing ? "Atualizar" : "Salvar orçamento"}
              />
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
      <span className="truncate">{getCategoryLabel(category)}</span>
    </span>
  );
}
