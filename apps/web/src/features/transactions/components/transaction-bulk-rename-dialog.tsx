import {
  BulkRenameTransactionsInputSchema,
  type TransactionOutput,
} from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { MobileFormContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";

type RenameItem = { id: string; name: string };
type RenameValues = { name: string; overrides: Record<string, string> };

function toRenameItems(transactions: readonly TransactionOutput[], value: RenameValues) {
  return transactions.map((transaction) => {
    const id = transaction.recordId as string;
    return { id, name: value.overrides[id] ?? value.name };
  });
}

export function TransactionBulkRenameDialog({
  open,
  transactions,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  transactions: readonly TransactionOutput[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: RenameItem[]) => Promise<boolean>;
}) {
  const count = transactions.length;
  const plural = count === 1 ? "" : "s";

  return (
    <MobileFormDialog open={open} onOpenChange={onOpenChange}>
      <MobileFormContent guarded>
        <DialogHeader>
          <DialogTitle>Atualizar descrição</DialogTitle>
          <DialogDescription>
            A descrição será aplicada ao{plural} {count} lançamento{plural} selecionado{plural}.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TransactionBulkRenameForm
            onCancel={() => onOpenChange(false)}
            onSubmit={async (items) => {
              if (await onSubmit(items)) onOpenChange(false);
            }}
            transactions={transactions}
          />
        ) : null}
      </MobileFormContent>
    </MobileFormDialog>
  );
}

function TransactionBulkRenameForm({
  transactions,
  onCancel,
  onSubmit,
}: {
  transactions: readonly TransactionOutput[];
  onCancel: () => void;
  onSubmit: (items: RenameItem[]) => Promise<void>;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const count = transactions.length;
  const form = useForm({
    defaultValues: { name: "", overrides: {} } as RenameValues,
    validators: {
      onSubmit: ({ value }) =>
        BulkRenameTransactionsInputSchema.safeParse({ items: toRenameItems(transactions, value) })
          .success
          ? undefined
          : "invalid",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: ({ value }) => onSubmit(toRenameItems(transactions, value)),
  });

  return (
    <form
      className="grid gap-4"
      data-mobile-page-form
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
      <form.Subscribe selector={(state) => Boolean(state.errorMap.onSubmit)}>
        {(invalid) => (
          <>
            <form.Field name="name">
              {(field) => (
                <div className="grid gap-2">
                  <Label className="sr-only" htmlFor={id}>
                    Nova descrição
                  </Label>
                  <Input
                    aria-invalid={invalid}
                    autoFocus
                    id={id}
                    maxLength={160}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Nova descrição"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            {invalid ? (
              <p className="-mt-2 text-destructive text-sm" role="alert">
                Informe uma descrição para cada lançamento.
              </p>
            ) : null}
          </>
        )}
      </form.Subscribe>

      <div className="grid gap-2">
        <Button
          aria-expanded={expanded}
          className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => setExpanded((current) => !current)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {expanded ? "Ocultar lançamentos" : "Editar individualmente"}
          <ChevronDown
            aria-hidden="true"
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </Button>
        {expanded ? (
          <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
            {transactions.map((transaction) => {
              const recordId = transaction.recordId as string;
              return (
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-center gap-2 rounded-lg bg-muted/60 p-2"
                  key={recordId}
                >
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm">{transaction.name}</span>
                    <MoneyValue
                      amount={transaction.amount}
                      className="text-muted-foreground text-xs"
                    />
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  <form.Subscribe selector={(state) => state.values.name}>
                    {(sharedName) => (
                      <form.Field name={`overrides.${recordId}`}>
                        {(field) => (
                          <Input
                            aria-label={`Nova descrição de ${transaction.name}`}
                            className="h-9 bg-background"
                            maxLength={160}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder={transaction.name}
                            value={field.state.value ?? sharedName}
                          />
                        )}
                      </form.Field>
                    )}
                  </form.Subscribe>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div className="grid grid-cols-2 gap-2" data-mobile-form-actions>
            <Button
              data-mobile-cancel
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Aplicando..." : `Aplicar a ${count} lançamento${count === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
