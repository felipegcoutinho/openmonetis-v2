import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { AdjustInvoiceInput } from "@openmonetis/validators/invoices";
import { AdjustInvoiceInputSchema } from "@openmonetis/validators/invoices";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency, parseCurrencyInput } from "@/features/accounts/accounts.presentation";
import { InvoicesApiError } from "../invoices.api";

type Props = {
  cardName: string;
  currentAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AdjustInvoiceInput) => Promise<void>;
  period: string;
};

export function AdjustInvoiceDialog({
  cardName,
  currentAmount,
  open,
  onOpenChange,
  onSubmit,
  period,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar fatura</DialogTitle>
          <DialogDescription>
            Informe o total correto. A diferença será lançada como receita ou despesa.
          </DialogDescription>
        </DialogHeader>
        <AdjustInvoiceForm
          key={`${period}:${open ? "open" : "closed"}`}
          cardName={cardName}
          currentAmount={currentAmount}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          period={period}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdjustInvoiceForm({
  cardName,
  currentAmount,
  onCancel,
  onSubmit,
  period,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      amount: formatCurrency(currentAmount),
      date: getEntryDate(period),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = AdjustInvoiceInputSchema.safeParse({
        amount: parseCurrencyInput(value.amount),
        date: value.date,
      });
      if (!result.success) {
        setError("Informe um valor válido.");
        return;
      }
      try {
        await onSubmit(result.data);
      } catch (submissionError) {
        setError(
          submissionError instanceof InvoicesApiError &&
            submissionError.code === "invoice_adjustment_below_paid_amount"
            ? "O novo valor não pode ser menor que o total já pago."
            : "Não foi possível ajustar a fatura.",
        );
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
      <div className="rounded-md border bg-muted/40 px-3 py-2">
        <p className="font-medium text-sm">{cardName}</p>
        <p className="text-muted-foreground text-xs">
          Valor atual: {formatCurrency(currentAmount)}
        </p>
      </div>
      <form.Field name="amount">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-amount`}>Novo valor da fatura</Label>
            <CurrencyInput
              id={`${id}-amount`}
              onValueChange={field.handleChange}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="date">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Data do ajuste</Label>
            <DatePicker
              id={`${id}-date`}
              max={getPeriodEndDate(period)}
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
            <Button onClick={onCancel} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "Ajustando..." : "Ajustar fatura"}
            </Button>
          </DialogFooter>
        )}
      </form.Subscribe>
    </form>
  );
}

function getEntryDate(period: string) {
  const today = getCurrentDateInBrazil();
  return today.startsWith(period) ? today : getPeriodEndDate(period);
}

function getPeriodEndDate(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
