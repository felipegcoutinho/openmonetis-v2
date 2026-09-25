import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type { AdjustInvoiceInput } from "@openmonetis/validators/invoices";
import { AdjustInvoiceInputSchema } from "@openmonetis/validators/invoices";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, parseCurrencyInput } from "@/features/accounts/accounts.presentation";
import { InvoicesApiError } from "../invoices.api";

type Props = {
  cardName: string;
  currentAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: AdjustInvoiceInput) => Promise<void>;
  people: PersonOutput[];
  period: string;
};

export function AdjustInvoiceDialog({
  cardName,
  currentAmount,
  open,
  onOpenChange,
  onSubmit,
  people,
  period,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar fatura</DialogTitle>
          <DialogDescription>
            Informe o total correto. A diferença aumentará ou reduzirá as despesas da fatura.
          </DialogDescription>
        </DialogHeader>
        <AdjustInvoiceForm
          key={`${period}:${open ? "open" : "closed"}`}
          cardName={cardName}
          currentAmount={currentAmount}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          people={people}
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
  people,
  period,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      amount: formatCurrency(currentAmount),
      date: getEntryDate(period),
      personId: people.find((person) => person.role === "admin")?.id ?? people[0]?.id ?? "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = AdjustInvoiceInputSchema.safeParse({
        amount: parseCurrencyInput(value.amount),
        date: value.date,
        personId: value.personId,
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
            : submissionError instanceof InvoicesApiError &&
                submissionError.code === "invoice_requires_reopen"
              ? "Reabra a fatura antes de fazer o ajuste."
              : submissionError instanceof InvoicesApiError &&
                  submissionError.code === "invoice_adjustment_exceeds_person_amount"
                ? "A redução é maior que o valor atribuído a essa pessoa."
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
      <form.Field name="personId">
        {(field) => {
          const selectedPerson = people.find((person) => person.id === field.state.value);
          return (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-person`}>Pessoa responsável</Label>
              <Select
                onValueChange={(value) => value && field.handleChange(value)}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={`${id}-person`}>
                  <SelectValue placeholder="Selecione uma pessoa">
                    <PersonOption person={selectedPerson} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      <PersonOption person={person} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }}
      </form.Field>
      <form.Field name="date">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Data do ajuste</Label>
            <DatePicker
              id={`${id}-date`}
              max={getMaximumEntryDate(period)}
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

function PersonOption({ person }: { person?: PersonOutput }) {
  if (!person) return <span>Selecione uma pessoa</span>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarImage alt="" src={person.avatarUrl ?? person.providerAvatarUrl ?? undefined} />
        <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
      </Avatar>
      <span className="truncate">{person.name}</span>
    </span>
  );
}

function getEntryDate(period: string) {
  const today = getCurrentDateInBrazil();
  return today.startsWith(period) ? today : getMaximumEntryDate(period);
}

function getMaximumEntryDate(period: string) {
  const today = getCurrentDateInBrazil();
  const periodEnd = getPeriodEndDateString(period);
  return periodEnd < today ? periodEnd : today;
}
