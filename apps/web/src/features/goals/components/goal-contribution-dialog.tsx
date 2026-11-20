import {
  type GoalContributionMovement,
  goalContributionMovements,
} from "@openmonetis/domain/goals";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import { CreateGoalContributionInputSchema, type GoalOutput } from "@openmonetis/validators/goals";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { useCreateGoalContributionMutation } from "../goals.mutations";
import { getGoalContributionErrorMessage, goalContributionKindLabels } from "../goals.presentation";

const selectedToggleClass =
  "data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90";

const amountSchema = CreateGoalContributionInputSchema.shape.amount;

export function GoalContributionDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal: GoalOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const today = getCurrentDateInBrazil();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreateGoalContributionMutation();
  const form = useForm({
    defaultValues: {
      movement: "deposit" as GoalContributionMovement,
      amount: "",
      date: today,
      note: "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = CreateGoalContributionInputSchema.safeParse({
        movement: value.movement,
        amount: Number(value.amount),
        date: value.date,
        note: value.note.trim() || null,
      });
      if (!parsed.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await mutation.mutateAsync({ id: goal.id, input: parsed.data });
        toast.success(
          parsed.data.movement === "deposit" ? "Aporte registrado" : "Retirada registrada",
        );
        onOpenChange(false);
      } catch (error) {
        setSubmitError(getGoalContributionErrorMessage(error));
      }
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded>
        <DialogHeader>
          <DialogTitle>Movimentar meta</DialogTitle>
          <DialogDescription>
            {goal.name} · saldo de <MoneyValue amount={goal.currentAmount} />
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
          <form.Field name="movement">
            {(field) => (
              <fieldset className="grid gap-2">
                <legend className="mb-2 font-mono text-muted-foreground text-xs">Tipo</legend>
                <ToggleGroup
                  className="grid w-full grid-cols-2"
                  onValueChange={(value) => {
                    const next = value[0] as GoalContributionMovement | undefined;
                    if (next) field.handleChange(next);
                  }}
                  size="sm"
                  spacing={1}
                  value={[field.state.value]}
                  variant="outline"
                >
                  {goalContributionMovements.map((movement) => (
                    <ToggleGroupItem
                      className={`w-full px-2 ${selectedToggleClass}`}
                      key={movement}
                      value={movement}
                    >
                      {goalContributionKindLabels[movement]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </fieldset>
            )}
          </form.Field>
          <form.Field
            name="amount"
            validators={{
              // onChange (not onBlur): picking the suggested amount blurs the empty field first,
              // and a blur error would stick until the next blur.
              onChange: ({ value }) =>
                amountSchema.safeParse(Number(value || 0)).success
                  ? undefined
                  : "Informe um valor maior que zero.",
              onSubmit: ({ value }) =>
                amountSchema.safeParse(Number(value || 0)).success
                  ? undefined
                  : "Informe um valor maior que zero.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-amount`}>
                  Valor
                </Label>
                <CurrencyInput
                  aria-invalid={field.state.meta.errors.length > 0}
                  autoFocus
                  id={`${id}-amount`}
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-destructive text-xs" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
                {goal.requiredMonthlyAmount ? (
                  <form.Subscribe selector={(state) => state.values.movement}>
                    {(movement) =>
                      movement === "deposit" ? (
                        <Button
                          className="justify-self-start text-muted-foreground"
                          onClick={() => field.handleChange(String(goal.requiredMonthlyAmount))}
                          size="xs"
                          type="button"
                          variant="ghost"
                        >
                          Usar o valor do mês:{" "}
                          <MoneyValue
                            amount={goal.requiredMonthlyAmount ?? 0}
                            className="text-foreground"
                          />
                        </Button>
                      ) : null
                    }
                  </form.Subscribe>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field
            name="date"
            validators={{
              onSubmit: ({ value }) =>
                !value
                  ? "Informe a data."
                  : value > today
                    ? "Use hoje ou uma data anterior."
                    : undefined,
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-date`}>
                  Data
                </Label>
                <DatePicker
                  aria-invalid={field.state.meta.errors.length > 0}
                  id={`${id}-date`}
                  max={today}
                  onChange={field.handleChange}
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
          <form.Field name="note">
            {(field) => (
              <div className="grid gap-1.5">
                <Label className="font-mono" htmlFor={`${id}-note`}>
                  Observação <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id={`${id}-note`}
                  maxLength={240}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
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
              <div data-mobile-form-actions className="grid grid-cols-2 gap-2">
                <Button
                  data-mobile-cancel
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? "Salvando…" : "Registrar"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
