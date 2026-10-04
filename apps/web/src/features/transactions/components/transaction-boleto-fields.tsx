import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { cn } from "@/lib/utils";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import { getTransactionFormErrorMessage } from "./transaction-form.validation";

export function TransactionBoletoFields({
  form,
  isSubmitting,
  isBoleto,
  showBoletoPaymentDate,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
  isBoleto: boolean;
  showBoletoPaymentDate: boolean;
}) {
  return (
    <>
      {isBoleto ? (
        <div className={cn("grid gap-4", showBoletoPaymentDate && "sm:grid-cols-2")}>
          <form.Field name="dueDate">
            {(field) => (
              <FieldShell
                error={getTransactionFormErrorMessage("dueDate", field.state.meta.errors)}
                label="Vencimento do boleto"
              >
                <DatePicker
                  aria-invalid={field.state.meta.errors.length > 0}
                  disabled={isSubmitting}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </FieldShell>
            )}
          </form.Field>

          {showBoletoPaymentDate ? (
            <form.Field name="boletoPaymentDate">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage(
                    "boletoPaymentDate",
                    field.state.meta.errors,
                  )}
                  label="Data do pagamento"
                >
                  <DatePicker
                    aria-invalid={field.state.meta.errors.length > 0}
                    disabled={isSubmitting}
                    onChange={field.handleChange}
                    value={field.state.value}
                  />
                </FieldShell>
              )}
            </form.Field>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
