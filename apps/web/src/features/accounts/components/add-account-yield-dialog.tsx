import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type { AccountOutput, AddAccountYieldInput } from "@openmonetis/validators/accounts";
import { AddAccountYieldInputSchema } from "@openmonetis/validators/accounts";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsApiError } from "../accounts.api";
import { formatCurrency, parseCurrencyInput } from "../accounts.presentation";

type Props = {
  account: AccountOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AddAccountYieldInput) => Promise<void>;
  period: string;
};

export function AddAccountYieldDialog({ account, open, onOpenChange, onSubmit, period }: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar rendimento</DialogTitle>
          <DialogDescription>
            Informe o rendimento recebido ou o saldo que aparece na conta real.
          </DialogDescription>
        </DialogHeader>
        <AddAccountYieldForm
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

function AddAccountYieldForm({
  account,
  onCancel,
  onSubmit,
  period,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      mode: "amount" as "amount" | "currentBalance",
      amount: "",
      balance: "",
      date: getEntryDate(period),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = AddAccountYieldInputSchema.safeParse(
        value.mode === "amount"
          ? { mode: value.mode, amount: parseCurrencyInput(value.amount), date: value.date }
          : { mode: value.mode, balance: parseCurrencyInput(value.balance), date: value.date },
      );
      if (!result.success) {
        setError("Informe um valor válido.");
        return;
      }
      try {
        await onSubmit(result.data);
      } catch (submissionError) {
        setError(
          submissionError instanceof AccountsApiError &&
            submissionError.code === "positive_yield_required"
            ? "O saldo real precisa ser maior que o saldo atual."
            : "Não foi possível adicionar o rendimento.",
        );
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
          Saldo atual: {formatCurrency(account.summary.balance)}
        </p>
      </div>
      <form.Field name="mode">
        {(field) => (
          <Tabs
            aria-label="Forma de informar o rendimento"
            className="gap-0"
            onValueChange={(value) =>
              value && field.handleChange(value as typeof field.state.value)
            }
            value={field.state.value}
          >
            <TabsList className="grid grid-cols-2" variant="line">
              <TabsTrigger className="w-full" value="amount">
                Valor do rendimento
              </TabsTrigger>
              <TabsTrigger className="w-full" value="currentBalance">
                Saldo da conta real
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.mode}>
        {(mode) =>
          mode === "amount" ? (
            <form.Field name="amount">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-amount`}>Valor do rendimento</Label>
                  <CurrencyInput
                    id={`${id}-amount`}
                    onValueChange={field.handleChange}
                    value={field.state.value}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}
            </form.Field>
          ) : (
            <form.Field name="balance">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-balance`}>Saldo atual na conta real</Label>
                  <CurrencyInput
                    allowNegative
                    id={`${id}-balance`}
                    onValueChange={field.handleChange}
                    value={field.state.value}
                    placeholder="R$ 0,00"
                  />
                  <p className="text-muted-foreground text-xs">
                    O rendimento será calculado pela diferença entre os dois saldos.
                  </p>
                </div>
              )}
            </form.Field>
          )
        }
      </form.Subscribe>
      <form.Field name="date">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Data do rendimento</Label>
            <DatePicker
              id={`${id}-date`}
              max={getPeriodEndDateString(period)}
              min={`${period}-01`}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <DialogFooter>
            <Button data-mobile-cancel onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "Adicionando..." : "Adicionar rendimento"}
            </Button>
          </DialogFooter>
        )}
      </form.Subscribe>
    </form>
  );
}

function getEntryDate(period: string) {
  const today = getCurrentDateInBrazil();
  return today.startsWith(period) ? today : getPeriodEndDateString(period);
}
