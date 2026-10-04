import { ArrowRight } from "lucide-react";
import type { useTransactionForm } from "../useTransactionForm";
import { AccountSelect } from "./transaction-account-select";
import { FieldShell } from "./transaction-field-shell";
import type { TransactionFormValues } from "./transaction-form.validation";

import { getTransactionFormErrorMessage } from "./transaction-form.validation";

export function TransactionTransferFields({
  values,
  activeAccounts,
  setRelatedAccountField,
  setRelatedRecord,
  form,
  isSubmitting,
}: {
  values: TransactionFormValues;
  activeAccounts: ReturnType<typeof useTransactionForm>["activeAccounts"];
  setRelatedAccountField: ReturnType<typeof useTransactionForm>["setRelatedAccountField"];
  setRelatedRecord: ReturnType<typeof useTransactionForm>["setRelatedRecord"];
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
      <form.Field name="sourceAccountId">
        {(field) => (
          <FieldShell
            error={getTransactionFormErrorMessage("sourceAccountId", field.state.meta.errors)}
            label="Conta de origem"
          >
            <AccountSelect
              onCreate={() => {
                setRelatedAccountField("sourceAccountId");
                setRelatedRecord("account");
              }}
              accounts={activeAccounts.filter(
                (account) => account.id !== values.destinationAccountId,
              )}
              disabled={isSubmitting}
              error={field.state.meta.errors.length > 0}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </FieldShell>
        )}
      </form.Field>

      <div
        aria-hidden="true"
        className="flex h-5 items-center justify-center text-muted-foreground sm:h-9"
      >
        <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
      </div>

      <form.Field name="destinationAccountId">
        {(field) => (
          <FieldShell
            error={getTransactionFormErrorMessage("destinationAccountId", field.state.meta.errors)}
            label="Conta de destino"
          >
            <AccountSelect
              onCreate={() => {
                setRelatedAccountField("destinationAccountId");
                setRelatedRecord("account");
              }}
              accounts={activeAccounts.filter((account) => account.id !== values.sourceAccountId)}
              disabled={isSubmitting}
              error={field.state.meta.errors.length > 0}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </FieldShell>
        )}
      </form.Field>
    </div>
  );
}
