import { CurrencyInput } from "@/components/ui/currency-input";

import type { useTransactionForm } from "../useTransactionForm";

import { FieldShell } from "./transaction-field-shell";
import type { TransactionFormValues } from "./transaction-form.validation";
import {
  getTransactionFormErrorMessage,
  validateTransactionAmount,
} from "./transaction-form.validation";
export function TransactionAmountField({
  form,
  isSubmitting,
  values,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
  values: TransactionFormValues;
}) {
  return (
    <form.Field
      name="amount"
      validators={{ onChange: ({ value }) => validateTransactionAmount(value) }}
    >
      {(field) => (
        <FieldShell
          error={getTransactionFormErrorMessage("amount", field.state.meta.errors)}
          label={values.condition === "installment" ? "Valor total da compra" : "Valor"}
        >
          <CurrencyInput
            data-mobile-amount
            aria-invalid={field.state.meta.errors.length > 0}
            disabled={isSubmitting}
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            placeholder="R$ 0,00"
            required
            value={field.state.value}
          />
        </FieldShell>
      )}
    </form.Field>
  );
}
