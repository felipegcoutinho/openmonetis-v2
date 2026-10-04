import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type { AccountOutput, AdjustAccountBalanceInput } from "@openmonetis/validators/accounts";
import { AdjustAccountBalanceInputSchema } from "@openmonetis/validators/accounts";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatAccountPeriod, formatCurrency, parseCurrencyInput } from "../accounts.presentation";
import { AccountBalanceAdjustmentPreview } from "./account-balance-adjustment-preview";

type Props = {
  account: AccountOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AdjustAccountBalanceInput) => Promise<void>;
  period: string;
};

export function AdjustAccountBalanceDialog({
  account,
  open,
  onOpenChange,
  onSubmit,
  period,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent guarded mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>
            Informe o saldo correto. A diferença será registrada como um lançamento.
          </DialogDescription>
        </DialogHeader>
        <AdjustAccountBalanceForm
          key={`${period}:${open ? "open" : "closed"}`}
          account={account}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          period={period}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdjustAccountBalanceForm({
  account,
  onCancel,
  onSubmit,
  period,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      balance: formatCurrency(account.summary.balance),
      date: getAdjustmentDate(period),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = AdjustAccountBalanceInputSchema.safeParse({
        balance: parseCurrencyInput(value.balance),
        date: value.date,
      });
      if (!result.success) {
        setError("Revise os campos.");
        return;
      }
      try {
        await onSubmit(result.data);
      } catch {
        setError("Não foi possível ajustar o saldo.");
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
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <div className="rounded-md border bg-muted/40 px-3 py-2">
        <p className="font-medium text-sm">{account.name}</p>
        <p className="text-muted-foreground text-xs">
          Saldo acumulado até {formatAccountPeriod(period)}:{" "}
          {formatCurrency(account.summary.balance)}
        </p>
      </div>
      <form.Field name="balance">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-balance`}>Saldo correto</Label>
            <CurrencyInput
              allowNegative
              id={`${id}-balance`}
              value={field.state.value}
              onValueChange={field.handleChange}
            />
            <p className="text-muted-foreground text-xs">
              A entrada ou saída necessária será calculada automaticamente.
            </p>
          </div>
        )}
      </form.Field>
      <form.Field name="date">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Data do ajuste</Label>
            <DatePicker
              id={`${id}-date`}
              max={getMaximumAdjustmentDate(period)}
              min={`${period}-01`}
              value={field.state.value}
              onChange={field.handleChange}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <AccountBalanceAdjustmentPreview
            accountId={account.id}
            input={{ balance: parseCurrencyInput(values.balance), date: values.date }}
          />
        )}
      </form.Subscribe>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <DialogFooter>
            <Button data-mobile-cancel type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "Ajustando..." : "Ajustar saldo"}
            </Button>
          </DialogFooter>
        )}
      </form.Subscribe>
    </form>
  );
}

function getAdjustmentDate(period: string) {
  const today = getCurrentDateInBrazil();
  if (today.startsWith(period)) return today;

  return getMaximumAdjustmentDate(period);
}

function getMaximumAdjustmentDate(period: string) {
  const today = getCurrentDateInBrazil();
  const periodEnd = getPeriodEndDateString(period);
  return periodEnd < today ? periodEnd : today;
}
